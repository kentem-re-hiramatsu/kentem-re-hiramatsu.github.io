# Iteration 正規化ルール仕様

## 概要

イテレーション（スプリント）データの正規化ルールを定義します。

## 基本原則

### 1. 識別方式：「名前ベース」を採用

- **選択**: `name` 属性で識別
- **理由**: インデックス（0, 1, 2...）よりも意図的で保守性が高い
- **例**: "Sprint 1", "Sprint 2", "iteration-2025-Q1"

### 2. 日付フォーマット

#### 必須フォーマット

```
YYYY-MM-DD（ISO 8601 形式）
```

#### 入力時の許容フォーマット

- `2025-01-01` （ハイフン区切り）
- `2025/01/01` （スラッシュ区切り）
- `2025-1-1` （ゼロパディング不要）

#### 正規化ルール

すべての日付は **YYYY-MM-DD** に統一

#### 実装例

```typescript
// 入力: "2025/1/15"
// 出力: "2025-01-15"
const normalizeDate = (dateStr: string): string => {
  const normalized = dateStr.replace(/\//g, "-");
  const parts = normalized.split("-");
  const [year, month, day] = parts;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
};
```

### 3. 稼働日計算

#### 定義

- **稼働日**: 土日を除いた日数
- **最小値**: 1 日以上

#### 終了日の計算ロジック

```typescript
const calculateIterationEndDate = (
  startDate: string,
  workingDays: number,
): string => {
  const start = new Date(startDate);
  let current = new Date(start);
  let count = 0;

  // startDate から workingDays 分進める（土日スキップ）
  while (count < workingDays) {
    current.setDate(current.getDate() + 1);
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
  }

  return current.toISOString().split("T")[0];
};
```

#### 例

- startDate: `2025-01-20` (月)
- workingDays: `5`
- 計算:
  - 21(火) → count=1
  - 22(水) → count=2
  - 23(木) → count=3
  - 24(金) → count=4
  - 25(土) → スキップ
  - 26(日) → スキップ
  - 27(月) → count=5
- 終了日: `2025-01-27` (月)

### 4. Iteration データ構造

```typescript
interface Iteration {
  name: string; // "Sprint 1", "Q1", etc.
  startDate: string; // "2025-01-01"
  workingDays: number; // 1 以上
}
```

### 5. イテレーション割り当てロジック（Feature との関連）

#### ルール

- Feature の `iteration` フィールドはイテレーションの **name** で指定
- 大文字小文字を区別しない比較を使用

#### 例

```typescript
// feature の iteration = "sprint 1"
// Settings の iteration = { name: "Sprint 1", ... }
// → マッチング時は大文字小文字を無視して比較

const isIterationMatched = (
  featureIteration: string,
  settingIteration: Iteration,
): boolean => {
  return featureIteration.toLowerCase() === settingIteration.name.toLowerCase();
};
```

## バリデーションルール

### 入力値検証

| フィールド    | ルール          | エラーメッセージ                      |
| ------------- | --------------- | ------------------------------------- |
| `name`        | 空でない文字列  | "名前は必須です"                      |
| `startDate`   | YYYY-MM-DD 形式 | "日付形式が正しくありません"          |
| `workingDays` | 整数かつ ≥ 1    | "稼働日は 1 以上である必要があります" |

### 重複チェック

- イテレーション名の重複は **許可しない**（設定上重複チェック）
- エラーメッセージ: "イテレーション '{name}' は既に存在します"

## 実装

### ファイル構成

```
src/
├── utils/
│   └── iterationParser.ts
└── @types/
    └── index.ts (Iteration インターフェース)
```

### パーサ API

```typescript
// 単一行パース
parseIterationLine(line: string): ParsedIteration | null

// 複数行パース
parseIterations(text: string): { valid: ParsedIteration[]; errors: string[] }

// 終了日計算
calculateIterationEndDate(startDate: string, workingDays: number): string
```

## 例：TSV インポート

### 入力 TSV（初期設定）

```
Name    StartDate    WorkingDays
Sprint 1    2025-01-06    10
Sprint 2    2025-01-20    10
```

### パース結果

```typescript
[
  { name: "Sprint 1", startDate: "2025-01-06", workingDays: 10 },
  { name: "Sprint 2", startDate: "2025-01-20", workingDays: 10 },
];
```

## 今後の拡張

### 検討項目

- [ ] イテレーションのタイプ分類（Sprint, Release, Milestone）
- [ ] 休日設定（年間カレンダー）
- [ ] イテレーション間の「ギャップ期間」対応
- [ ] インデックスベースの識別への対応（後方互換性）

---

**決定日**: 2025-01-31
**ステータス**: 確定
