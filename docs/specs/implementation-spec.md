# 実装方針（Implementation）

含まれる項目：

- コンポーネント設計（責務、props/state、再利用方針）
- 状態管理とデータ取得方針
- ローディング・エラー表示の扱い
- データ設計（TypeScript の型定義）
- 実装方針（ファイル・ディレクトリ・段階導入）
- コンポーネント設計（責務、props/state、再利用方針）
- 状態管理とデータ取得方針（`zustand` 採用）
- ローディング・エラー表示の扱い
- データ設計（TypeScript の型定義）
- 実装方針（ファイル・ディレクトリ・段階導入）
- テスト: 本プロジェクトではテストは行わない

1. コンポーネント設計

方針：UI は責務ごとに分割する。`components/ui/` は純粋な見た目（プレゼンテーショナル）コンポーネント、`components/layout/` は画面骨組み、`components/feature/` は状態や副作用を持つ機能コンポーネントとする。

責務と例：

- プレゼンテーショナル（`components/ui/`）
  - `Button`, `Input`, `Card`, `Table`, `Modal` など。props は DOM 属性とスタイルに限定し、副作用を持たない。再利用性重視。

- レイアウト（`components/layout/`）
  - `Header`, `Sidebar`, `PageLayout`, `Footer`。アプリ全体の配置とアクセシビリティ（ランドマーク、キーボードフォーカス）を提供。

- 機能コンポーネント（`components/feature/`）
  - `theme/ThemeToggle.tsx`, `theme/useTheme.ts`：テーマ切替ロジック（zustand 経由）、トグル UI を組み合わせる。
  - `feature/FileImporter.tsx`：ファイル選択、TSV パースの起動、パース中の進捗表示。props: `onImport(result: ImportResult)` を受け取る。
  - `feature/FeatureTable.tsx`：フィーチャーの一覧表示。フィルタ/ソートの UI を含み、必要に応じて `featuresStore` を参照／更新する。
  - `feature/ProjectSummary.tsx`：集計カード類（FE/BE/テスト等）。読み取り専用だがエクスポートや詳細リンクを持つ場合は props で制御する。
  - `feature/IterationCard.tsx`：イテレーションごとの統計（目標/実績/稼働日数）。
  - `feature/ProgressBoard.tsx`：集計テーブルの表示。

設計ルール（短め）:

- UI コンポーネントは副作用を持たない。状態は props または context（小さな local state は可）で受け渡す。
- 機能コンポーネントは `stores/*Store.ts`（zustand）を直接参照して良いが、外部に公開する API としては props 経由でのテスト容易性を意識する。
- すべてのインタラクションはキーボード操作で操作可能にする（aria 属性を付与）。

2. 状態管理とデータ取得

-- グローバルな状態管理は `zustand` を採用する。アプリ設定（`settingsStore`）の永続化・移行は初期設定 JSON のインポート/エクスポートで行う方針とし、`localStorage` は使用しない。

- 外部 API は使用しない。TSV の読み込み・パースはクライアント側で行い、結果を zustand ストアへ格納する。

設計方針（store の分割案）:

- `themeStore.ts` — テーマ（light/dark/system）、永続化ロジック
  -- `settingsStore.ts` — アプリ設定（メンバー、イテレーション、statusMappings、ヘッダーマッピング）。永続化は初期設定 JSON ベースで行い、localStorage への自動永続化は行わない。
- `featuresStore.ts` — インポートされたフィーチャーデータ、フィルタ/ソート状態

起動フロー:

- 起動時はインポート済みの初期設定 JSON を優先して `settingsStore` を初期化する。`localStorage` からの設定復元は行わない。
- TSV インポート時は `featuresStore` に追加・更新し、他画面はストアを参照して描画する。

3. ローディング & エラー

- TSVパース中はスピナー表示と処理済み行数を表示。
- エラーは行単位で表示し、エラー行の CSV ダウンロードを提供。

4. データ設計（TypeScript 例）

```ts
type Status = "未対応" | "作業中" | "プルリク中" | "完了" | "破棄";

interface FeatureRow {
  id: string;
  category: "FE" | "BE" | "テスト" | "その他"; // 担当分類
  title: string; // フィーチャタイトル
  storyPoints: number | undefined; // ストーリーポイント
  estimatedHours: number | undefined; // 見積時間
  actualHours: number | undefined; // 実績時間
  iteration: number | undefined; // イテレーション
  status: Status; // 作業状況
  assignee?: string; // 担当者名
}
```

5. 実装方針（高レベル）

ディレクトリ構成（提案）:

src/
├─ components/
│ ├─ ui/ # 見た目だけ（再利用前提）
│ │ ├─ Button/
│ │ ├─ Input/
│ │ ├─ Card/
│ │ ├─ Table/
│ │ └─ Modal/
│ │
│ ├─ layout/ # 画面骨組み
│ │ ├─ Header/
│ │ ├─ Sidebar/
│ │ ├─ PageLayout/
│ │ └─ Footer/
│ │
│ └─ feature/ # 機能単位（状態・ロジックを持つ）
│ ├─ theme/
│ │ ├─ ThemeToggle.tsx
│ │ └─ useTheme.ts
│ ├─ auth/
│ └─ xxx/
│
├─ pages/ # 画面単位（組み立てだけ、ルーティングは使わない）
│ ├─ HomePage.tsx
│ └─ SettingsPage.tsx
│
├─ stores/ # Zustand ストア
│ └─ themeStore.ts
│
├─ styles/
│ ├─ tokens.css # 色・フォント・サイズ
│ └─ globals.css
│
└─ types/

主なファイル:

- `src/components/feature/FileImporter.tsx`, `FeatureTable.tsx`, `ProjectSummary.tsx`
- `src/pages/*Page.tsx`（タブで切り替える画面）
- `src/utils/tsvParser.ts`, `src/types/feature.ts`
- `src/stores/*Store.ts`（zustand ストア）

段階導入:

1. TSV パーサと `FeatureTable` の実装
2. `ProjectSummary` と集計ロジック
3. `TeamVelocity` の表示
4. `ProgressBoard` と UX 改善

注意: ルーティングは行わないため、`pages` はあくまで UI 組み立て単位として扱う（タブで切替）。

6. テスト

本プロジェクトではテストは行わない。コード品質とリスクは実装レビューと手動確認で担保する。
