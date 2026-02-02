import React, { useState, useCallback, useEffect, useRef } from "react";
import { Step3bJSONImportProps } from "./types";

const Step3b_JSONImport: React.FC<Step3bJSONImportProps> = ({
  onNext,
  onBack,
  onApply,
  onConfirmApplyReady,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<any | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseAndValidateJSON = (text: string) => {
    if (!text.trim()) {
      setError(null);
      setPreview(null);
      if (onConfirmApplyReady) {
        onConfirmApplyReady(false, () => {});
      }
      return;
    }

    try {
      const parsed = JSON.parse(text);
      // バリデーション
      const errs: string[] = [];
      if (!parsed.members || !Array.isArray(parsed.members))
        errs.push("members が配列ではありません");
      if (!parsed.iterations || !Array.isArray(parsed.iterations))
        errs.push("iterations が配列ではありません");
      if (!parsed.headerMapping || typeof parsed.headerMapping !== "object")
        errs.push("headerMapping がオブジェクトではありません");
      // statusMappingsもチェック（必須ではないが、あれば検証）
      if (parsed.statusMappings && typeof parsed.statusMappings !== "object")
        errs.push("statusMappings がオブジェクトではありません");

      if (errs.length > 0) {
        setError(errs.join("\n"));
        setPreview(null);
        if (onConfirmApplyReady) {
          onConfirmApplyReady(false, () => {});
        }
        return;
      }

      setError(null);
      setPreview(parsed);
      // バリデーション成功後、自動的に適用
      if (onApply) {
        onApply(parsed);
      }
    } catch (e: any) {
      setError(e.message);
      setPreview(null);
      if (onConfirmApplyReady) {
        onConfirmApplyReady(false, () => {});
      }
    }
  };

  const handleFileChange = async (file: File) => {
    if (!file) return;

    setFileName(file.name);
    setError(null);
    setPreview(null);

    try {
      const text = await file.text();
      parseAndValidateJSON(text);
    } catch (e: any) {
      setError(`ファイルの読み込みに失敗しました: ${e.message}`);
      setPreview(null);
      if (onConfirmApplyReady) {
        onConfirmApplyReady(false, () => {});
      }
    }
  };

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleFileChange(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith(".json")) {
      await handleFileChange(file);
    } else {
      setError("JSONファイルを選択してください");
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const confirmApply = useCallback(() => {
    if (!preview) return;
    onApply(preview);
  }, [preview, onApply]);

  // onConfirmApplyReadyの呼び出しをuseRefで管理して無限ループを防ぐ
  const prevReadyRef = useRef<{
    ready: boolean;
    preview: any;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (!onConfirmApplyReady) return;

    const currentReady = !!preview && !error;
    const prevReady = prevReadyRef.current;

    // 前回と同じ状態の場合はスキップ（無限ループを防ぐ）
    if (
      prevReady &&
      prevReady.ready === currentReady &&
      prevReady.preview === preview &&
      prevReady.error === error
    ) {
      return;
    }

    prevReadyRef.current = { ready: currentReady, preview, error };
    onConfirmApplyReady(currentReady, confirmApply);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview, error]);

  return (
    <div className="wizard-step-content">
      <h3>ステップ1b: 初期設定 JSON インポート</h3>
      <p>初期設定 JSON ファイルを選択してください。</p>

      <div>
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleFileSelect}
          style={{
            border: `2px dashed ${isDragging ? "var(--primary)" : "var(--neutral-300)"}`,
            borderRadius: "var(--radius-lg)",
            padding: "var(--space-2xl)",
            textAlign: "center",
            cursor: "pointer",
            backgroundColor: isDragging ? "var(--primary-light)" : "#ffffff",
            transition: "all var(--transition-base)",
            marginBottom: "var(--space-md)",
          }}
        >
          <div
            style={{
              fontSize: "48px",
              marginBottom: "var(--space-md)",
              color: "var(--primary)",
            }}
          >
            📄
          </div>
          <div
            style={{
              fontSize: "var(--font-size-lg)",
              fontWeight: "var(--font-weight-semibold)",
              marginBottom: "var(--space-sm)",
              color: "var(--text)",
            }}
          >
            JSON ファイルを選択
          </div>
          <div
            style={{
              fontSize: "var(--font-size-sm)",
              color: "var(--muted)",
              marginBottom: "var(--space-md)",
            }}
          >
            クリックしてファイルを選択、またはここにドラッグ&ドロップ
          </div>
          <div style={{ fontSize: "var(--font-size-xs)", color: "var(--muted)" }}>
            対応形式: .json
          </div>
          <input
            ref={fileInputRef}
            id="json-file-input"
            type="file"
            accept=".json"
            onChange={handleInputChange}
            aria-label="JSON ファイルを選択"
            style={{ display: "none" }}
          />
        </div>
        {fileName && (
          <div className="import-message" aria-live="polite">
            選択されたファイル: {fileName}
          </div>
        )}
      </div>
      {error && (
        <div className="wizard-info-box error" role="alert" style={{ marginTop: 16 }}>
          <p>
            <strong>エラー:</strong>
          </p>
          <pre
            style={{
              marginTop: 8,
              whiteSpace: "pre-wrap",
              fontSize: "var(--font-size-sm)",
            }}
          >
            {error}
          </pre>
        </div>
      )}
      {preview && (
        <div className="wizard-info-box success" style={{ marginTop: 16 }}>
          <p style={{ margin: 0, fontWeight: "var(--font-weight-semibold)" }}>
            ✓ バリデーション成功
          </p>
          <div style={{ marginTop: 12 }}>
            <p style={{ margin: "4px 0" }}>
              メンバー: {preview.members?.length ?? 0} 件
            </p>
            <p style={{ margin: "4px 0" }}>
              イテレーション: {preview.iterations?.length ?? 0} 件
            </p>
            <p style={{ margin: "4px 0" }}>
              ヘッダーマッピング: {Object.keys(preview.headerMapping ?? {}).length} 件
            </p>
            {preview.statusMappings && (
              <p style={{ margin: "4px 0" }}>
                ステータスマッピング: {Object.keys(preview.statusMappings).length} 件
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Step3b_JSONImport;
