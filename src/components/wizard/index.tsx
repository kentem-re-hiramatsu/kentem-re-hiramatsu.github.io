import React, { useState, useEffect } from "react";
import useStore from "../../utils/store";
import Button from "../Button";
import Step1_TSV from "./Step1_TSV";
import Step2_HeaderMapping from "./Step2_HeaderMapping";
import Step3_JSONCheck from "./Step3_JSONCheck";
import Step3b_JSONImport from "./Step3b_JSONImport";
import Step4_StatusMapping from "./Step4_StatusMapping";
import Step5_Iterations from "./Step5_Iterations";
import Step6_IterationRange from "./Step6_IterationRange";
import Step7_Members from "./Step7_Members";
import Step8_MemberIterationWorkingDays from "./Step8_MemberIterationWorkingDays";
import Step9_Export from "./Step9_Export";
import {
  parseTSVToFeatures,
  extractMembersFromAssignees,
} from "./utils";
import "../InitialSetupWizard.css";

const InitialSetupWizard: React.FC<{ onClose: () => void }> = ({
  onClose,
}) => {
  const [step, setStep] = useState(1);
  const [subStep, setSubStep] = useState<"check" | "import">("check");
  const [hasJSON, setHasJSON] = useState<boolean | null>(null);
  const [step3bApplied, setStep3bApplied] = useState(false);
  const [step3bApplyReady, setStep3bApplyReady] = useState(false);
  const [step3bApplyFn, setStep3bApplyFn] = useState<(() => void) | null>(
    null
  );
  const setSettings = useStore((s) => s.setSettings);
  const step2CanProceed = useStore((s) => s.settings?.step2CanProceed ?? false);
  const step4CanProceed = useStore((s) => s.settings?.step4CanProceed ?? false);
  const step5CanProceed = useStore((s) => s.settings?.step5CanProceed ?? false);

  // モーダルが開いているときに背景のスクロールを無効化
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  const applyJSONWithConfirm = (parsed: any) => {
    // 常に上書きで適用する（既存設定があっても無視して全部置き換える）
    const newSettings: any = {};
    if (parsed.members) newSettings.members = Array.isArray(parsed.members) ? [...parsed.members] : parsed.members;
    if (parsed.iterations) newSettings.iterations = Array.isArray(parsed.iterations) ? [...parsed.iterations] : parsed.iterations;
    if (parsed.headerMapping) newSettings.headerMapping = { ...parsed.headerMapping };
    if (parsed.statusMappings) newSettings.statusMappings = { ...parsed.statusMappings };
    if (parsed.memberIterationWorkingDays) newSettings.memberIterationWorkingDays = { ...parsed.memberIterationWorkingDays };
    if (parsed.includePRinDone !== undefined) newSettings.includePRinDone = parsed.includePRinDone;
    // その他の設定も含める（tsvRawData等は含めない）
    Object.keys(parsed).forEach((key) => {
      if (!["members", "iterations", "headerMapping", "statusMappings", "memberIterationWorkingDays", "includePRinDone", "tsvRawData", "tsvHeaders", "step4CanProceed", "step5CanProceed"].includes(key)) {
        newSettings[key] = parsed[key];
      }
    });
    setSettings(newSettings);
    setStep3bApplied(true);
  };

  // step3bAppliedがtrueになったときに自動的にステップ2に遷移
  useEffect(() => {
    if (step3bApplied && step === 1 && subStep === "import") {
      setSubStep("check");
      setStep(2);
    }
  }, [step3bApplied, step, subStep]);

  const totalSteps = 9;
  const currentStepLabel =
    step === 1 && subStep === "import" ? "1b" : String(step);

  const getStepStatus = (
    stepNum: number
  ): "completed" | "active" | "pending" => {
    if (stepNum < step) return "completed";
    if (stepNum === step) return "active";
    return "pending";
  };

  const getStepLabel = (stepNum: number): string => {
    const labels: Record<number, string> = {
      1: "設定ファイル確認",
      2: "TSV取込み",
      3: "ヘッダーマッピング",
      4: "ステータスマッピング",
      5: "イテレーション",
      6: "イテレーション範囲",
      7: "メンバー情報",
      8: "稼働日設定",
      9: "エクスポート",
    };
    return labels[stepNum] || "";
  };

  const handleStep3Next = () => {
    // Step3の場合は、storeから最新のheaderMappingを取得してチェック
    const currentSettings = useStore.getState().settings;
    const headerMapping = currentSettings?.headerMapping ?? {};
    const requiredFields = ["title", "status", "iteration"];
    const canProceed = requiredFields.every((field) => headerMapping[field]);
    if (canProceed) {
      // 念のため、マッピングに基づいてフィーチャーを再パース
      const tsvRawData = currentSettings?.tsvRawData;

      if (tsvRawData && tsvRawData.headers && tsvRawData.rows) {
        const parsed = parseTSVToFeatures(tsvRawData, headerMapping);

        // assigneeとcategoryのマッピングを収集（担当を推測するため）
        const assigneeCategoryMap = new Map<string, Set<string>>();
        parsed.forEach((feature) => {
          if (feature.assignee && feature.category) {
            const assigneeName = feature.assignee.trim();
            if (!assigneeCategoryMap.has(assigneeName)) {
              assigneeCategoryMap.set(assigneeName, new Set<string>());
            }
            assigneeCategoryMap.get(assigneeName)!.add(feature.category);
          }
        });

        // assigneeとroleのマッピングを作成して、直接membersに追加
        const extractedAssigneesWithRole =
          extractMembersFromAssignees(assigneeCategoryMap);

        // 既存のmembersとマージ
        const existingMembers = Array.isArray(currentSettings?.members)
          ? currentSettings.members
          : [];
        const existingMemberNames = existingMembers
          .map((m: any) => m?.name)
          .filter(Boolean);
        const newMembers = extractedAssigneesWithRole.filter(
          (m: any) => !existingMemberNames.includes(m.name)
        );
        const mergedMembers = [...existingMembers, ...newMembers];

        useStore.getState().setFeatures(parsed);

        // 抽出されたassigneeをmembersに統合してsettingsに保存
        const updatedSettingsWithAssignees = {
          ...currentSettings,
          members: mergedMembers,
        };
        useStore.getState().setSettings(updatedSettingsWithAssignees);
      }
      setStep(4);
    }
  };

  const handleNext = () => {
    if (step === 1 && subStep === "check") {
      // ステップ1: 初期設定ファイルの有無確認
      if (hasJSON === false) {
        // JSONを持っていない場合、ステップ2へ
        setStep(2);
      } else if (hasJSON === true) {
        // JSONを持っている場合、インポート画面へ
        setSubStep("import");
      }
    } else if (step === 1 && subStep === "import") {
      // ステップ1b: JSONインポート
      // JSONが適用されている場合のみステップ2へ
      if (step3bApplied) {
        setStep(2);
      } else if (step3bApplyReady && step3bApplyFn) {
        // JSONを適用してからステップ2へ
        step3bApplyFn();
      }
    } else if (step === 3) {
      handleStep3Next();
    } else if (step === 4) {
      // ステップ4: statusマッピングがすべて入力されているかチェック
      const currentSettings = useStore.getState().settings;
      if (currentSettings?.step4CanProceed) {
        setStep(5);
      }
    } else if (step === 5) {
      const currentSettings = useStore.getState().settings;
      if (currentSettings?.step5CanProceed) {
        setStep(6);
      }
    } else if (step === 6) {
      setStep(7);
    } else if (step === 7) {
      // メンバー情報は任意なので、常に次へ進める
      setStep(8);
    } else if (step === 8) {
      setStep(9);
    }
  };

  const handleExportJSON = () => {
    const currentSettings = useStore.getState().settings;
    // tsvRawData、tsvHeaders、step4CanProceed、step5CanProceedを除外してエクスポート
    const {
      tsvRawData,
      tsvHeaders,
      step4CanProceed,
      step5CanProceed,
      ...settingsWithoutTSV
    } = currentSettings;
    // memberIterationWorkingDaysが確実に含まれるようにする
    const exportData = {
      ...settingsWithoutTSV,
      memberIterationWorkingDays:
        currentSettings?.memberIterationWorkingDays ?? {},
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `settings-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onClose();
  };

  return (
    <div
      className="feature-detail-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wizard-title"
    >
      <div className="wizard-container">
        <div className="wizard-header">
          <h2 id="wizard-title">初期設定ウィザード</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            style={{
              position: "absolute",
              top: "var(--space-md)",
              right: "var(--space-md)",
              background: "transparent",
              border: "none",
              fontSize: "24px",
              cursor: "pointer",
              color: "var(--text)",
              width: "32px",
              height: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "50%",
              transition: "background-color var(--transition-base)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--neutral-100)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            ×
          </button>
        </div>

        <div className="wizard-step-indicator">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((stepNum) => {
            const status = getStepStatus(stepNum);
            return (
              <div
                key={stepNum}
                className={`wizard-step-indicator-item ${status}`}
                style={{ display: stepNum <= totalSteps ? "block" : "none" }}
              >
                <span className="wizard-step-indicator-number">{stepNum}</span>
                <span className="wizard-step-indicator-label">
                  {getStepLabel(stepNum)}
                </span>
              </div>
            );
          })}
        </div>
        <div className="wizard-step">
          {step === 1 && subStep === "check" && (
            <Step3_JSONCheck
              onNext={() => setStep(2)}
              onHasJSON={() => setSubStep("import")}
              hasJSON={hasJSON}
              setHasJSON={setHasJSON}
            />
          )}
          {step === 1 && subStep === "import" && (
            <Step3b_JSONImport
              onNext={() => {
                setSubStep("check");
                setStep(2);
              }}
              onBack={() => {
                setSubStep("check");
                setStep3bApplied(false);
                setStep3bApplyReady(false);
                setStep3bApplyFn(null);
              }}
              onApply={applyJSONWithConfirm}
              onConfirmApplyReady={(ready, applyFn) => {
                setStep3bApplyReady(ready);
                setStep3bApplyFn(() => applyFn);
              }}
            />
          )}
          {step === 2 && (
            <Step1_TSV
              onNext={() => setStep(3)}
              onComplete={() => setStep(3)}
            />
          )}
          {step === 3 && (
            <Step2_HeaderMapping
              onNext={() => setStep(4)}
              onBack={() => setStep(2)}
            />
          )}
          {step === 4 && (
            <Step4_StatusMapping
              onNext={() => setStep(5)}
              onBack={() => {
                setStep(3);
              }}
            />
          )}
          {step === 5 && (
            <Step5_Iterations
              onNext={() => setStep(6)}
              onBack={() => setStep(4)}
            />
          )}
          {step === 6 && (
            <Step6_IterationRange
              onNext={() => setStep(7)}
              onBack={() => setStep(5)}
            />
          )}
          {step === 7 && (
            <Step7_Members
              onNext={() => setStep(8)}
              onBack={() => setStep(6)}
            />
          )}
          {step === 8 && (
            <Step8_MemberIterationWorkingDays
              onNext={() => setStep(9)}
              onBack={() => setStep(7)}
            />
          )}
          {step === 9 && (
            <Step9_Export
              onComplete={onClose}
              onBack={() => setStep(8)}
              onExport={handleExportJSON}
            />
          )}
        </div>

        <div className="wizard-footer">
          {step > 1 && step !== 1 && step !== 2 && (
            <Button
              variant="secondary"
              onClick={() => {
                if (step === 3) setStep(2);
                else if (step === 4) setStep(3);
                else if (step === 5) setStep(4);
                else if (step === 6) setStep(5);
                else if (step === 7) setStep(6);
                else if (step === 8) setStep(7);
                else if (step === 9) setStep(8);
              }}
            >
              戻る
            </Button>
          )}
          {step === 1 && subStep === "check" && (
            <Button
              variant="secondary"
              onClick={() => {
                onClose();
              }}
            >
              戻る
            </Button>
          )}
          {step === 1 && subStep === "import" && (
            <Button
              variant="secondary"
              onClick={() => {
                setSubStep("check");
                setStep3bApplied(false);
              }}
            >
              戻る
            </Button>
          )}
          {step === 2 && (
            <Button
              variant="secondary"
              onClick={() => {
                setStep(1);
                setSubStep("check");
                setHasJSON(null);
              }}
            >
              戻る
            </Button>
          )}
          {step < 9 && (
            <Button
              variant="primary"
              disabled={
                (step === 1 &&
                  subStep === "check" &&
                  hasJSON === null) ||
                (step === 1 &&
                  subStep === "import" &&
                  !step3bApplyReady &&
                  !step3bApplied) ||
                (step === 3 && !step2CanProceed) ||
                (step === 4 && !step4CanProceed) ||
                (step === 5 && !step5CanProceed)
              }
              onClick={handleNext}
            >
              次へ
            </Button>
          )}
          {step === 9 && (
            <>
              <Button variant="primary" onClick={handleExportJSON}>
                JSON をエクスポート
              </Button>
              <Button variant="primary" onClick={onClose}>
                エクスポートせずに完了
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default InitialSetupWizard;
