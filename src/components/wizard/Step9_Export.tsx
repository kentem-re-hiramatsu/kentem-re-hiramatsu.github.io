import React from "react";
import { Step9Props } from "./types";

const Step9_Export: React.FC<Step9Props> = ({ onComplete, onBack, onExport }) => {

  return (
    <div className="wizard-step-content">
      <h3>ステップ9: 初期設定エクスポート確認</h3>
      <p>現在の設定を JSON としてエクスポートしますか？</p>
      <div className="wizard-info-box primary" style={{ marginTop: 24 }}>
        <p>
          設定をエクスポートすることで、後で同じ設定をインポートして使用できます。
        </p>
      </div>
    </div>
  );
};

export default Step9_Export;
