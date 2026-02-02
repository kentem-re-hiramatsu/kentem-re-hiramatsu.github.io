import React, { useState, useMemo } from "react";
import useStore from "../utils/store";
import "./FeatureTable.css";

const FeatureTable: React.FC = () => {
  const features = useStore((s) => s.features);
  const settings: any = useStore((s) => s.settings);
  const [searchText, setSearchText] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterIteration, setFilterIteration] = useState<string>("");
  const [filterAssignee, setFilterAssignee] = useState<string>("");

  // ユニークな値のリストを取得
  const categories = useMemo(() => {
    const cats = new Set<string>();
    features.forEach((f) => {
      if (f.category) cats.add(f.category);
    });
    return Array.from(cats).sort();
  }, [features]);

  const statuses = useMemo(() => {
    const sts = new Set<string>();
    features.forEach((f) => {
      if (f.status) sts.add(f.status);
    });
    return Array.from(sts).sort();
  }, [features]);

  const iterations = useMemo(() => {
    const its = new Set<number>();
    
    // 設定から定義されているイテレーションを追加（1から始まるインデックス）
    const settingsIterations = settings?.iterations ?? [];
    settingsIterations.forEach((_: any, index: number) => {
      its.add(index + 1);
    });
    
    // フィーチャーに設定されているイテレーションも追加
    features.forEach((f) => {
      if (f.iteration != null) {
        const iterNum = typeof f.iteration === "number" ? f.iteration : Number(f.iteration);
        if (!isNaN(iterNum) && iterNum > 0) {
          its.add(iterNum);
        }
      }
    });
    
    return Array.from(its).sort((a, b) => a - b);
  }, [features, settings?.iterations]);

  const assignees = useMemo(() => {
    const ass = new Set<string>();
    features.forEach((f) => {
      if (f.assignee) ass.add(f.assignee);
    });
    return Array.from(ass).sort();
  }, [features]);

  // フィルタリングされたフィーチャー
  const filteredFeatures = useMemo(() => {
    return features.filter((f) => {
      // 検索テキストでフィルタ
      if (searchText) {
        const searchLower = searchText.toLowerCase();
        const matchesSearch =
          (f.title?.toLowerCase().includes(searchLower) ?? false) ||
          (f.category?.toLowerCase().includes(searchLower) ?? false) ||
          (f.status?.toLowerCase().includes(searchLower) ?? false) ||
          (f.assignee?.toLowerCase().includes(searchLower) ?? false);
        if (!matchesSearch) return false;
      }

      // カテゴリでフィルタ
      if (filterCategory && f.category !== filterCategory) return false;

      // 状態でフィルタ
      if (filterStatus && f.status !== filterStatus) return false;

      // イテレーションでフィルタ
      if (filterIteration) {
        const iterNum = Number(filterIteration);
        if (typeof f.iteration !== "number" || f.iteration !== iterNum) return false;
      }

      // 担当者でフィルタ
      if (filterAssignee && f.assignee !== filterAssignee) return false;

      return true;
    });
  }, [features, searchText, filterCategory, filterStatus, filterIteration, filterAssignee]);

  if (!features || features.length === 0) {
    return <div className="import-message">フィーチャーがありません。TSV をインポートしてください。</div>;
  }

  return (
    <div className="feature-table-container">
      <div className="feature-table-filters">
        <div className="filter-group">
          <label htmlFor="search-input">検索</label>
          <input
            id="search-input"
            type="text"
            placeholder="フィーチャー名、分類、状態、担当者で検索..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="filter-input"
          />
        </div>
        <div className="filter-group">
          <label htmlFor="filter-category">分類</label>
          <select
            id="filter-category"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="filter-select"
          >
            <option value="">すべて</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="filter-status">状態</label>
          <select
            id="filter-status"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="filter-select"
          >
            <option value="">すべて</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="filter-iteration">イテレーション</label>
          <select
            id="filter-iteration"
            value={filterIteration}
            onChange={(e) => setFilterIteration(e.target.value)}
            className="filter-select"
          >
            <option value="">すべて</option>
            {iterations.map((iter) => (
              <option key={iter} value={iter.toString()}>
                {iter}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="filter-assignee">担当者</label>
          <select
            id="filter-assignee"
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            className="filter-select"
          >
            <option value="">すべて</option>
            {assignees.map((assignee) => (
              <option key={assignee} value={assignee}>
                {assignee}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-reset">
          <button
            type="button"
            onClick={() => {
              setSearchText("");
              setFilterCategory("");
              setFilterStatus("");
              setFilterIteration("");
              setFilterAssignee("");
            }}
            className="reset-button"
          >
            リセット
          </button>
        </div>
      </div>
      <div className="feature-table-info">
        {filteredFeatures.length} / {features.length} 件表示
      </div>
      <div className="feature-table-wrapper">
        <table aria-label="フィーチャー一覧">
          <thead>
            <tr>
              <th>分類</th>
              <th>フィーチャー</th>
              <th>ストーリーポイント</th>
              <th>見積り（時間）</th>
              <th>実績（時間）</th>
              <th>イテレーション</th>
              <th>状態</th>
              <th>担当者</th>
            </tr>
          </thead>
          <tbody>
            {filteredFeatures.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: "var(--space-xl)" }}>
                  該当するフィーチャーがありません
                </td>
              </tr>
            ) : (
              filteredFeatures.map((f) => (
                <tr
                  key={f.id}
                  tabIndex={0}
                  role="row"
                  onKeyDown={(e) => {
                    // Enter / Space should act like a click for keyboard users
                    if (e.key === "Enter" || e.key === " ") {
                      (e.target as HTMLElement).click();
                    }
                  }}
                >
                  <td>{f.category ?? "-"}</td>
                  <td>{f.title ?? "-"}</td>
                  <td>{typeof f.storyPoints === "number" ? f.storyPoints : "-"}</td>
                  <td>{typeof f.estimatedHours === "number" ? f.estimatedHours : "-"}</td>
                  <td>{typeof f.actualHours === "number" ? f.actualHours : "-"}</td>
                  <td>{typeof f.iteration === "number" ? f.iteration : "-"}</td>
                  <td>{f.status ?? "-"}</td>
                  <td>{f.assignee ?? "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FeatureTable;

