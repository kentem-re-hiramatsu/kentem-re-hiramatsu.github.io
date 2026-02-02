import React, { useMemo, useState } from "react";
import useStore from "../utils/store";
import { computeIterationAggregates, truncate2, normalizeCategory } from "../utils/aggregate";

const isDoneByStatus = (status: string | undefined, includePR: boolean) => {
  if (!status) return false;
  const s = status.toString();
  if (s === "完了" || s.toLowerCase() === "done") return true;
  if (includePR && (s === "プルリク中" || s === "in_pr")) return true;
  return false;
};

const categories = ["全体", "FE", "BE", "テスト"];

const ProgressBoard: React.FC = () => {
  const features = useStore((s) => s.features);
  const settings: any = useStore((s) => s.settings);
  const includePR = !!settings?.includePRinDone;

  const [selectedIteration, setSelectedIteration] = useState<number>(1);

  const iterations = settings?.iterations ?? [];

  const aggregates = useMemo(() => computeIterationAggregates(features, settings), [features, settings]);

  // 全ストーリーポイント：すべてのタスクの合計（破棄を除く）
  const allTotalPoints = useMemo(() => {
    const statusMappings = settings?.statusMappings;
    const validFeatures = features.filter((f) => {
      const mappedStatus = (statusMappings && statusMappings[f.status ?? ""]) ?? f.status ?? "";
      return mappedStatus !== "破棄";
    });
    return validFeatures.reduce((acc, f) => acc + (typeof f.storyPoints === "number" ? f.storyPoints : 0), 0);
  }, [features, settings?.statusMappings]);

  // カテゴリ別の全ストーリーポイント
  const allCategoryPoints = useMemo(() => {
    const statusMappings = settings?.statusMappings;
    const validFeatures = features.filter((f) => {
      const mappedStatus = (statusMappings && statusMappings[f.status ?? ""]) ?? f.status ?? "";
      return mappedStatus !== "破棄";
    });
    const categoryPoints: Record<string, { total: number; done: number }> = { FE: { total: 0, done: 0 }, BE: { total: 0, done: 0 }, テスト: { total: 0, done: 0 } };
    validFeatures.forEach((f) => {
      const sp = typeof f.storyPoints === "number" ? f.storyPoints : 0;
      const cat = normalizeCategory(f.category);
      if (cat === "FE" || cat === "BE" || cat === "テスト") {
        categoryPoints[cat].total += sp;
      }
    });
    return categoryPoints;
  }, [features, settings?.statusMappings]);

  const rows = useMemo(() => {
    const idx = selectedIteration - 1;
    // 完了ポイント：そのイテレーションまでの累積完了ポイント
    const cumulativeDonePoints = aggregates.slice(0, idx + 1).reduce((acc, it) => acc + it.donePoints, 0);
    // カテゴリ別の累積完了ポイント
    const cumulativeCategoryDonePoints: Record<string, number> = { FE: 0, BE: 0, テスト: 0 };
    aggregates.slice(0, idx + 1).forEach((it) => {
      cumulativeCategoryDonePoints.FE += it.categoryPoints.FE?.done ?? 0;
      cumulativeCategoryDonePoints.BE += it.categoryPoints.BE?.done ?? 0;
      cumulativeCategoryDonePoints.テスト += it.categoryPoints.テスト?.done ?? 0;
    });
    
    return {
      totals: {
        totalPoints: allTotalPoints,
        donePoints: cumulativeDonePoints,
      },
      byCategory: {
        FE: { total: allCategoryPoints.FE.total, done: cumulativeCategoryDonePoints.FE },
        BE: { total: allCategoryPoints.BE.total, done: cumulativeCategoryDonePoints.BE },
        テスト: { total: allCategoryPoints.テスト.total, done: cumulativeCategoryDonePoints.テスト },
      },
    };
  }, [aggregates, selectedIteration, allTotalPoints, allCategoryPoints]);

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

  // 予定ポイント：チームベロシティの目標合計PTと同じ計算方法
  // 各メンバーの plannedVelocity × 個人の稼働日 を累積で合算
  const plannedConsume = (() => {
    const idx = selectedIteration - 1;
    const members = settings?.members ?? [];
    let total = 0;
    for (let i = 0; i <= idx && i < iterations.length; i++) {
      const iterationTarget = members.reduce((acc: number, m: any) => {
        const memberWd = getMemberWorkingDays(m.name || "", i);
        const plannedVel = typeof m.plannedVelocity === "number" ? m.plannedVelocity : parseFloat(m.plannedVelocity || "0") || 0;
        return acc + (plannedVel * memberWd);
      }, 0);
      total += iterationTarget;
    }
    return total;
  })();

  // カテゴリ別（FE、BE、テスト）の予定ポイント
  const categoryPlannedPoints = useMemo(() => {
    const idx = selectedIteration - 1;
    const members = settings?.members ?? [];
    const byCategory: Record<string, number> = { FE: 0, BE: 0, テスト: 0 };
    
    for (let i = 0; i <= idx && i < iterations.length; i++) {
      members.forEach((m: any) => {
        const role = m.role || "FE";
        if (role === "FE" || role === "BE" || role === "テスト") {
          const memberWd = getMemberWorkingDays(m.name || "", i);
          const plannedVel = typeof m.plannedVelocity === "number" ? m.plannedVelocity : parseFloat(m.plannedVelocity || "0") || 0;
          byCategory[role] += plannedVel * memberWd;
        }
      });
    }
    
    return byCategory;
  }, [selectedIteration, settings?.members, settings?.memberIterationWorkingDays, iterations]);

  const plannedProgress = rows.totals.totalPoints > 0 ? (plannedConsume / rows.totals.totalPoints) * 100 : 0;
  const actualProgress = rows.totals.totalPoints > 0 ? (rows.totals.donePoints / rows.totals.totalPoints) * 100 : 0;
  const deltaPoints = rows.totals.donePoints - plannedConsume;

  // カテゴリ別の予定進捗率、実施進捗率、誤差ポイント
  const categoryProgress = useMemo(() => {
    const result: Record<string, { planned: number; actual: number; delta: number }> = {
      FE: { planned: 0, actual: 0, delta: 0 },
      BE: { planned: 0, actual: 0, delta: 0 },
      テスト: { planned: 0, actual: 0, delta: 0 },
    };
    
    (["FE", "BE", "テスト"] as const).forEach((cat) => {
      const total = rows.byCategory?.[cat]?.total ?? 0;
      const done = rows.byCategory?.[cat]?.done ?? 0;
      const planned = categoryPlannedPoints[cat] ?? 0;
      
      result[cat].planned = total > 0 ? (planned / total) * 100 : 0;
      result[cat].actual = total > 0 ? (done / total) * 100 : 0;
      result[cat].delta = done - planned;
    });
    
    return result;
  }, [rows.byCategory, categoryPlannedPoints]);

  return (
    <div>
      <div style={{ marginBottom: "var(--space-xl)" }}>
        <nav className="iteration-tabs" aria-label="イテレーションタブ" role="tablist">
          {iterations.map((it: any, idx: number) => (
            <button
              key={idx}
              type="button"
              onClick={() => setSelectedIteration(idx + 1)}
              aria-pressed={selectedIteration === idx + 1}
              className="iteration-tab-button"
            >
              {it.name ?? `I${idx + 1}`}
            </button>
          ))}
        </nav>
      </div>

      <table aria-label="進捗管理" style={{ fontSize: "var(--font-size-2xl)" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "center" }}>区分</th>
            <th style={{ textAlign: "center" }}>全ストーリーポイント</th>
            <th style={{ textAlign: "center" }}>予定ポイント</th>
            <th style={{ textAlign: "center" }}>完了ポイント</th>
            <th style={{ textAlign: "center" }}>予定進捗率</th>
            <th style={{ textAlign: "center" }}>実施進捗率</th>
            <th style={{ textAlign: "center" }}>誤差ポイント</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ textAlign: "center" }}>全体</td>
            <td style={{ textAlign: "center" }}>{rows.totals.totalPoints}</td>
            <td style={{ textAlign: "center" }}>{truncate2(plannedConsume)}</td>
            <td style={{ textAlign: "center" }}>{rows.totals.donePoints}</td>
            <td style={{ textAlign: "center" }} aria-label="予定進捗率">{truncate2(plannedProgress).toFixed(2)}%</td>
            <td style={{ textAlign: "center" }} aria-label="実施進捗率">{truncate2(actualProgress).toFixed(2)}%</td>
            <td style={{ textAlign: "center" }} aria-label="誤差ポイント">
              <span
                style={{
                  fontWeight: 600,
                  color: deltaPoints < 0 ? "var(--error-dark)" : deltaPoints > 0 ? "var(--success-dark)" : "var(--text)",
                }}
              >
                {truncate2(deltaPoints)}
              </span>
            </td>
          </tr>
          {(["FE", "BE", "テスト"] as const).map((cat) => {
            const delta = categoryProgress[cat].delta;
            return (
              <tr key={cat}>
                <td style={{ textAlign: "center" }}>{cat}</td>
                <td style={{ textAlign: "center" }}>{rows.byCategory?.[cat]?.total ?? 0}</td>
                <td style={{ textAlign: "center" }}>{truncate2(categoryPlannedPoints[cat])}</td>
                <td style={{ textAlign: "center" }}>{rows.byCategory?.[cat]?.done ?? 0}</td>
                <td style={{ textAlign: "center" }} aria-label="予定進捗率">{truncate2(categoryProgress[cat].planned).toFixed(2)}%</td>
                <td style={{ textAlign: "center" }} aria-label="実施進捗率">{truncate2(categoryProgress[cat].actual).toFixed(2)}%</td>
                <td style={{ textAlign: "center" }} aria-label="誤差ポイント">
                  <span
                    style={{
                      fontWeight: 600,
                      color: delta < 0 ? "var(--error-dark)" : delta > 0 ? "var(--success-dark)" : "var(--text)",
                    }}
                  >
                    {truncate2(delta)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {(() => {
        const errors: Array<{ feature: any; reason: string }> = [];
        const visibleIterations = [selectedIteration];
        features.forEach((f) => {
          if (f.iteration && visibleIterations.includes(f.iteration)) {
            if (f.storyPoints !== null && f.storyPoints !== undefined && (typeof f.storyPoints !== "number" || isNaN(f.storyPoints))) {
              errors.push({ feature: f, reason: "ストーリーポイントが数値ではありません" });
            }
          }
        });
        if (errors.length > 0) {
          return (
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
          );
        }
        return null;
      })()}
    </div>
  );
};

export default ProgressBoard;

