import React from "react";
import useStore from "../../utils/store";
import { WizardStepProps } from "./types";

const Step8_MemberIterationWorkingDays: React.FC<WizardStepProps> = ({
  onNext,
  onBack,
}) => {
  const settings: any = useStore((s) => s.settings);
  const members: any[] = settings?.members ?? [];
  const iterations: any[] = settings?.iterations ?? [];

  // ローカル状態で稼働日を管理
  const [localWorkingDays, setLocalWorkingDays] = React.useState<{
    [key: string]: { [key: number]: number };
  }>(() => settings?.memberIterationWorkingDays ?? {});

  // 初期化フラグ
  const [initialized, setInitialized] = React.useState(false);

  // ステップ8に入ったときに、すべてのメンバー・イテレーションの組み合わせに対してデフォルト値を設定
  React.useEffect(() => {
    if (!initialized && members.length > 0 && iterations.length > 0) {
      const existingData = settings?.memberIterationWorkingDays ?? {};
      const newData: { [key: string]: { [key: number]: number } } = {};

      members.forEach((m: any) => {
        newData[m.name] = {};
        iterations.forEach((it: any, idx: number) => {
          // 既存の値があればそれを使用、なければイテレーションのデフォルト値を使用
          if (
            existingData[m.name] &&
            typeof existingData[m.name][idx] === "number"
          ) {
            newData[m.name][idx] = existingData[m.name][idx];
          } else {
            newData[m.name][idx] = it.workingDays ?? 0;
          }
        });
      });

      setLocalWorkingDays(newData);
      setInitialized(true);
    }
  }, [members, iterations, initialized, settings?.memberIterationWorkingDays]);

  // ローカル状態が変更されたらstoreに保存
  React.useEffect(() => {
    if (initialized && Object.keys(localWorkingDays).length > 0) {
      const currentSettings = useStore.getState().settings;
      useStore.getState().setSettings({
        ...currentSettings,
        memberIterationWorkingDays: localWorkingDays,
      });
    }
  }, [localWorkingDays, initialized]);

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
    return iterations[iterationIndex]?.workingDays ?? 0;
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

  if (members.length === 0) {
    return (
      <div className="wizard-step-content">
        <h3>ステップ8: 各人・各イテレーションの稼働日設定</h3>
        <div className="wizard-info-box warning" style={{ marginTop: 16 }}>
          <p>
            メンバーが登録されていないため、このステップはスキップされます。メンバーを登録する場合はステップ7に戻って追加してください。
          </p>
        </div>
      </div>
    );
  }

  if (iterations.length === 0) {
    return (
      <div className="wizard-step-content">
        <h3>ステップ8: 各人・各イテレーションの稼働日設定</h3>
        <div className="wizard-info-box error" role="alert">
          <p>
            イテレーションが登録されていません。ステップ5に戻ってイテレーションを追加してください。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="wizard-step-content">
      <h3>ステップ8: 各人・各イテレーションの稼働日設定</h3>
      <p>
        各メンバー、各イテレーションごとの稼働日を設定できます。未設定の場合はイテレーションの稼働日が使用されます。
      </p>
      <div style={{ marginTop: 24, overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: 600 }}>
          <thead>
            <tr>
              <th>メンバー</th>
              {iterations.map((it: any, idx: number) => (
                <th key={idx} style={{ minWidth: 120 }}>
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
            {members.map((m: any, midx: number) => (
              <tr key={midx}>
                <td style={{ fontWeight: 600 }}>{m.name}</td>
                {iterations.map((it: any, idx: number) => {
                  const wd = getMemberWorkingDays(m.name, idx);
                  const defaultWd = it.workingDays ?? 0;
                  const iterationLabel = formatIterationLabel(it, idx);
                  return (
                    <td key={idx}>
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
  );
};

export default Step8_MemberIterationWorkingDays;
