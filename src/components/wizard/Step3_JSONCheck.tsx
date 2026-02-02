import React from "react";
import { Step3JSONCheckProps } from "./types";

const Step3_JSONCheck: React.FC<Step3JSONCheckProps> = ({
  onNext,
  onHasJSON,
  hasJSON,
  setHasJSON,
}) => {
  return (
    <div className="wizard-step-content">
      <h3>ステップ1: 初期設定ファイルの有無確認</h3>
      <p>初期設定 JSON ファイルをお持ちですか？</p>
      <div style={{ marginTop: 24 }}>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: 16,
            padding: 16,
            background: "var(--neutral-50)",
            borderRadius: 8,
            cursor: "pointer",
            border:
              hasJSON === true
                ? "2px solid var(--primary)"
                : "2px solid transparent",
            transition: "all var(--transition-base)",
          }}
        >
          <input
            type="radio"
            name="hasJSON"
            checked={hasJSON === true}
            onChange={() => setHasJSON(true)}
            style={{ marginRight: 12, cursor: "pointer" }}
          />
          <span
            style={{
              fontSize: "var(--font-size-base)",
              fontWeight:
                hasJSON === true
                  ? "var(--font-weight-semibold)"
                  : "var(--font-weight-normal)",
            }}
          >
            持っている
          </span>
        </label>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            padding: 16,
            background: "var(--neutral-50)",
            borderRadius: 8,
            cursor: "pointer",
            border:
              hasJSON === false
                ? "2px solid var(--primary)"
                : "2px solid transparent",
            transition: "all var(--transition-base)",
          }}
        >
          <input
            type="radio"
            name="hasJSON"
            checked={hasJSON === false}
            onChange={() => setHasJSON(false)}
            style={{ marginRight: 12, cursor: "pointer" }}
          />
          <span
            style={{
              fontSize: "var(--font-size-base)",
              fontWeight:
                hasJSON === false
                  ? "var(--font-weight-semibold)"
                  : "var(--font-weight-normal)",
            }}
          >
            持っていない
          </span>
        </label>
      </div>
    </div>
  );
};

export default Step3_JSONCheck;
