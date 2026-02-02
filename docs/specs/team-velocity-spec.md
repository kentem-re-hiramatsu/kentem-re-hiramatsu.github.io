# チームベロシティ画面仕様書

作成日: 2026-01-31

このセクションは、チームベロシティ画面（以下「本画面」）の前提条件、用語定義、表示項目、稼働日の扱い、集計ルール、実装向けの集計ロジック、テスト観点、受け入れ条件、未決事項を明確に記述する。未確定事項は `TBD` として最後にまとめる。

1. 前提条件

- 表示単位：`PT` はストーリーポイント（Story Points）の略で固定する。
- データソース：TSVインポートで得られる Feature 行群（正規化済み）と `projectSettings`（`members`, `iterations`, `settings.includePRinDone`, `statusMappings`）を利用する。

2. 用語定義

- PT：ストーリーポイント。画面内のすべての "PT" はストーリーポイントを指す。
- イテレーション：`iterations` 設定内の期間（開始日・終了日・稼働日数含む）。
- 稼働日数（iteration.workingDays）：イテレーション全体の稼働日数（設定値）。
- 各人の稼働日：個人別に適用する稼働日数の値。デフォルトは `iteration.workingDays`。
- storyPoints：フィーチャーのストーリーポイント（数値、null許容）。
- 完了判定ルール：デフォルトは `status === "完了"`。設定 `includePRinDone` が true の場合は `プルリク中` を完了に含める。

3. 表示項目（1イテレーション単位）

- イテレーション名
- 開始日
- 稼働日数（イテレーション全体）
- 目標合計PT
- 実績合計PT
- FE目標PT / FE実績PT
- BE目標PT / BE実績PT
- テスト目標PT / テスト実績PT
- 各人の目標消化PT
- 計画ベロシティ（各人の `plannedVelocity` の表示）
- 稼働日（各人単位、編集可能）

4. 稼働日の扱い

- デフォルト：各人の稼働日は `iteration.workingDays` を継承する。
- 編集：画面上で個別に上書き可能。編集直後に集計を再実行して表示に反映する。
- バリデーション：整数かつ 0 以上。

5. 集計ルール（明確化）

- 実績PT（イテレーション単位）：当該イテレーションに割り当てられ、かつ完了判定に合致するフィーチャーの `storyPoints` を合算した値。
- 分類別（FE/BE/テスト）実績PT：上記のうち `feature.category` が該当カテゴリのものを合算した値。
- 分類別目標PT：目標値のソースは `members[].plannedVelocity` の合算を標準とする。本仕様では TSV の `goal` 列は使用しない。`plannedVelocity` の単位は `pt/day`（1日の目標ストーリーポイント）とし、イテレーション単位の目標PTは各メンバーの `plannedVelocity × 個人の稼働日` を合算して算出する。
- 要求仕様（ユーザ指定）の解釈："FE / BE / テストの目標PT・実績PTは、それぞれ『担当がFE / BE / テストであるメンバー全員の合計値』"。実装上は次の手順で評価する：
  1. 各メンバー M の担当 role を参照する（members[].role）。
  2. メンバー M が担当するフィーチャー群（feature.assignee が M を等しい行）を抽出する。
  3. 各メンバーについて完了済みフィーチャーの `storyPoints` を合算し、これをメンバーの実績PTとする。
  4. ロール単位（FE/BE/テスト）で、当該ロールを持つ全メンバーの実績PT を合算してロール別実績PT を算出する。

6. 全体合計の定義

- 目標合計PT・実績合計PT は、FE/BE/テスト を含む「すべてのメンバーの実績/目標の合計」。重複計上を避けるため、同一フィーチャーの `storyPoints` を複数人へ重複して加算しない（複数担当の配分は確認事項）。

7. 実装向け集計フロー（文章でわかる手順）

1) 前処理：TSVパーサー出力を正規化し、各 feature に少なくとも次のフィールドがあることを保証する：`id, category, storyPoints, iteration, status, assignee`。
2) 完了判定関数 `isDone(feature)` を評価する（statusMappings と includePRinDone を考慮）。
3) 表示レンジ内の各イテレーション I について：
   a. 対象Features := features.filter(f => f.iteration === I)
   b. 実績合計PT := sum(f.storyPoints for f in 対象Features if isDone(f) and isNumber(f.storyPoints))
   c. 各分類実績PT := sum(f.storyPoints for f in 対象Features if f.category === category && isDone(f) && isNumber(f.storyPoints))
   d. 各人実績PT（for each member M）：sum(f.storyPoints for f in 対象Features if f.assignee === M.name && isDone(f) && isNumber(f.storyPoints))
   e. ロール別実績PT := sum(member実績PT for members whose role === targetRole)
4) 目標PT の算出は `members[].plannedVelocity` の合算に従う。具体的には `plannedVelocity` は `pt/day` を想定し、各メンバーのイテレーション目標は `plannedVelocity × 個人の稼働日` を計算して合算する方式とする。

8. 重複・多重担当の扱い

-- 本仕様では複数担当は非対応とし、`assignee`（単一担当）を前提とする。

- TSV パーサは担当者欄に複数名が含まれる行を検出した場合、最初の担当者名を採用して `assignee` に格納し、該当行を警告一覧／エラーパネルに表示する。
- 集計ロジックは単一担当を前提とし、重複計上は行わない。

9. UI 振る舞い

- `includePRinDone` トグル変更時は即時再集計して表示を更新する。
- 個人の稼働日編集時は即時再集計。
- 集計除外となったデータ行（storyPoints が数値でない等）はエラーパネルに一覧表示する。

10. テスト観点（Given/When/Then）

- Given 有効な feature データと settings（includePRinDone=false） When チームベロシティ画面を表示 Then `プルリク中` は実績に含まれない。
- Given あるイテレーションに完了フィーチャーの storyPoints が 2,3,5 の場合 When 表示する Then 実績合計PT は 10 である。
- Given メンバー A,B が同一フィーチャーを担当し配分ルールが「代表者のみ計上」の場合 When 集計する Then 実績は1回のみ加算され、両メンバーに重複して計上されない。

11. 受け入れ条件（抜粋）

- AC-TV-001: 指定レンジのイテレーションが一覧表示され、列に記載の項目が存在する。
- AC-TV-002: 実績合計PT は完了判定されたフィーチャーの storyPoints 合計である。
- AC-TV-003: `includePRinDone` の切替が即時に集計に反映される。

12. 決定事項・未決事項（整理）

- 決定済み:
  - `plannedVelocity` は `pt/day`（1日の目標ストーリーポイント）とする。
  - イテレーション単位の目標PTは各メンバーごとに `plannedVelocity × 個人の稼働日` を合算して算出する。
  - `storyPoints` は小数を許容する（小数点以下は保持し、表示は必要に応じてフォーマットする）。

- 未決／要確認:
  - 複数担当の配分ルール（必要であれば将来検討）。

13. 次ステップ（推奨）

- 優先度高の未決事項（複数担当の配分ルール）をプロダクトオーナーと合意し、`Project Decisions` に反映する。
- 合意後に TSV スキーマと `projectSettings` スキーマを更新し、`tsvParser` と集計ユーティリティを実装する。

---
