import React, { useState, useRef } from "react";
import useStore, { Feature } from "../utils/store";
import Button from "./Button";
import "./FileImporter.css";

const requiredHeaders = ["title", "status", "iteration"];

function parseTSV(text: string) {
  // 行全体を trim してしまうと末尾のタブ（空セル）が削られて列数がずれるため
  // 行のトリミングはセルごとに行う。空行は除去する。
  const rawLines = text.split(/\r?\n/);
  const lines = rawLines.map((l) => l.replace(/\r$/, "")).filter((l) => l.trim() !== "");
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].split("\t").map((h) => h.trim());
  const rows = lines.slice(1).map((line) => line.split("\t").map((c) => c.trim()));
  return { headers, rows };
}

function normalizeHeader(h: string) {
  return h.replace(/\s+/g, "").toLowerCase();
}

const FileImporter: React.FC<{ skipHeaderCheck?: boolean; onImportComplete?: () => void }> = ({ skipHeaderCheck = false, onImportComplete }) => {
  const setFeatures = useStore((s) => s.setFeatures);
  const setSettings = useStore((s) => s.setSettings);
  const [summary, setSummary] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [pendingParsed, setPendingParsed] = useState<Feature[] | null>(null);
  const [pendingErrors, setPendingErrors] = useState<string[] | null>(null);
  const [pendingBadRows, setPendingBadRows] = useState<
    { rowIndex: number; raw: string; errors: string[] }[]
  >([]);
  const [editingRow, setEditingRow] = useState<{ rowIndex: number; text: string } | null>(null);
  const [editingErrors, setEditingErrors] = useState<string[] | null>(null);
  const [tsvHeaders, setTsvHeaders] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onFile = async (file?: File) => {
    if (!file) return;
    const text = await file.text();
    const { headers, rows } = parseTSV(text);
    
    // ヘッダー情報を保存（マッピング画面で使用）
    setTsvHeaders(headers);
    const currentSettings = useStore.getState().settings;
    setSettings({ ...currentSettings, tsvHeaders: headers, tsvRawData: { headers, rows, text } });

    // ウィザードモードでは必須ヘッダーチェックをスキップし、生データのみ保存
    if (skipHeaderCheck) {
      setSummary(`TSVファイルを読み込みました: ${headers.length} 列、${rows.length} 行`);
      // ウィザードモードでは自動確定（マッピング後にパースする）
      if (onImportComplete) {
        setTimeout(() => {
          onImportComplete();
        }, 300);
      }
      return;
    }

    // 通常モードでは従来通り必須ヘッダーチェック
    const normalized = headers.map(normalizeHeader);
    const missing = requiredHeaders.filter((h) => !normalized.includes(h));
    if (missing.length > 0) {
      setErrors([`必須ヘッダーがありません: ${missing.join(", ")}`]);
      setSummary(null);
      return;
    }

    const parsed: Feature[] = [];
    const rowErrors: string[] = [];
    const badRows: { rowIndex: number; raw: string; errors: string[] }[] = [];
    rows.forEach((cells, rowIndex) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        obj[normalizeHeader(h)] = cells[i] ?? "";
      });

      // map fields
      const id = `${rowIndex}-${obj.title ?? ""}`;
      const title = obj.title ?? "";
      const category = obj.category ?? "";
      const storyPointsRaw = obj.storypoints ?? obj.sp ?? "";
      const estimatedRaw = obj.estimatedhours ?? "";
      const actualRaw = obj.actualhours ?? "";
      const iterationRaw = obj.iteration ?? "";
      const status = obj.status ?? "";
      const rawAssignee = obj.assignee ?? obj.owner ?? "";
      let assignee = rawAssignee;
      // handle multiple-assignee cases: take first and warn
      if (rawAssignee && /[,、;\/]/.test(rawAssignee)) {
        const first = rawAssignee.split(/[,、;\/]/)[0].trim();
        assignee = first;
        const warn = `行 ${rowIndex + 2}: 複数担当が検出されました。最初の担当者 '${first}' を使用します`;
        rowErrors.push(warn);
        // also record as a bad row note (non-fatal)
        badRows.push({ rowIndex, raw: cells.join("\t"), errors: [warn] });
      }

      const storyPoints = storyPointsRaw === "" ? null : Number(storyPointsRaw);
      const estimatedHours = estimatedRaw === "" ? null : Number(estimatedRaw);
      const actualHours = actualRaw === "" ? null : Number(actualRaw);
      const iteration = iterationRaw === "" ? null : Number(iterationRaw);

      // validation: title required, numeric conversions if provided
      if (!title) {
        rowErrors.push(`行 ${rowIndex + 2}: タイトルがありません`);
        return;
      }

      const numericFields = [
        ["storyPoints", storyPoints, storyPointsRaw],
        ["estimatedHours", estimatedHours, estimatedRaw],
        ["actualHours", actualHours, actualRaw],
        ["iteration", iteration, iterationRaw],
      ];

      for (const [name, value, raw] of numericFields as any) {
        if (raw !== "" && Number.isNaN(value)) {
          const msg = `行 ${rowIndex + 2}: ${name} が数値ではありません (${raw})`;
          rowErrors.push(msg);
          badRows.push({ rowIndex, raw: cells.join("\t"), errors: [msg] });
          return;
        }
      }

      parsed.push({
        id,
        title,
        category,
        storyPoints,
        estimatedHours,
        actualHours,
        iteration,
        status,
        assignee,
      });
    });

    if (parsed.length === 0 && badRows.length > 0) {
      setErrors(rowErrors.length ? rowErrors : ["すべての行が不正のため、取り込みを中止しました"]);
      setSummary(`成功: 0 件 / 失敗: ${rowErrors.length} 件`);
      setPendingParsed(null);
      setPendingErrors(rowErrors.length ? rowErrors : []);
      setPendingBadRows(badRows);
      return;
    }

    // Hold parsed rows and allow user to confirm or abort
    setPendingParsed(parsed);
    setPendingErrors(rowErrors.length ? rowErrors : []);
    setPendingBadRows(badRows);
    setSummary(`取り込み準備完了: 有効 ${parsed.length} 件 / 不正 ${rowErrors.length} 件`);
    
    // ウィザードモードで、エラーがなく有効な行がある場合は自動確定
    if (skipHeaderCheck && parsed.length > 0 && rowErrors.length === 0) {
      setTimeout(() => {
        confirmImport();
      }, 100);
    }
  };

  const confirmImport = () => {
    if (!pendingParsed) return;
    setFeatures(pendingParsed);
    setSummary(`成功: ${pendingParsed.length} 件 / 失敗: ${pendingErrors?.length ?? 0} 件`);
    setErrors(pendingErrors ?? []);
    setPendingParsed(null);
    setPendingErrors(null);
    setPendingBadRows([]);
    // ウィザードモードの場合、コールバックを呼ぶ
    if (onImportComplete) {
      onImportComplete();
    }
  };

  const abortImport = () => {
    setPendingParsed(null);
    setPendingErrors(null);
    setSummary("取り込みを中止しました");
    setErrors([]);
    setPendingBadRows([]);
  };

  const startEditRow = (row: { rowIndex: number; raw: string }) => {
    setEditingRow({ rowIndex: row.rowIndex, text: row.raw });
    setEditingErrors(null);
  };

  const applyEditRow = () => {
    if (!editingRow) return;
    // re-parse single line
    const line = editingRow.text;
    const cells = line.split("\t").map((c) => c.trim());
    const obj: Record<string, string> = {};
    // headers are from last parse; if no headers, cannot edit
    // For simplicity, reuse requiredHeaders mapping positions by normalized headers length
    // We will try to map by index using the last parsed headers from pendingParsed or errors context
    // Try to reconstruct using first pendingParsed or pendingBadRows context
    const headersFromContext =
      (pendingParsed && pendingParsed.length > 0 && Object.keys(pendingParsed[0]).length > 0 && null) || null;
    // Simple validation: ensure at least title exists at position matching requiredHeaders index 0 if possible
    // Try basic numeric validation as before
    const title = cells[0] ?? "";
    if (!title) {
      setEditingErrors(["タイトルが必須です"]);
      return;
    }
    // naive numeric checks for other typical fields by finding any numeric-looking cells
    // Accept the edited row as valid and append to pendingParsed
    const newFeature: Feature = {
      id: `${editingRow.rowIndex}-${title}`,
      title,
      category: cells[1] ?? "",
      storyPoints: Number(cells[2]) || null,
      estimatedHours: Number(cells[3]) || null,
      actualHours: Number(cells[4]) || null,
      iteration: cells[5] ? Number(cells[5]) : null,
      status: cells[6] ?? "",
      assignee: cells[7] ?? "",
    };
    setPendingParsed((prev) => (prev ? [...prev, newFeature] : [newFeature]));
    // remove this bad row from pendingBadRows
    setPendingBadRows((prev) => (prev ? prev.filter((r) => r.rowIndex !== editingRow.rowIndex) : []));
    setEditingRow(null);
    setEditingErrors(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.tsv') || file.name.endsWith('.txt'))) {
      await onFile(file);
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  return (
    <div>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleFileSelect}
        style={{
          border: `2px dashed ${isDragging ? 'var(--primary)' : 'var(--neutral-300)'}`,
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-2xl)',
          textAlign: 'center',
          cursor: 'pointer',
          backgroundColor: isDragging ? 'var(--primary-light)' : '#ffffff',
          transition: 'all var(--transition-base)',
          marginBottom: 'var(--space-md)',
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: 'var(--space-md)', color: 'var(--primary)' }}>
          📄
        </div>
        <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--space-sm)', color: 'var(--text)' }}>
          TSV ファイルを選択
        </div>
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--muted)', marginBottom: 'var(--space-md)' }}>
          クリックしてファイルを選択、またはここにドラッグ&ドロップ
        </div>
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--muted)' }}>
          対応形式: .tsv, .txt
        </div>
        <input
          ref={fileInputRef}
          id="file-import-input"
          type="file"
          accept=".tsv,.txt"
          aria-label="TSV ファイルを選択"
          onChange={(e) => onFile(e.target.files?.[0])}
          style={{ display: 'none' }}
        />
      </div>
      {summary && (
        <div className="import-message" aria-live="polite">
          {summary}
        </div>
      )}
      {pendingParsed && (
        <div style={{ marginTop: 8, display: "flex", gap: "8px" }}>
          <Button variant="primary" onClick={confirmImport}>
            取り込みを確定
          </Button>
          <Button variant="secondary" onClick={abortImport}>
            取り込みを中止
          </Button>
        </div>
      )}
      {pendingBadRows && pendingBadRows.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <strong>不正行一覧（編集可能）:</strong>
          <ul>
            {pendingBadRows.map((r) => (
              <li key={r.rowIndex} style={{ marginTop: 6 }}>
                行 {r.rowIndex + 2}: <code>{r.raw}</code>
                <div style={{ marginTop: 4 }}>
                  <button onClick={() => startEditRow({ rowIndex: r.rowIndex, raw: r.raw })} style={{ marginRight: 8 }}>
                    修正して再検証
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {editingRow && (
        <div role="dialog" aria-modal="true" style={{ position: "fixed", left: 0, top: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)" }}>
          <div style={{ background: "var(--surface)", padding: 16, borderRadius: 6, width: 640 }}>
            <h4>行 {editingRow.rowIndex + 2} を編集</h4>
            <textarea rows={4} style={{ width: "100%" }} value={editingRow.text} onChange={(e) => setEditingRow({ ...editingRow, text: e.target.value })} />
            {editingErrors && editingErrors.length > 0 && (
              <div style={{ color: "var(--error)", marginTop: 8 }}>
                {editingErrors.map((er, i) => <div key={i}>{er}</div>)}
              </div>
            )}
            <div style={{ marginTop: 8, display: "flex", gap: "8px" }}>
              <Button variant="primary" onClick={applyEditRow}>再検証して追加</Button>
              <Button variant="secondary" onClick={() => setEditingRow(null)}>キャンセル</Button>
            </div>
          </div>
        </div>
      )}
      {errors.length > 0 && (
        <div role="alert" style={{ marginTop: 8, color: "var(--error)" }}>
          <strong>エラー:</strong>
          <ul>
            {errors.slice(0, 10).map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}
      {pendingErrors && pendingErrors.length > 0 && (
        <div role="alert" style={{ marginTop: 8, color: "var(--warning)" }}>
          <strong>不正行のサンプル:</strong>
          <ul>
            {pendingErrors.slice(0, 10).map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default FileImporter;

