import React, { useState, useRef } from "react";
import useStore, { Feature } from "../utils/store";
import InitialSetupWizard from "./wizard";
import IterationsEditor from "./IterationsEditor";
import MembersEditor, { MembersEditorRef } from "./MembersEditor";
import FileImporter from "./FileImporter";
import Button from "./Button";

// 編集モード専用のイテレーションエディター
function parseDate(input: string): string | null {
  input = input.trim();
  if (!input) return null;
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
  // e.g. "6月30日" or "9月1日"
  const m = input.match(/^(\d{1,2})月\s*(\d{1,2})日$/);
  if (m) {
    const mm = String(m[1]).padStart(2, "0");
    const dd = String(m[2]).padStart(2, "0");
    const year = new Date().getFullYear();
    return `${year}-${mm}-${dd}`;
  }
  // fallback: try Date parse
  const d = new Date(input);
  if (!Number.isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  return null;
}

const IterationsEditorForEditMode: React.FC<{
  iterations: any[];
  text: string;
  onTextChange: (text: string) => void;
  errors: string[];
}> = ({ iterations, text, onTextChange, errors }) => {
  // iterationsが変更されたときにtextを更新（初回のみ）
  const prevIterationsRef = React.useRef<any[]>(iterations);
  React.useEffect(() => {
    const iterationsChanged = JSON.stringify(iterations) !== JSON.stringify(prevIterationsRef.current);
    if (iterationsChanged) {
      const newText = (iterations ?? [])
        .map((it: any) => `${it.start}\t${it.end}\t${it.workingDays ?? ""}`)
        .join("\n");
      onTextChange(newText);
      prevIterationsRef.current = iterations;
    }
  }, [iterations, onTextChange]);

  return (
    <div>
      <h4 id="iterations-desc">イテレーション入力（タブ区切り: 開始日 終了日 稼働日）</h4>
      <textarea
        aria-describedby="iterations-desc"
        aria-label="イテレーション入力"
        rows={8}
        style={{ width: "100%" }}
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder="例:&#10;1月1日	1月15日	10&#10;1月16日	1月31日	10&#10;2月1日	2月15日	10"
      />
      {errors.length > 0 && (
        <div role="alert" style={{ color: "var(--error)", marginTop: 8 }}>
          <ul>
            {errors.map((er, i) => (
              <li key={i}>{er}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// 設定画面用のTSVインポーター（既存のマッピング設定を使用）
const FileImporterWithMapping: React.FC = () => {
  const settings: any = useStore((s) => s.settings);
  const setFeatures = useStore((s) => s.setFeatures);
  const setSettings = useStore((s) => s.setSettings);
  const features = useStore((s) => s.features);
  const [summary, setSummary] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseTSV = (text: string) => {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return { headers: [], rows: [] };
    const headers = lines[0].split("\t").map((h) => h.trim());
    const rows = lines.slice(1).map((line) => line.split("\t").map((c) => c.trim()));
    return { headers, rows };
  };

  const normalizeHeader = (h: string) => {
    return h.replace(/\s+/g, "").toLowerCase();
  };

  // 自動マッピングを試みる
  const autoMapHeaders = (headers: string[]): Record<string, string> => {
    const mapping: Record<string, string> = {};
    headers.forEach((h) => {
      const normalized = normalizeHeader(h);
      // title
      if (normalized === "title" || normalized.includes("タイトル")) {
        if (!mapping.title) mapping.title = h;
      }
      // status
      if (normalized === "status" || normalized.includes("ステータス") || normalized.includes("状態")) {
        if (!mapping.status) mapping.status = h;
      }
      // iteration
      if (normalized.includes("iteration") || normalized.includes("イテレーション")) {
        if (!mapping.iteration) mapping.iteration = h;
      }
      // category
      if (normalized.includes("category") || normalized.includes("分類")) {
        if (!mapping.category) mapping.category = h;
      }
      // storyPoints
      if (normalized.includes("storypoint") || normalized === "ポイント" || normalized === "point") {
        if (!mapping.storyPoints) mapping.storyPoints = h;
      }
      // estimatedHours
      if (normalized.includes("estimated") || normalized.includes("予定時間") || normalized.includes("見積")) {
        if (!mapping.estimatedHours) mapping.estimatedHours = h;
      }
      // actualHours
      if (normalized.includes("actual") || normalized.includes("実績時間") || normalized.includes("実績")) {
        if (!mapping.actualHours) mapping.actualHours = h;
      }
      // assignee
      if (normalized.includes("assignee") || normalized.includes("担当") || normalized === "assignees") {
        if (!mapping.assignee) mapping.assignee = h;
      }
    });
    return mapping;
  };

  const onFile = async (file?: File) => {
    if (!file) return;
    setSummary(null);
    setErrors([]);
    
    const text = await file.text();
    const { headers, rows } = parseTSV(text);
    
    // 最新のsettingsを取得
    const currentSettings = useStore.getState().settings;
    let headerMapping = currentSettings?.headerMapping ?? {};
    const statusMappings = currentSettings?.statusMappings ?? {};
    
    
    // ヘッダーマッピングが設定されていない場合は自動マッピングを試みる
    if (!headerMapping.title || !headerMapping.status || !headerMapping.iteration) {
      const autoMapping = autoMapHeaders(headers);
      
      if (autoMapping.title && autoMapping.status && autoMapping.iteration) {
        headerMapping = { ...headerMapping, ...autoMapping };
        // 自動マッピングを設定に保存
        setSettings({ ...currentSettings, headerMapping });
      } else {
        setErrors(["ヘッダーマッピングが設定されていません。初期設定ウィザードでマッピングを設定してください。"]);
        setSummary(null);
        return;
      }
    }

    const parsed: Feature[] = [];
    const rowErrors: string[] = [];
    
    const getField = (row: string[], fieldName: string): string => {
      const mappedHeader = headerMapping[fieldName];
      if (!mappedHeader) return "";
      const idx = headers.indexOf(mappedHeader);
      return idx >= 0 ? (row[idx] ?? "").trim() : "";
    };
    
    rows.forEach((cells, rowIndex) => {
      const title = getField(cells, "title");
      if (!title) {
        rowErrors.push(`行 ${rowIndex + 2}: タイトルがありません`);
        return;
      }
      
      const category = getField(cells, "category");
      const storyPointsRaw = getField(cells, "storyPoints");
      const estimatedRaw = getField(cells, "estimatedHours");
      const actualRaw = getField(cells, "actualHours");
      const iterationRaw = getField(cells, "iteration");
      const statusRaw = getField(cells, "status");
      const assigneeRaw = getField(cells, "assignee");
      
      // statusマッピングを適用
      const status = statusMappings[statusRaw] || statusRaw || undefined;
      
      let assignee = assigneeRaw;
      if (assigneeRaw && /[,、;\/]/.test(assigneeRaw)) {
        assignee = assigneeRaw.split(/[,、;\/]/)[0].trim();
      }
      
      const storyPoints = storyPointsRaw === "" ? null : Number(storyPointsRaw);
      const estimatedHours = estimatedRaw === "" ? null : Number(estimatedRaw);
      const actualHours = actualRaw === "" ? null : Number(actualRaw);
      const iteration = iterationRaw === "" ? null : Number(iterationRaw);
      
      // 数値変換のバリデーション
      if (storyPointsRaw !== "" && Number.isNaN(storyPoints)) {
        rowErrors.push(`行 ${rowIndex + 2}: storyPoints が数値ではありません`);
        return;
      }
      if (estimatedRaw !== "" && Number.isNaN(estimatedHours)) {
        rowErrors.push(`行 ${rowIndex + 2}: estimatedHours が数値ではありません`);
        return;
      }
      if (actualRaw !== "" && Number.isNaN(actualHours)) {
        rowErrors.push(`行 ${rowIndex + 2}: actualHours が数値ではありません`);
        return;
      }
      if (iterationRaw !== "" && Number.isNaN(iteration)) {
        rowErrors.push(`行 ${rowIndex + 2}: iteration が数値ではありません`);
        return;
      }
      
      parsed.push({
        id: `${rowIndex}-${title}`,
        title,
        category: category || undefined,
        storyPoints: storyPoints ?? undefined,
        estimatedHours: estimatedHours ?? undefined,
        actualHours: actualHours ?? undefined,
        iteration: iteration ?? undefined,
        status: status,
        assignee: assignee || undefined,
      });
    });

    if (parsed.length === 0) {
      setErrors(rowErrors.length ? rowErrors : ["すべての行が不正のため、取り込みを中止しました"]);
      setSummary(`成功: 0 件 / 失敗: ${rowErrors.length} 件`);
      return;
    }

    // フィーチャーを保存 
    setFeatures(parsed);
    setSummary(`成功: ${parsed.length} 件 / 失敗: ${rowErrors.length} 件`);
    setErrors(rowErrors);
    
    // TSVヘッダー情報も保存（最新のsettingsを取得）
    const latestSettings = useStore.getState().settings;
    setSettings({ ...latestSettings, tsvHeaders: headers, tsvRawData: { headers, rows, text } });
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
          id="settings-file-import-input"
          type="file"
          accept=".tsv,.txt"
          aria-label="TSV ファイルを選択"
          onChange={(e) => onFile(e.target.files?.[0])}
          style={{ display: 'none' }}
        />
      </div>
      {summary && (
        <div className="import-message" aria-live="polite" style={{ marginTop: 8 }}>
          {summary}
        </div>
      )}
      {features.length > 0 && (
        <div style={{ marginTop: 8, padding: 8, background: "var(--success-light)", borderRadius: 4 }}>
          ✓ {features.length} 件のフィーチャーが読み込まれています
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
    </div>
  );
};

const Settings: React.FC = () => {
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const [isEditing, setIsEditing] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [draft, setDraft] = useState<any>(settings ?? {});
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  // 編集モードに入る時にdraftを初期化
  const startEditing = () => {
    setDraft({ ...settings });
    setIsEditing(true);
  };

  // 編集をキャンセル
  const cancelEditing = () => {
    setDraft({ ...settings });
    setIsEditing(false);
  };

  // 完了ボタンで保存
  const saveWithFeedback = (validationErrors?: string[], updatedDraft?: any) => {
    // バリデーションエラーがある場合は保存しない
    if (validationErrors && validationErrors.length > 0) {
      alert("エラー:\n" + validationErrors.join("\n"));
      return;
    }
    const draftToSave = updatedDraft ?? draft;
    setSettings(draftToSave);
    setIsEditing(false);
    setSavedMessage("設定を保存しました");
    setTimeout(() => setSavedMessage(null), 2500);
  };

  // EditModeコンポーネントからバリデーションを実行するための関数
  const handleSave = () => {
    const state = editModeStateRef.current;
    if (!state) {
      // stateがない場合は現在のdraftをそのまま保存
      saveWithFeedback(undefined, draft);
      return;
    }

    // イテレーションのバリデーション
    const errs = (() => {
      const lines = state.iterationsText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const validationErrors: string[] = [];
      lines.forEach((line, idx) => {
        const parts = line.split("\t").map((p) => p.trim());
        const [startRaw, endRaw, workingRaw] = parts;
        const start = parseDate(startRaw || "");
        const end = parseDate(endRaw || "");
        const working = Number(workingRaw || 0);
        if (!start) validationErrors.push(`行 ${idx + 1}: 開始日の解析に失敗 (${startRaw})`);
        if (!end) validationErrors.push(`行 ${idx + 1}: 終了日の解析に失敗 (${endRaw})`);
        if (!Number.isInteger(working) || working <= 0) validationErrors.push(`行 ${idx + 1}: 稼働日が正の整数ではありません (${workingRaw})`);
        if (start && end && new Date(start) >= new Date(end)) validationErrors.push(`行 ${idx + 1}: 開始日 >= 終了日`);
      });
      return validationErrors;
    })();

    if (errs.length > 0) {
      saveWithFeedback(errs);
      return;
    }

    // バリデーション成功時はiterationsを更新してから保存
    const lines = state.iterationsText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const parsed: any[] = [];
    lines.forEach((line) => {
      const parts = line.split("\t").map((p) => p.trim());
      const [startRaw, endRaw, workingRaw] = parts;
      const start = parseDate(startRaw || "");
      const end = parseDate(endRaw || "");
      const working = Number(workingRaw || 0);
      parsed.push({ start: start ?? startRaw, end: end ?? endRaw, workingDays: working });
    });

    // ステータスマッピングを保存形式に変換
    const mappingsForSave: Record<string, string> = {};
    Object.entries(state.localStatusMappings).forEach(([internalStatus, tsvStatus]) => {
      if (tsvStatus && tsvStatus.trim() !== "") {
        mappingsForSave[tsvStatus.trim()] = internalStatus;
      }
    });
    // 追加マッピングも含める
    if (state.additionalMappings) {
      state.additionalMappings.forEach(({ internalStatus, tsvStatus }) => {
        if (tsvStatus && tsvStatus.trim() !== "") {
          mappingsForSave[tsvStatus.trim()] = internalStatus;
        }
      });
    }

    // MembersEditorからmembersを取得
    const currentMembers = membersEditorRef.current?.getMembers() ?? state.localMembers;

    // 更新されたdraftを作成（配列も新しい配列として作成）
    const updatedDraft = {
      ...draft,
      headerMapping: { ...state.localHeaderMapping },
      statusMappings: { ...mappingsForSave },
      members: Array.isArray(currentMembers) ? [...currentMembers] : currentMembers,
      iterations: Array.isArray(parsed) && parsed.length > 0 ? [...parsed] : (Array.isArray(state.localIterations) ? [...state.localIterations] : state.localIterations),
      memberIterationWorkingDays: state.localWorkingDays ? { ...state.localWorkingDays } : {},
    };

    // draftを更新（表示用）
    setDraft(updatedDraft);

    // 更新されたdraftを直接保存
    saveWithFeedback(undefined, updatedDraft);
  };


  const exportJSON = () => {
    // 最新のsettingsを取得
    const currentSettings = useStore.getState().settings;
    // tsvRawData、tsvHeaders、step4CanProceed、step5CanProceedを除外してエクスポート
    const { tsvRawData, tsvHeaders, step4CanProceed, step5CanProceed, ...settingsWithoutTSV } = currentSettings;
    // memberIterationWorkingDaysが確実に含まれるようにする
    const exportData = {
      ...settingsWithoutTSV,
      memberIterationWorkingDays: currentSettings?.memberIterationWorkingDays ?? {},
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "settings.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  // 閲覧モード用の表示コンポーネント
  const ViewMode: React.FC = () => {
    const currentSettings = settings ?? {};
    const headerMapping = currentSettings?.headerMapping ?? {};
    const statusMappings = currentSettings?.statusMappings ?? {};
    const iterations = currentSettings?.iterations ?? [];
    const members = Array.isArray(currentSettings?.members) ? currentSettings.members : [];
    const memberIterationWorkingDays = currentSettings?.memberIterationWorkingDays ?? {};

    // メンバー・イテレーションごとの稼働日を取得する関数
    const getMemberWorkingDays = (memberName: string, iterationIndex: number): number => {
      const memberDays = memberIterationWorkingDays[memberName];
      if (memberDays && typeof memberDays[iterationIndex] === "number") {
        return memberDays[iterationIndex];
      }
      // デフォルトはイテレーションの稼働日
      return iterations[iterationIndex]?.workingDays ?? 0;
    };

    // イテレーションラベルをフォーマットする関数
    const formatIterationLabel = (it: any, idx: number): string => {
      if (it.name) return it.name;
      // 日付からラベルを生成
      if (it.start) {
        const m = it.start.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (m) {
          return `${Number(m[2])}月${Number(m[3])}日`;
        }
        // M月D日形式の場合
        const m2 = it.start.match(/(\d+)月(\d+)日/);
        if (m2) {
          return it.start;
        }
      }
      return `I${idx + 1}`;
    };

    return (
      <div>
        <div style={{ marginTop: 16 }}>
          <h3>ヘッダーマッピング</h3>
          <div style={{ background: "var(--surface)", padding: 12, borderRadius: 4 }}>
            <table style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>内部項目</th>
                  <th>TSVヘッダー</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const fieldLabels: Record<string, string> = {
                    title: "タイトル",
                    status: "状態",
                    iteration: "イテレーション",
                    storyPoints: "ストーリーポイント",
                    estimatedHours: "予定時間",
                    actualHours: "実績時間",
                    assignee: "担当者",
                    category: "分類",
                  };
                  const requiredFields = ["title", "status", "iteration", "storyPoints", "estimatedHours", "actualHours", "assignee", "category"];
                  return requiredFields.map((key) => (
                    <tr key={key}>
                      <td><strong>{fieldLabels[key] || key}</strong></td>
                      <td>{headerMapping[key] ? String(headerMapping[key]) : "-"}</td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <h3>ステータスマッピング</h3>
          <div style={{ background: "var(--surface)", padding: 12, borderRadius: 4 }}>
            <table style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>内部ステータス</th>
                  <th>TSVステータス</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const internalStatuses = ["未対応", "作業中", "PR中", "完了", "破棄"];
                  
                  // デフォルトマッピングを抽出
                  const defaultMappings: Array<{ internalStatus: string; tsvStatus: string }> = [];
                  internalStatuses.forEach((internalStatus) => {
                    const tsvStatus = Object.entries(statusMappings).find(([_, intStatus]) => intStatus === internalStatus)?.[0];
                    if (tsvStatus) {
                      defaultMappings.push({ internalStatus, tsvStatus });
                    }
                  });
                  
                  // 追加マッピングを抽出
                  const defaultMappedTsvStatuses = new Set(defaultMappings.map(m => m.tsvStatus));
                  const additionalMappings: Array<{ internalStatus: string; tsvStatus: string }> = [];
                  Object.entries(statusMappings).forEach(([tsvStatus, internalStatus]) => {
                    if (!defaultMappedTsvStatuses.has(tsvStatus)) {
                      additionalMappings.push({ internalStatus: internalStatus as string, tsvStatus });
                    }
                  });
                  
                  return (
                    <>
                      {internalStatuses.map((internalStatus) => {
                        const tsvStatus = Object.entries(statusMappings).find(([_, intStatus]) => intStatus === internalStatus)?.[0];
                        return (
                          <tr key={internalStatus}>
                            <td><strong>{internalStatus}</strong></td>
                            <td>{tsvStatus ? String(tsvStatus) : "-"}</td>
                          </tr>
                        );
                      })}
                      {additionalMappings.length > 0 && (
                        <>
                          <tr>
                            <td colSpan={2} style={{ paddingTop: 16, borderTop: "2px solid var(--neutral-300)" }}>
                              <strong>追加マッピング</strong>
                            </td>
                          </tr>
                          {additionalMappings.map((mapping, index) => (
                            <tr key={`additional-${index}`}>
                              <td>{mapping.internalStatus}</td>
                              <td>{mapping.tsvStatus}</td>
                            </tr>
                          ))}
                        </>
                      )}
                    </>
                  );
                })()}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <h3>イテレーション情報</h3>
          <div style={{ background: "var(--surface)", padding: 12, borderRadius: 4 }}>
            {iterations.length > 0 ? (
              <table style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th>開始日</th>
                    <th>終了日</th>
                    <th>稼働日</th>
                  </tr>
                </thead>
                <tbody>
                  {iterations.map((it: any, idx: number) => (
                    <tr key={idx}>
                      <td>{it.start || "-"}</td>
                      <td>{it.end || "-"}</td>
                      <td>{it.workingDays ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div>設定されていません</div>
            )}
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <h3>メンバー情報</h3>
          <div style={{ background: "var(--surface)", padding: 12, borderRadius: 4 }}>
            {members.length > 0 ? (
              <table style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th>氏名</th>
                    <th>担当</th>
                    <th>計画ベロシティ (pt/day)</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m: any, idx: number) => (
                    <tr key={idx}>
                      <td>{m.name || "-"}</td>
                      <td>{m.role || "-"}</td>
                      <td>{m.plannedVelocity ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div>設定されていません</div>
            )}
          </div>
        </div>

        {members.length > 0 && iterations.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <h3>各人・各イテレーションの稼働日設定</h3>
            <div style={{ background: "var(--surface)", padding: 12, borderRadius: 4 }}>
              <div 
                className="ios-scroll"
                style={{
                  overflowX: "scroll",
                  overflowY: "hidden",
                  WebkitOverflowScrolling: "touch",
                  scrollbarWidth: "none",
                  msOverflowStyle: "none",
                  scrollbarColor: "transparent transparent",
                } as React.CSSProperties}
              >
                <table style={{ width: "100%", minWidth: 600 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "center" }}>メンバー</th>
                      {iterations.map((it: any, idx: number) => (
                        <th key={idx} style={{ minWidth: 120, textAlign: "center" }}>
                          {formatIterationLabel(it, idx)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m: any, midx: number) => (
                      <tr key={midx}>
                        <td style={{ fontWeight: 600, textAlign: "center" }}>{m.name}</td>
                        {iterations.map((it: any, idx: number) => {
                          const wd = getMemberWorkingDays(m.name, idx);
                          const defaultWd = it.workingDays ?? 0;
                          return (
                            <td key={idx} style={{ textAlign: "center" }}>
                              {wd !== defaultWd ? (
                                <span style={{ fontWeight: 600 }}>{wd}</span>
                              ) : (
                                <span style={{ color: "var(--text-secondary)" }}>{wd}</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // EditModeのローカル状態への参照
  const editModeStateRef = React.useRef<{
    localHeaderMapping: Record<string, string>;
    localStatusMappings: Record<string, string>;
    localMembers: any[];
    localIterations: any[];
    iterationsText: string;
    localWorkingDays: { [key: string]: { [key: number]: number } };
    additionalMappings?: Array<{ internalStatus: string; tsvStatus: string }>;
  } | null>(null);
  
  // MembersEditorの参照
  const membersEditorRef = React.useRef<MembersEditorRef>(null);

  // 編集モード用のコンポーネント
  const EditMode: React.FC = () => {
    // statusMappingsは{ [tsvStatus]: internalStatus }の形式で保存されているので、
    // 編集用に{ [internalStatus]: tsvStatus }の形式に変換
    // 同じ内部ステータスに複数のTSVステータスがある場合、最初の1つだけを返す
    const convertStatusMappingsForEdit = (mappings: Record<string, string>): Record<string, string> => {
      const reversed: Record<string, string> = {};
      Object.entries(mappings ?? {}).forEach(([tsvStatus, internalStatus]) => {
        // 既に設定されている場合は上書きしない（最初の1つだけを使用）
        if (!reversed[internalStatus]) {
          reversed[internalStatus] = tsvStatus;
        }
      });
      return reversed;
    };

    const [localHeaderMapping, setLocalHeaderMapping] = useState<Record<string, string>>(
      draft?.headerMapping ?? {}
    );
    const [localStatusMappings, setLocalStatusMappings] = useState<Record<string, string>>(
      convertStatusMappingsForEdit(draft?.statusMappings ?? {})
    );
    
    // 追加マッピングを管理
    const internalStatuses = ["未対応", "作業中", "PR中", "完了", "破棄"];
    // 追加マッピングを抽出する関数
    const extractAdditionalMappings = React.useCallback((mappings: Record<string, string>, localMappings: Record<string, string>): Array<{ internalStatus: string; tsvStatus: string }> => {
      const existing = mappings ?? {};
      const local = localMappings ?? {};
      
      // localStatusMappingsに含まれているTSVステータスをデフォルトマッピングとして記録
      const defaultMappedTsvStatuses = new Set<string>();
      Object.values(local).forEach((tsvStatus) => {
        if (tsvStatus && tsvStatus.trim() !== "") {
          defaultMappedTsvStatuses.add(tsvStatus.trim());
        }
      });
      
      const additional: Array<{ internalStatus: string; tsvStatus: string }> = [];
      Object.entries(existing).forEach(([tsvStatus, internalStatus]) => {
        // デフォルトのマッピング（localStatusMappings）に含まれていないものを追加マッピングとして抽出
        // tsvStatusをtrimして比較（保存時にtrimしているため）
        const trimmedTsvStatus = tsvStatus.trim();
        if (!defaultMappedTsvStatuses.has(trimmedTsvStatus)) {
          additional.push({ internalStatus: internalStatus as string, tsvStatus: trimmedTsvStatus });
        }
      });
      return additional;
    }, []);
    
    const [additionalMappings, setAdditionalMappings] = useState<Array<{ internalStatus: string; tsvStatus: string }>>(
      () => extractAdditionalMappings(draft?.statusMappings ?? {}, convertStatusMappingsForEdit(draft?.statusMappings ?? {}))
    );
    
    // draftが変更されたときにadditionalMappingsを更新（外部からの変更時のみ）
    const isManualUpdateRef = React.useRef(false);
    const prevStatusMappingsRef = React.useRef<string>(JSON.stringify(draft?.statusMappings ?? {}));
    React.useEffect(() => {
      if (isManualUpdateRef.current) {
        isManualUpdateRef.current = false;
        prevStatusMappingsRef.current = JSON.stringify(draft?.statusMappings ?? {});
        return;
      }
      const currentStatusMappingsStr = JSON.stringify(draft?.statusMappings ?? {});
      // statusMappingsが実際に変更された場合のみ更新
      if (prevStatusMappingsRef.current !== currentStatusMappingsStr) {
        const currentLocalMappings = convertStatusMappingsForEdit(draft?.statusMappings ?? {});
        const newAdditional = extractAdditionalMappings(draft?.statusMappings ?? {}, currentLocalMappings);
        setAdditionalMappings(newAdditional);
        prevStatusMappingsRef.current = currentStatusMappingsStr;
      }
    }, [draft?.statusMappings, extractAdditionalMappings]);
    
    const [localMembers, setLocalMembers] = useState<any[]>(
      Array.isArray(draft?.members) ? draft.members : []
    );
    const [localIterations, setLocalIterations] = useState<any[]>(
      Array.isArray(draft?.iterations) ? draft.iterations : []
    );
    const [iterationsText, setIterationsText] = useState<string>(
      (Array.isArray(draft?.iterations) ? draft.iterations : [])
        .map((it: any) => `${it.start}\t${it.end}\t${it.workingDays ?? ""}`)
        .join("\n")
    );
    const [iterationsErrors, setIterationsErrors] = useState<string[]>([]);
    const [localWorkingDays, setLocalWorkingDays] = useState<{
      [key: string]: { [key: number]: number };
    }>(() => draft?.memberIterationWorkingDays ?? {});

    // イテレーションテキストのバリデーション関数
    const validateIterations = React.useCallback((text: string): string[] => {
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const validationErrors: string[] = [];
      lines.forEach((line, idx) => {
        const parts = line.split("\t").map((p) => p.trim());
        const [startRaw, endRaw, workingRaw] = parts;
        const start = parseDate(startRaw || "");
        const end = parseDate(endRaw || "");
        const working = Number(workingRaw || 0);
        if (!start) validationErrors.push(`行 ${idx + 1}: 開始日の解析に失敗 (${startRaw})`);
        if (!end) validationErrors.push(`行 ${idx + 1}: 終了日の解析に失敗 (${endRaw})`);
        if (!Number.isInteger(working) || working <= 0) validationErrors.push(`行 ${idx + 1}: 稼働日が正の整数ではありません (${workingRaw})`);
        if (start && end && new Date(start) >= new Date(end)) validationErrors.push(`行 ${idx + 1}: 開始日 >= 終了日`);
      });
      return validationErrors;
    }, []);

    // ローカル状態をrefに反映（保存時に使用）
    React.useEffect(() => {
      editModeStateRef.current = {
        localHeaderMapping,
        localStatusMappings,
        localMembers,
        localIterations,
        iterationsText,
        localWorkingDays,
        additionalMappings,
      };
    }, [localHeaderMapping, localStatusMappings, localMembers, localIterations, iterationsText, localWorkingDays, additionalMappings]);

    const handleHeaderMappingChange = React.useCallback((key: string, value: string) => {
      setLocalHeaderMapping((prev) => {
        const newMapping = { ...prev, [key]: value };
        return newMapping;
      });
    }, []);

    const handleStatusMappingChange = React.useCallback((internalStatus: string, tsvStatus: string) => {
      setLocalStatusMappings((prev) => {
        const newMappings = { ...prev, [internalStatus]: tsvStatus };
        return newMappings;
      });
    }, []);
    
    const handleAddAdditionalMapping = React.useCallback(() => {
      isManualUpdateRef.current = true;
      prevStatusMappingsRef.current = JSON.stringify(draft?.statusMappings ?? {});
      setAdditionalMappings((prev) => [...prev, { internalStatus: internalStatuses[0], tsvStatus: "" }]);
    }, [draft?.statusMappings]);
    
    const handleUpdateAdditionalMapping = React.useCallback((index: number, field: "internalStatus" | "tsvStatus", value: string) => {
      isManualUpdateRef.current = true;
      prevStatusMappingsRef.current = JSON.stringify(draft?.statusMappings ?? {});
      setAdditionalMappings((prev) => {
        const newAdditional = [...prev];
        newAdditional[index] = { ...newAdditional[index], [field]: value };
        return newAdditional;
      });
    }, [draft?.statusMappings]);
    
    const handleRemoveAdditionalMapping = React.useCallback((index: number) => {
      isManualUpdateRef.current = true;
      prevStatusMappingsRef.current = JSON.stringify(draft?.statusMappings ?? {});
      setAdditionalMappings((prev) => prev.filter((_, i) => i !== index));
    }, [draft?.statusMappings]);

    // メンバー・イテレーションごとの稼働日を取得する関数
    const getMemberWorkingDays = (
      memberName: string,
      iterationIndex: number
    ): number => {
      const memberDays = localWorkingDays[memberName];
      if (memberDays && typeof memberDays[iterationIndex] === "number") {
        return memberDays[iterationIndex];
      }
      // デフォルトはイテレーションの稼働日
      return localIterations[iterationIndex]?.workingDays ?? 0;
    };

    // メンバー・イテレーションごとの稼働日を設定する関数
    const setMemberWorkingDays = (
      memberName: string,
      iterationIndex: number,
      workingDays: number
    ) => {
      setLocalWorkingDays((prev) => {
        const newState = { ...prev };
        if (!newState[memberName]) {
          newState[memberName] = {};
        }
        newState[memberName] = {
          ...newState[memberName],
          [iterationIndex]: workingDays,
        };
        return newState;
      });
    };

    // イテレーションラベルをフォーマットする関数
    const formatIterationLabel = (it: any, idx: number): string => {
      if (it.name) return it.name;
      // 日付からラベルを生成
      if (it.start) {
        const m = it.start.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (m) {
          return `${Number(m[2])}月${Number(m[3])}日`;
        }
        // M月D日形式の場合
        const m2 = it.start.match(/(\d+)月(\d+)日/);
        if (m2) {
          return it.start;
        }
      }
      return `I${idx + 1}`;
    };

    return (
      <div>
        <div style={{ marginTop: 16 }}>
          <h3>ヘッダーマッピング</h3>
          <div style={{ background: "var(--surface)", padding: 12, borderRadius: 4 }}>
            <table style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>内部項目</th>
                  <th>TSVヘッダー</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const fieldLabels: Record<string, string> = {
                    title: "タイトル",
                    status: "状態",
                    iteration: "イテレーション",
                    storyPoints: "ストーリーポイント",
                    estimatedHours: "予定時間",
                    actualHours: "実績時間",
                    assignee: "担当者",
                    category: "分類",
                  };
                  const requiredFields = ["title", "status", "iteration", "storyPoints", "estimatedHours", "actualHours", "assignee", "category"];
                  const tsvHeaders = draft?.tsvHeaders ?? [];
                  return requiredFields.map((key) => (
                    <tr key={`header-${key}`}>
                      <td>
                        <strong>{fieldLabels[key] || key}</strong>
                      </td>
                      <td>
                        <select
                          key={`header-select-${key}`}
                          value={localHeaderMapping[key] ?? ""}
                          onChange={(e) => handleHeaderMappingChange(key, e.target.value)}
                          style={{ width: "100%" }}
                        >
                          <option value="">選択してください</option>
                          {tsvHeaders.map((header) => (
                            <option key={header} value={header}>
                              {header}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <h3>ステータスマッピング</h3>
          <div style={{ background: "var(--surface)", padding: 12, borderRadius: 4 }}>
            <table style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>内部ステータス</th>
                  <th>TSVステータス</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {internalStatuses.map((internalStatus) => (
                  <tr key={`status-${internalStatus}`}>
                    <td>
                      <strong>{internalStatus}</strong>
                    </td>
                    <td>
                      <input
                        key={`status-input-${internalStatus}`}
                        type="text"
                        value={localStatusMappings[internalStatus] ?? ""}
                        onChange={(e) => handleStatusMappingChange(internalStatus, e.target.value)}
                        placeholder="例: Done, 完了, Closed"
                        style={{ width: "100%" }}
                      />
                    </td>
                    <td></td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={3} style={{ paddingTop: 16, borderTop: "2px solid var(--neutral-300)" }}>
                    <strong>追加マッピング</strong>
                    {additionalMappings.length === 0 && <span style={{ marginLeft: 8, color: "var(--muted)", fontSize: "0.9em" }}>(なし)</span>}
                  </td>
                </tr>
                {additionalMappings.map((mapping, index) => (
                  <tr key={`additional-${index}`}>
                    <td>
                      <select
                        value={mapping.internalStatus}
                        onChange={(e) => handleUpdateAdditionalMapping(index, "internalStatus", e.target.value)}
                        style={{ width: "100%" }}
                      >
                        {internalStatuses.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="text"
                        value={mapping.tsvStatus}
                        onChange={(e) => handleUpdateAdditionalMapping(index, "tsvStatus", e.target.value)}
                        placeholder="TSV status値を入力"
                        style={{ width: "100%" }}
                      />
                    </td>
                    <td>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleRemoveAdditionalMapping(index)}
                      >
                        削除
                      </Button>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={3} style={{ paddingTop: 16 }}>
                    <Button variant="secondary" onClick={handleAddAdditionalMapping}>
                      追加マッピングを追加
                    </Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <h3>イテレーション情報</h3>
          <div style={{ background: "var(--surface)", padding: 12, borderRadius: 4 }}>
            <IterationsEditorForEditMode
              iterations={localIterations}
              text={iterationsText}
              onTextChange={(text) => {
                setIterationsText(text);
                const errs = validateIterations(text);
                setIterationsErrors(errs);
                // エラーがない場合はイテレーションをパースしてローカル状態に反映
                if (errs.length === 0) {
                  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
                  const parsed: any[] = [];
                  lines.forEach((line) => {
                    const parts = line.split("\t").map((p) => p.trim());
                    const [startRaw, endRaw, workingRaw] = parts;
                    const start = parseDate(startRaw || "");
                    const end = parseDate(endRaw || "");
                    const working = Number(workingRaw || 0);
                    parsed.push({ start: start ?? startRaw, end: end ?? endRaw, workingDays: working });
                  });
                  setLocalIterations(parsed);
                }
              }}
              errors={iterationsErrors}
            />
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <h3>メンバー情報</h3>
          <div style={{ background: "var(--surface)", padding: 12, borderRadius: 4 }}>
            <MembersEditor 
              ref={membersEditorRef}
              hideSaveButton={true} 
              initialMembers={localMembers}
            />
          </div>
        </div>

        {localMembers.length > 0 && localIterations.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <h3>各人・各イテレーションの稼働日設定</h3>
            <div style={{ background: "var(--surface)", padding: 12, borderRadius: 4 }}>
              <p style={{ marginBottom: 16, fontSize: "0.9em", color: "var(--text-secondary)" }}>
                各メンバー、各イテレーションごとの稼働日を設定できます。未設定の場合はイテレーションの稼働日が使用されます。
              </p>
              <div 
                className="ios-scroll"
                style={{
                  overflowX: "scroll",
                  overflowY: "hidden",
                  WebkitOverflowScrolling: "touch",
                  scrollbarWidth: "none",
                  msOverflowStyle: "none",
                  scrollbarColor: "transparent transparent",
                } as React.CSSProperties}
              >
                <table style={{ width: "100%", minWidth: 600 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "center" }}>メンバー</th>
                      {localIterations.map((it: any, idx: number) => (
                        <th key={idx} style={{ minWidth: 120, textAlign: "center" }}>
                          {formatIterationLabel(it, idx)}
                          <div
                            style={{
                              fontSize: "0.8em",
                              fontWeight: "normal",
                              color: "var(--text-secondary)",
                              marginTop: 4,
                            }}
                          >
                            (デフォルト: {it.workingDays ?? 0}日)
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {localMembers.map((m: any, midx: number) => (
                      <tr key={midx}>
                        <td style={{ fontWeight: 600, textAlign: "center" }}>{m.name}</td>
                        {localIterations.map((it: any, idx: number) => {
                          const wd = getMemberWorkingDays(m.name, idx);
                          const defaultWd = it.workingDays ?? 0;
                          const iterationLabel = formatIterationLabel(it, idx);
                          return (
                            <td key={idx} style={{ textAlign: "center" }}>
                              <input
                                type="number"
                                min="0"
                                value={wd}
                                onChange={(e) => {
                                  const newWd = Number(e.target.value);
                                  if (!isNaN(newWd) && newWd >= 0) {
                                    setMemberWorkingDays(m.name, idx, newWd);
                                  }
                                }}
                                style={{
                                  width: "100%",
                                  padding: 8,
                                  borderRadius: 4,
                                  border: "1px solid var(--neutral-300)",
                                  textAlign: "center",
                                }}
                                aria-label={`${m.name}の${iterationLabel}の稼働日`}
                                placeholder={String(defaultWd)}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>
    );
  };

  return (
    <div>
      {!isEditing && (
        <div style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: "8px" }}>
            <Button variant="primary" onClick={() => setShowWizard(true)}>
              初期設定ウィザード
            </Button>
            <Button variant="secondary" onClick={exportJSON}>JSON を出力</Button>
          </div>
          <Button variant="primary" onClick={startEditing}>
            編集
          </Button>
        </div>
      )}

      {isEditing && (
        <div
          style={{
            position: "fixed",
            top: "16px",
            right: "16px",
            display: "flex",
            gap: "8px",
            zIndex: 1000,
            background: "var(--surface)",
            padding: "8px",
            borderRadius: "4px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
          }}
        >
          <Button variant="primary" onClick={handleSave}>
            完了
          </Button>
          <Button variant="secondary" onClick={cancelEditing}>
            キャンセル
          </Button>
        </div>
      )}

      {!isEditing && (
        <div style={{ marginBottom: 16 }}>
          <h3>TSV取込み</h3>
          <div style={{ background: "var(--surface)", padding: 12, borderRadius: 4 }}>
            <FileImporterWithMapping />
          </div>
        </div>
      )}

      {isEditing ? <EditMode /> : <ViewMode />}

      {showWizard && <InitialSetupWizard onClose={() => setShowWizard(false)} />}
      {savedMessage && (
        <div
          aria-live="polite"
          className="saved-message"
          style={{
            position: "fixed",
            top: "16px",
            left: "50%",
            padding: "12px 24px",
            background: "var(--success-light)",
            borderRadius: "var(--radius-md)",
            color: "var(--success)",
            boxShadow: "var(--shadow-lg)",
            zIndex: 1001,
            fontWeight: "var(--font-weight-medium)",
            fontSize: "var(--font-size-base)",
          }}
        >
          {savedMessage}
        </div>
      )}
    </div>
  );
};

export default Settings;

