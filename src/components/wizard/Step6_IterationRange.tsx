import React, { useState } from "react";
import useStore from "../../utils/store";
import { WizardStepProps } from "./types";

const Step6_IterationRange: React.FC<WizardStepProps> = ({ onNext, onBack }) => {
  const settings: any = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const iterations: any[] = settings?.iterations ?? [];
  const [startIdx, setStartIdx] = useState<number>(0);
  const [endIdx, setEndIdx] = useState<number>(
    Math.max(0, iterations.length - 1)
  );

  const handleSave = () => {
    // 範囲を設定に保存（必要に応じて）
    setSettings({ ...settings, iterationStart: startIdx, iterationEnd: endIdx });
  };

  const formatIterationDisplay = (it: any, idx: number): string => {
    if (it.name) return it.name;
    if (it.start) {
      const m = it.start.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m) {
        return `${Number(m[2])}月${Number(m[3])}日`;
      }
      return it.start;
    }
    return `I${idx + 1}`;
  };

  return (
    <div className="wizard-step-content">
      <h3>ステップ6: 対象イテレーション範囲の指定</h3>
      <p>集計対象とするイテレーション範囲を選択してください。</p>
      {iterations.length === 0 ? (
        <div className="wizard-info-box error" role="alert">
          <p>
            イテレーションが登録されていません。ステップ5に戻ってイテレーションを入力してください。
          </p>
        </div>
      ) : (
        <div style={{ marginTop: 24 }}>
          <label
            style={{
              display: "block",
              marginBottom: 16,
              fontSize: "var(--font-size-base)",
            }}
          >
            <span
              style={{
                display: "block",
                marginBottom: 8,
                fontWeight: "var(--font-weight-medium)",
              }}
            >
              開始イテレーション:
            </span>
            <select
              value={startIdx}
              onChange={(e) => setStartIdx(Number(e.target.value))}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 6,
                border: "1px solid var(--neutral-300)",
                fontSize: "var(--font-size-base)",
              }}
            >
              {iterations.map((it: any, idx: number) => (
                <option key={idx} value={idx}>
                  {formatIterationDisplay(it, idx)}
                </option>
              ))}
            </select>
          </label>
          <label
            style={{
              display: "block",
              marginBottom: 16,
              fontSize: "var(--font-size-base)",
            }}
          >
            <span
              style={{
                display: "block",
                marginBottom: 8,
                fontWeight: "var(--font-weight-medium)",
              }}
            >
              終了イテレーション:
            </span>
            <select
              value={endIdx}
              onChange={(e) => setEndIdx(Number(e.target.value))}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 6,
                border: "1px solid var(--neutral-300)",
                fontSize: "var(--font-size-base)",
              }}
            >
              {iterations.map((it: any, idx: number) => (
                <option key={idx} value={idx}>
                  {formatIterationDisplay(it, idx)}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  );
};

export default Step6_IterationRange;
