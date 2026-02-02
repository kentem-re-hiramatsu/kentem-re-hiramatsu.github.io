import React from "react";
import useStore from "../../utils/store";
import IterationsEditor from "../IterationsEditor";
import { WizardStepProps } from "./types";

const Step5_Iterations: React.FC<WizardStepProps> = ({ onNext, onBack }) => {
  const settings: any = useStore((s) => s.settings);
  const iterations = settings?.iterations ?? [];
  const canProceed =
    iterations.length > 0 &&
    iterations.every((it: any) => {
      return (
        it.start &&
        it.end &&
        it.workingDays &&
        Number.isInteger(it.workingDays) &&
        it.workingDays > 0
      );
    });

  return (
    <div className="wizard-step-content">
      <h3>ステップ5: イテレーション情報の入力</h3>
      <p>
        イテレーション情報を入力してください（タブ区切り: 開始日 終了日
        稼働日）。<strong>少なくとも1件のイテレーションが必要です。</strong>
      </p>
      <IterationsEditor />
      {canProceed && (
        <div className="wizard-info-box success" style={{ marginTop: 16 }}>
          <p>✓ {iterations.length} 件のイテレーションが登録されました</p>
        </div>
      )}
    </div>
  );
};

export default Step5_Iterations;
