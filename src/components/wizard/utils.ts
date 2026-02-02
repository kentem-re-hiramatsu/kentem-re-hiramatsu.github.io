import { Feature } from "../../utils/store";

/**
 * カテゴリを正規化する関数
 * aggregate.tsと同じロジック
 */
export function normalizeCategory(cat: string): string {
  if (!cat) return "";
  // 括弧を除去: (FE) -> FE, (BE) -> BE, (テスト) -> テスト
  let normalized = cat.trim();
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
  return normalized.toUpperCase();
}

/**
 * カテゴリからロールを推測する関数
 */
export function inferRoleFromCategory(categories: Set<string>): string {
  if (categories.size === 0) {
    return "FE"; // デフォルト
  }

  const categoryArray = Array.from(categories);
  const normalizedCategories = categoryArray.map(normalizeCategory);

  // 正規化後のcategoryをカウント
  const categoryCounts: Record<string, number> = {};
  normalizedCategories.forEach((cat) => {
    if (cat) {
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    }
  });

  // 最も多く出現するcategoryを取得
  const mostCommonCategory =
    Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "";

  // 完全一致で判定（優先順位: FE > BE > テスト）
  if (mostCommonCategory === "FE" || /^FE$/i.test(mostCommonCategory)) {
    return "FE";
  }
  if (mostCommonCategory === "BE" || /^BE$/i.test(mostCommonCategory)) {
    return "BE";
  }
  if (
    mostCommonCategory === "テスト" ||
    /^テスト$/i.test(mostCommonCategory) ||
    /^TEST$/i.test(mostCommonCategory)
  ) {
    return "テスト";
  }

  // 部分一致で判定
  if (/FE|フロント|FRONTEND/i.test(mostCommonCategory)) {
    return "FE";
  }
  if (/BE|バック|BACKEND/i.test(mostCommonCategory)) {
    return "BE";
  }
  if (/テスト|TEST/i.test(mostCommonCategory)) {
    return "テスト";
  }

  // デフォルトは"FE"
  return "FE";
}

/**
 * TSV行を正規化する関数（セル数をヘッダー数に合わせる）
 */
export function normalizeRow(cells: string[], headerCount: number): string[] {
  const normalized = [...cells];
  // セル数がヘッダーより少ない場合は、空文字列で埋める
  while (normalized.length < headerCount) {
    normalized.push("");
  }
  // セル数がヘッダーより多い場合は切り詰める
  return normalized.slice(0, headerCount);
}

/**
 * マッピングに基づいてフィールドを取得する関数
 */
export function getField(
  row: string[],
  headers: string[],
  headerMapping: Record<string, string>,
  fieldName: string
): string {
  const mappedHeader = headerMapping[fieldName];
  if (!mappedHeader) return "";
  const idx = headers.indexOf(mappedHeader);
  if (idx < 0) return "";
  return (row[idx] ?? "").trim();
}

/**
 * TSVデータをパースしてFeature配列に変換する
 */
export function parseTSVToFeatures(
  tsvRawData: { headers: string[]; rows: string[][] },
  headerMapping: Record<string, string>
): Feature[] {
  const parsed: Feature[] = [];
  const headers = tsvRawData.headers;
  const headerCount = headers.length;
  const rows = tsvRawData.rows;

  // assigneeとcategoryのマッピングを収集（担当を推測するため）
  const assigneeCategoryMap = new Map<string, Set<string>>();

  rows.forEach((cells: string[], rowIndex: number) => {
    // セル数をヘッダー数に合わせて正規化
    const normalizedCells = normalizeRow(cells, headerCount);

    let title = getField(normalizedCells, headers, headerMapping, "title");
    // titleが空の場合は、デフォルト値として行番号や他の情報を使用
    if (!title) {
      const category = getField(
        normalizedCells,
        headers,
        headerMapping,
        "category"
      );
      const status = getField(
        normalizedCells,
        headers,
        headerMapping,
        "status"
      );
      // カテゴリやステータスがあればそれを使用、なければ行番号を使用
      title = category || status || `行${rowIndex + 1}`;
    }

    const category = getField(
      normalizedCells,
      headers,
      headerMapping,
      "category"
    );
    const storyPointsRaw = getField(
      normalizedCells,
      headers,
      headerMapping,
      "storyPoints"
    );
    const estimatedRaw = getField(
      normalizedCells,
      headers,
      headerMapping,
      "estimatedHours"
    );
    const actualRaw = getField(
      normalizedCells,
      headers,
      headerMapping,
      "actualHours"
    );
    const iterationRaw = getField(
      normalizedCells,
      headers,
      headerMapping,
      "iteration"
    );
    const status = getField(
      normalizedCells,
      headers,
      headerMapping,
      "status"
    );
    const assigneeRaw = getField(
      normalizedCells,
      headers,
      headerMapping,
      "assignee"
    );

    // 複数担当者の処理（カンマ区切りなど）
    let assignee = assigneeRaw;
    if (assigneeRaw && /[,、;\/]/.test(assigneeRaw)) {
      // 複数担当者がいる場合、すべてを収集
      const assignees = assigneeRaw
        .split(/[,、;\/]/)
        .map((a) => a.trim())
        .filter(Boolean);
      assignees.forEach((a) => {
        if (!assigneeCategoryMap.has(a)) {
          assigneeCategoryMap.set(a, new Set<string>());
        }
        if (category) {
          assigneeCategoryMap.get(a)!.add(category);
        }
      });
      assignee = assignees[0]; // 最初の担当者を使用
    } else if (assigneeRaw && assigneeRaw.trim()) {
      const assigneeName = assigneeRaw.trim();
      if (!assigneeCategoryMap.has(assigneeName)) {
        assigneeCategoryMap.set(assigneeName, new Set<string>());
      }
      if (category) {
        assigneeCategoryMap.get(assigneeName)!.add(category);
      }
    }

    const storyPoints = storyPointsRaw === "" ? null : Number(storyPointsRaw);
    const estimatedHours = estimatedRaw === "" ? null : Number(estimatedRaw);
    const actualHours = actualRaw === "" ? null : Number(actualRaw);
    const iteration = iterationRaw === "" ? null : Number(iterationRaw);

    // 数値変換のバリデーション
    if (storyPointsRaw !== "" && Number.isNaN(storyPoints)) return;
    if (estimatedRaw !== "" && Number.isNaN(estimatedHours)) return;
    if (actualRaw !== "" && Number.isNaN(actualHours)) return;
    if (iterationRaw !== "" && Number.isNaN(iteration)) return;

    parsed.push({
      id: `${rowIndex}-${title}`,
      title,
      category: category || undefined,
      storyPoints: storyPoints ?? undefined,
      estimatedHours: estimatedHours ?? undefined,
      actualHours: actualHours ?? undefined,
      iteration: iteration ?? undefined,
      status: status || undefined,
      assignee: assignee || undefined,
    });
  });

  return parsed;
}

/**
 * assigneeとcategoryからmembersを抽出する
 */
export function extractMembersFromAssignees(
  assigneeCategoryMap: Map<string, Set<string>>
): Array<{ name: string; role: string; plannedVelocity: number }> {
  return Array.from(assigneeCategoryMap.entries())
    .map(([name, categories]) => {
      const role = inferRoleFromCategory(categories);
      return {
        name: name.trim(),
        role: role,
        plannedVelocity: 0,
      };
    })
    .filter((item) => item.name);
}

/**
 * ヘッダーを正規化する関数
 */
export function normalizeHeader(h: string): string {
  return h.replace(/\s+/g, "").toLowerCase();
}

/**
 * TSVヘッダーを自動マッピングする関数
 */
export function autoMapHeaders(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  headers.forEach((h) => {
    const normalized = normalizeHeader(h);
    // title
    if (normalized === "title" || normalized.includes("タイトル")) {
      if (!mapping.title) mapping.title = h;
    }
    // status
    if (
      normalized === "status" ||
      normalized.includes("ステータス") ||
      normalized.includes("状態")
    ) {
      if (!mapping.status) mapping.status = h;
    }
    // iteration
    if (
      normalized.includes("iteration") ||
      normalized.includes("イテレーション")
    ) {
      if (!mapping.iteration) mapping.iteration = h;
    }
    // category
    if (normalized.includes("category") || normalized.includes("分類")) {
      if (!mapping.category) mapping.category = h;
    }
    // storyPoints - 優先順位: ポイント > 予測ポイント
    if (normalized === "ポイント" || normalized === "point") {
      if (!mapping.storyPoints) mapping.storyPoints = h;
    }
    if (
      normalized.includes("storypoint") ||
      normalized.includes("予測ポイント")
    ) {
      if (!mapping.storyPoints) mapping.storyPoints = h;
    }
    // estimatedHours
    if (
      normalized.includes("estimated") ||
      normalized.includes("予定時間") ||
      normalized.includes("見積")
    ) {
      if (!mapping.estimatedHours) mapping.estimatedHours = h;
    }
    // actualHours
    if (
      normalized.includes("actual") ||
      normalized.includes("実績時間") ||
      normalized.includes("実績")
    ) {
      if (!mapping.actualHours) mapping.actualHours = h;
    }
    // assignee
    if (
      normalized.includes("assignee") ||
      normalized.includes("担当") ||
      normalized === "assignees"
    ) {
      if (!mapping.assignee) mapping.assignee = h;
    }
  });
  return mapping;
}
