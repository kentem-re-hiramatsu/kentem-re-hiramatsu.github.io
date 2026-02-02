import React, { useState, useMemo } from "react";
import useStore from "../utils/store";
import { isDone } from "../utils/status";

const TeamVelocity: React.FC = () => {
  const features = useStore((s) => s.features);
  const settings: any = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const [activeIt, setActiveIt] = useState<number | "all">("all");

  // settingsが変更されたときに確実に再計算されるようにuseMemoを使用
  // settingsオブジェクト全体を依存関係にすることで、どの設定が変更されても再計算される
  const iterations: any[] = useMemo(() => {
    return Array.isArray(settings?.iterations) ? [...settings.iterations] : [];
  }, [settings]);
  
  const members: any[] = useMemo(() => {
    return Array.isArray(settings?.members) ? [...settings.members] : [];
  }, [settings]);
  
  // 開始日から年を除いて表示する関数
  const formatDateWithoutYear = (dateStr: string | undefined): string => {
    if (!dateStr) return "-";
    // ISO形式 (YYYY-MM-DD) の場合
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [, month, day] = dateStr.split("-");
      return `${parseInt(month)}月${parseInt(day)}日`;
    }
    // 既に "M月D日" 形式の場合
    if (/^\d{1,2}月\s*\d{1,2}日$/.test(dateStr)) {
      return dateStr;
    }
    // その他の場合はそのまま返す
    return dateStr;
  };
  
  // メンバー・イテレーションごとの稼働日を取得する関数
  const getMemberWorkingDays = (memberName: string, iterationIndex: number): number => {
    const memberIterationWorkingDays = settings?.memberIterationWorkingDays ?? {};
    const memberDays = memberIterationWorkingDays[memberName];
    if (memberDays && typeof memberDays[iterationIndex] === "number") {
      return memberDays[iterationIndex];
    }
    // デフォルトはイテレーションの稼働日
    return iterations[iterationIndex]?.workingDays ?? 0;
  };
  
  // メンバー・イテレーションごとの稼働日を設定する関数
  const setMemberWorkingDays = (memberName: string, iterationIndex: number, workingDays: number) => {
    const memberIterationWorkingDays = settings?.memberIterationWorkingDays ?? {};
    const memberDays = memberIterationWorkingDays[memberName] ?? {};
    memberDays[iterationIndex] = workingDays;
    memberIterationWorkingDays[memberName] = memberDays;
    setSettings({ ...settings, memberIterationWorkingDays });
  };

  const renderTable = () => {
    if (iterations.length === 0) {
      return <div className="import-message">イテレーションが設定されていません。設定画面でイテレーションを追加してください。</div>;
    }

    const visibleIndex = activeIt === "all" ? null : (activeIt as number) - 1;
    
    const getErrors = () => {
      const errors: Array<{ feature: any; reason: string }> = [];
      features.forEach((f) => {
        if (f.iteration) {
          // 全て表示モードまたは選択したイテレーションまでの範囲内の場合
          if (visibleIndex === null || f.iteration <= visibleIndex + 1) {
            if (f.storyPoints !== null && f.storyPoints !== undefined && (typeof f.storyPoints !== "number" || isNaN(f.storyPoints))) {
              errors.push({ feature: f, reason: "ストーリーポイントが数値ではありません" });
            }
          }
        }
      });
      return errors;
    };
    
    const errors = getErrors();

    return (
      <div>
        <table aria-label="チームベロシティ" style={{ marginBottom: 24 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "center" }}>イテレーション名</th>
              <th style={{ textAlign: "center" }}>開始日</th>
              <th style={{ textAlign: "center" }}>稼働日数</th>
              <th style={{ textAlign: "center" }}>目標合計PT</th>
              <th style={{ textAlign: "center" }}>実績合計PT</th>
              <th style={{ textAlign: "center" }}>FE目標PT</th>
              <th style={{ textAlign: "center" }}>FE実績PT</th>
              <th style={{ textAlign: "center" }}>BE目標PT</th>
              <th style={{ textAlign: "center" }}>BE実績PT</th>
              <th style={{ textAlign: "center" }}>テスト目標PT</th>
              <th style={{ textAlign: "center" }}>テスト実績PT</th>
            </tr>
          </thead>
          <tbody>
            {visibleIndex === null ? (
              // 全て表示モード：各イテレーションを個別に表示 + 累積集計行を追加
              <>
                {iterations.map((it: any, idx: number) => {
                  const workingDays = it.workingDays ?? 0;
                  const target = members.reduce((acc, m) => {
                    const memberWd = getMemberWorkingDays(m.name, idx);
                    const plannedVel = typeof m.plannedVelocity === "number" ? m.plannedVelocity : parseFloat(m.plannedVelocity || "0") || 0;
                    return acc + (plannedVel * memberWd);
                  }, 0);
                  const featuresInIt = features.filter((f) => f.iteration === idx + 1);
                  // 実績合計PT: すべての完了済みフィーチャーのストーリーポイントを合計
                  const actual = featuresInIt.reduce((acc, f) => {
                    if (isDone(f, settings, settings?.statusMappings) && typeof f.storyPoints === "number") {
                      return acc + f.storyPoints;
                    }
                    return acc;
                  }, 0);
                  
                  const byRole: Record<string, { target: number; actual: number }> = { FE: { target: 0, actual: 0 }, BE: { target: 0, actual: 0 }, テスト: { target: 0, actual: 0 } };
                  
                  members.forEach((m: any) => {
                    const role = m.role || "FE";
                    if (role === "FE" || role === "BE" || role === "テスト") {
                      const memberWd = getMemberWorkingDays(m.name, idx);
                      const plannedVel = typeof m.plannedVelocity === "number" ? m.plannedVelocity : parseFloat(m.plannedVelocity || "0") || 0;
                      byRole[role].target += plannedVel * memberWd;
                      
                      // 実績PT: このメンバーが担当している完了済みフィーチャーのストーリーポイントを合計
                      const memberFeatures = featuresInIt.filter((f) => {
                        return f.assignee && m.name && (f.assignee.trim() === m.name.trim());
                      });
                      const memberActual = memberFeatures.reduce((acc, f) => {
                        if (isDone(f, settings, settings?.statusMappings) && typeof f.storyPoints === "number") {
                          return acc + f.storyPoints;
                        }
                        return acc;
                      }, 0);
                      byRole[role].actual += memberActual;
                    }
                  });

                  return (
                    <tr key={idx}>
                      <td style={{ textAlign: "center" }}>{it.name ?? `I${idx + 1}`}</td>
                      <td style={{ textAlign: "center" }}>{formatDateWithoutYear(it.start)}</td>
                      <td style={{ textAlign: "center" }}>{workingDays || "-"}</td>
                      <td style={{ textAlign: "center" }}>{target.toFixed(1)}</td>
                      <td style={{ textAlign: "center" }}>{actual}</td>
                      <td style={{ textAlign: "center" }}>{byRole.FE.target.toFixed(1)}</td>
                      <td style={{ textAlign: "center" }}>{byRole.FE.actual}</td>
                      <td style={{ textAlign: "center" }}>{byRole.BE.target.toFixed(1)}</td>
                      <td style={{ textAlign: "center" }}>{byRole.BE.actual}</td>
                      <td style={{ textAlign: "center" }}>{byRole.テスト.target.toFixed(1)}</td>
                      <td style={{ textAlign: "center" }}>{byRole.テスト.actual}</td>
                    </tr>
                  );
                })}
              </>
            ) : (
              // 特定イテレーション選択モード：選択したイテレーション内の集計を表示
              (() => {
                const targetIteration = iterations[visibleIndex];
                if (!targetIteration) return null;

                const idx = visibleIndex;
                const workingDays = targetIteration.workingDays ?? 0;
                const target = members.reduce((acc, m) => {
                  const memberWd = getMemberWorkingDays(m.name, idx);
                  const plannedVel = typeof m.plannedVelocity === "number" ? m.plannedVelocity : parseFloat(m.plannedVelocity || "0") || 0;
                  return acc + (plannedVel * memberWd);
                }, 0);
                const featuresInIt = features.filter((f) => f.iteration === idx + 1);
                // 実績合計PT: すべての完了済みフィーチャーのストーリーポイントを合計
                const actual = featuresInIt.reduce((acc, f) => {
                  if (isDone(f, settings, settings?.statusMappings) && typeof f.storyPoints === "number") {
                    return acc + f.storyPoints;
                  }
                  return acc;
                }, 0);
                
                const byRole: Record<string, { target: number; actual: number }> = { FE: { target: 0, actual: 0 }, BE: { target: 0, actual: 0 }, テスト: { target: 0, actual: 0 } };
                
                members.forEach((m: any) => {
                  const role = m.role || "FE";
                  if (role === "FE" || role === "BE" || role === "テスト") {
                    const memberWd = getMemberWorkingDays(m.name, idx);
                    const plannedVel = typeof m.plannedVelocity === "number" ? m.plannedVelocity : parseFloat(m.plannedVelocity || "0") || 0;
                    byRole[role].target += plannedVel * memberWd;
                    
                    // 実績PT: このメンバーが担当している完了済みフィーチャーのストーリーポイントを合計
                    const memberFeatures = featuresInIt.filter((f) => {
                      return f.assignee && m.name && (f.assignee.trim() === m.name.trim());
                    });
                    const memberActual = memberFeatures.reduce((acc, f) => {
                      if (isDone(f, settings, settings?.statusMappings) && typeof f.storyPoints === "number") {
                        return acc + f.storyPoints;
                      }
                      return acc;
                    }, 0);
                    byRole[role].actual += memberActual;
                  }
                });

                return (
                  <tr key={visibleIndex}>
                    <td style={{ textAlign: "center" }}>{targetIteration.name ?? `I${visibleIndex + 1}`}</td>
                    <td style={{ textAlign: "center" }}>{formatDateWithoutYear(targetIteration.start)}</td>
                    <td style={{ textAlign: "center" }}>{workingDays || "-"}</td>
                    <td style={{ textAlign: "center" }}>{target.toFixed(1)}</td>
                    <td style={{ textAlign: "center" }}>{actual}</td>
                    <td style={{ textAlign: "center" }}>{byRole.FE.target.toFixed(1)}</td>
                    <td style={{ textAlign: "center" }}>{byRole.FE.actual}</td>
                    <td style={{ textAlign: "center" }}>{byRole.BE.target.toFixed(1)}</td>
                    <td style={{ textAlign: "center" }}>{byRole.BE.actual}</td>
                    <td style={{ textAlign: "center" }}>{byRole.テスト.target.toFixed(1)}</td>
                    <td style={{ textAlign: "center" }}>{byRole.テスト.actual}</td>
                  </tr>
                );
              })()
            )}
          </tbody>
        </table>

        <div>
          <h4>個人目標・実績</h4>
          {visibleIndex === null && (
            <div style={{ marginBottom: 16, display: "flex", gap: 16, alignItems: "center" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span>開始イテレーション:</span>
                <select
                  value={settings?.allMembersIterationRange?.startIteration ?? 1}
                  onChange={(e) => {
                    const currentSettings = useStore.getState().settings;
                    const currentRange = currentSettings?.allMembersIterationRange ?? {};
                    setSettings({
                      ...currentSettings,
                      allMembersIterationRange: {
                        ...currentRange,
                        startIteration: Number(e.target.value),
                      },
                    });
                  }}
                >
                  {iterations.map((it: any, idx: number) => (
                    <option key={idx} value={idx + 1}>
                      {it.name ?? `I${idx + 1}`}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span>終了イテレーション:</span>
                <select
                  value={settings?.allMembersIterationRange?.endIteration ?? iterations.length}
                  onChange={(e) => {
                    const currentSettings = useStore.getState().settings;
                    const currentRange = currentSettings?.allMembersIterationRange ?? {};
                    setSettings({
                      ...currentSettings,
                      allMembersIterationRange: {
                        ...currentRange,
                        endIteration: Number(e.target.value),
                      },
                    });
                  }}
                >
                  {iterations.map((it: any, idx: number) => (
                    <option key={idx} value={idx + 1}>
                      {it.name ?? `I${idx + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          <table aria-label="個人ベロシティ">
            <thead>
              <tr>
                <th style={{ textAlign: "center" }}>メンバー</th>
                <th style={{ textAlign: "center" }}>担当</th>
                <th style={{ textAlign: "center" }}>計画ベロシティ (pt/day)</th>
                <th style={{ textAlign: "center" }}>稼働日</th>
                <th style={{ textAlign: "center" }}>目標PT</th>
                <th style={{ textAlign: "center" }}>実績PT</th>
                <th style={{ textAlign: "center" }}>実績ベロシティ</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m: any, midx: number) => {
                let cumulativeWd = 0;
                let cumulativeTargetPT = 0;
                let cumulativeActualPT = 0;

                if (visibleIndex === null) {
                  // 全てタブ：指定したイテレーション範囲の累積集計
                  const allMembersRange = settings?.allMembersIterationRange ?? {};
                  const startIteration = allMembersRange.startIteration ?? 1;
                  const endIteration = allMembersRange.endIteration ?? iterations.length;
                  
                  // 範囲を調整
                  const validStartIteration = Math.max(1, Math.min(startIteration, iterations.length));
                  const validEndIteration = Math.max(validStartIteration, Math.min(endIteration, iterations.length));
                  
                  const startIdx = validStartIteration - 1;
                  const endIdx = validEndIteration - 1;

                  // startIdxからendIdxまでの累積を計算
                  for (let idx = startIdx; idx <= endIdx && idx < iterations.length; idx++) {
                    const memberWd = getMemberWorkingDays(m.name, idx);
                    cumulativeWd += memberWd;
                    
                    const plannedVel = typeof m.plannedVelocity === "number" ? m.plannedVelocity : parseFloat(m.plannedVelocity || "0") || 0;
                    cumulativeTargetPT += plannedVel * memberWd;

                    // 実績PTの累積
                    const memberFeatures = features.filter((f) => {
                      const assigneeMatch = f.assignee && m.name && (f.assignee.trim() === m.name.trim());
                      return f.iteration === idx + 1 && assigneeMatch;
                    });
                    memberFeatures.forEach((f) => {
                      if (isDone(f, settings, settings?.statusMappings) && typeof f.storyPoints === "number") {
                        cumulativeActualPT += f.storyPoints;
                      }
                    });
                  }
                } else {
                  // 特定イテレーション選択時：そのイテレーション内の集計のみ
                  const idx = visibleIndex;
                  const memberWd = getMemberWorkingDays(m.name, idx);
                  cumulativeWd = memberWd;
                  
                  const plannedVel = typeof m.plannedVelocity === "number" ? m.plannedVelocity : parseFloat(m.plannedVelocity || "0") || 0;
                  cumulativeTargetPT = plannedVel * memberWd;

                  // 実績PT
                  const memberFeatures = features.filter((f) => {
                    const assigneeMatch = f.assignee && m.name && (f.assignee.trim() === m.name.trim());
                    return f.iteration === idx + 1 && assigneeMatch;
                  });
                  memberFeatures.forEach((f) => {
                    if (isDone(f, settings, settings?.statusMappings) && typeof f.storyPoints === "number") {
                      cumulativeActualPT += f.storyPoints;
                    }
                  });
                }

                // 実績ベロシティ = 実績PT / 稼働日
                const actualVelocity = cumulativeWd > 0 ? cumulativeActualPT / cumulativeWd : 0;

                const plannedVel = typeof m.plannedVelocity === "number" ? m.plannedVelocity : parseFloat(m.plannedVelocity || "0") || 0;

                return (
                  <tr key={midx}>
                    <td style={{ textAlign: "center" }}>{m.name}</td>
                    <td style={{ textAlign: "center" }}>{m.role || "FE"}</td>
                    <td style={{ textAlign: "center" }}>{plannedVel.toFixed(2)}</td>
                    <td style={{ textAlign: "center" }}>{cumulativeWd}</td>
                    <td style={{ textAlign: "center" }}>{cumulativeTargetPT.toFixed(1)}</td>
                    <td style={{ textAlign: "center" }}>{cumulativeActualPT}</td>
                    <td style={{ textAlign: "center" }}>{cumulativeWd > 0 ? actualVelocity.toFixed(2) : "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {errors.length > 0 && (
          <div style={{ marginTop: 24, padding: 12, background: "var(--error-light)", borderRadius: 4, border: "1px solid var(--error)" }}>
            <h4 style={{ marginTop: 0, color: "var(--error-dark)" }}>集計除外・エラー行</h4>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {errors.map((e, eidx) => (
                <li key={eidx} style={{ marginBottom: 4 }}>
                  <strong>{e.feature.title || e.feature.id}</strong>: {e.reason}
                  {e.feature.iteration && ` (イテレーション ${e.feature.iteration})`}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div style={{ marginBottom: "var(--space-xl)" }}>
        <nav className="iteration-tabs" aria-label="イテレーションタブ" role="tablist">
          <button
            type="button"
            onClick={() => setActiveIt("all")}
            aria-pressed={activeIt === "all"}
            className="iteration-tab-button"
          >
            全て
          </button>
          {iterations.map((it: any, idx: number) => (
            <button
              key={idx}
              onClick={() => setActiveIt(idx + 1)}
              type="button"
              aria-pressed={activeIt === idx + 1}
              className="iteration-tab-button"
            >
              {it.name ?? `I${idx + 1}`}
            </button>
          ))}
        </nav>
      </div>
      {renderTable()}
    </div>
  );
};

export default TeamVelocity;

