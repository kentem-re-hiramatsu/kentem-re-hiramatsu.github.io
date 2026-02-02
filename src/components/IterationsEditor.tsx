import React, { useState, useEffect, useMemo, useRef } from "react";
import useStore from "../utils/store";

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

const IterationsEditor: React.FC = () => {
  const settings: any = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  
  // initialTextをuseMemoでメモ化
  const initialText = useMemo(() => {
    return (settings?.iterations ?? [])
      .map((it: any) => `${it.start}\t${it.end}\t${it.workingDays ?? ""}`)
      .join("\n");
  }, [settings?.iterations]);

  const [text, setText] = useState(initialText);
  const [errors, setErrors] = useState<string[]>([]);
  
  // initialTextが変更されたときにtextを更新（初回マウント時のみ）
  const prevInitialTextRef = useRef(initialText);
  useEffect(() => {
    if (prevInitialTextRef.current !== initialText) {
      setText(initialText);
      prevInitialTextRef.current = initialText;
    }
  }, [initialText]);

  const onParse = () => {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const parsed: any[] = [];
    const errs: string[] = [];
    lines.forEach((line, idx) => {
      const parts = line.split("\t").map((p) => p.trim());
      const [startRaw, endRaw, workingRaw] = parts;
      const start = parseDate(startRaw || "");
      const end = parseDate(endRaw || "");
      const working = Number(workingRaw || 0);
      if (!start) errs.push(`行 ${idx + 1}: 開始日の解析に失敗 (${startRaw})`);
      if (!end) errs.push(`行 ${idx + 1}: 終了日の解析に失敗 (${endRaw})`);
      if (!Number.isInteger(working) || working <= 0) errs.push(`行 ${idx + 1}: 稼働日が正の整数ではありません (${workingRaw})`);
      if (start && end && new Date(start) >= new Date(end)) errs.push(`行 ${idx + 1}: 開始日 >= 終了日`);
      parsed.push({ start: start ?? startRaw, end: end ?? endRaw, workingDays: working });
    });

    setErrors(errs);
    // 最新のsettingsを取得してから更新
    const currentSettings = useStore.getState().settings;
    if (errs.length === 0) {
      setSettings({ ...currentSettings, iterations: parsed, step5CanProceed: true });
    } else {
      setSettings({ ...currentSettings, step5CanProceed: false });
    }
  };

  // iterationsが変更されたときにcanProceedを更新（値が実際に変更された場合のみ）
  const prevCanProceedRef = useRef<boolean | undefined>(settings?.step5CanProceed);
  useEffect(() => {
    const iterations = settings?.iterations ?? [];
    const canProceed = iterations.length > 0 && iterations.every((it: any) => {
      return it.start && it.end && it.workingDays && Number.isInteger(it.workingDays) && it.workingDays > 0;
    });
    
    // 値が実際に変更された場合のみsetSettingsを呼び出す
    if (prevCanProceedRef.current !== canProceed) {
      prevCanProceedRef.current = canProceed;
      const currentSettings = useStore.getState().settings;
      setSettings({ ...currentSettings, step5CanProceed: canProceed });
    }
  }, [settings?.iterations, setSettings]);

  return (
    <div>
      <h4 id="iterations-desc">イテレーション入力（タブ区切り: 開始日 終了日 稼働日）</h4>
      <textarea
        aria-describedby="iterations-desc"
        aria-label="イテレーション入力"
        rows={8}
        style={{ width: "100%" }}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="例:&#10;1月1日	1月15日	10&#10;1月16日	1月31日	10&#10;2月1日	2月15日	10"
      />
      <div style={{ marginTop: 8 }}>
        <button onClick={onParse} style={{ marginRight: 8 }}>
          解析して保存
        </button>
      </div>
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

export default IterationsEditor;

