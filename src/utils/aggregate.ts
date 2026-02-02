import { Feature } from "./store";

type IterationAggregate = {
  iterationIndex: number;
  iterationName?: string;
  start?: string;
  end?: string;
  workingDays: number;
  totalPoints: number;
  donePoints: number;
  categoryPoints: Record<string, { total: number; done: number }>;
  plannedPoints: number;
};

export function truncate2(value: number): number {
  return Math.floor(value * 100) / 100;
}

// 分類を正規化する関数
export function normalizeCategory(cat: string | undefined): string {
  if (!cat) return "";
  // 括弧を除去: (FE) -> FE, (BE) -> BE, (テスト) -> テスト
  let normalized = cat;
  if (normalized.startsWith("(") && normalized.endsWith(")")) {
    normalized = normalized.slice(1, -1);
  }
  // 半角カタカナを全角に変換: ﾃｽﾄ -> テスト
  const halfToFull: Record<string, string> = {
    "ﾃ": "テ",
    "ｽ": "ス",
    "ﾄ": "ト",
  };
  normalized = normalized.replace(/[ﾃｽﾄ]/g, (char) => halfToFull[char] || char);
  return normalized;
}

export function computeIterationAggregates(features: Feature[], settings: any): IterationAggregate[] {
  const iterations: any[] = settings?.iterations ?? [];
  const members: any[] = settings?.members ?? [];
  const statusMappings = settings?.statusMappings;

  // statusが「破棄」のフィーチャーを除外
  const validFeatures = features.filter((f) => {
    const mappedStatus = (statusMappings && statusMappings[f.status ?? ""]) ?? f.status ?? "";
    return mappedStatus !== "破棄";
  });

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

  const result: IterationAggregate[] = iterations.map((it, idx) => {
    const workingDays = Number(it.workingDays || 0);
    const featuresInIt = validFeatures.filter((f) => f.iteration === idx + 1);
    const categoryPoints: Record<string, { total: number; done: number }> = { FE: { total: 0, done: 0 }, BE: { total: 0, done: 0 }, テスト: { total: 0, done: 0 } };

    let totalPoints = 0;
    let donePoints = 0;

    for (const f of featuresInIt) {
      const sp = typeof f.storyPoints === "number" ? f.storyPoints : 0;
      totalPoints += sp;
      const mappedStatus = (statusMappings && statusMappings[f.status ?? ""]) ?? f.status ?? "";
      const isDone =
        mappedStatus === "完了" || (settings?.includePRinDone && (mappedStatus === "プルリク中" || mappedStatus === "in_pr"));
      if (isDone) donePoints += sp;
      const cat = normalizeCategory(f.category);
      if (cat === "FE" || cat === "BE" || cat === "テスト") {
        categoryPoints[cat].total += sp;
        if (isDone) categoryPoints[cat].done += sp;
      }
    }

    // plannedPoints: sum members plannedVelocity * workingDays (per-iteration)
    // メンバー・イテレーションごとの稼働日を使用
    const plannedPoints = members.reduce((acc, m) => {
      const pv = Number(m.plannedVelocity || 0);
      const memberWd = getMemberWorkingDays(m.name || "", idx);
      return acc + pv * Number(memberWd || 0);
    }, 0);

    return {
      iterationIndex: idx + 1,
      iterationName: it.name,
      start: it.start,
      end: it.end,
      workingDays,
      totalPoints,
      donePoints,
      categoryPoints,
      plannedPoints,
    };
  });

  return result;
}

