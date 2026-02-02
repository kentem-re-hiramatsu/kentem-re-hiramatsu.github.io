import React, { useEffect, useState } from "react";
import FileImporter from "./components/FileImporter.tsx";
import FeatureTable from "./components/FeatureTable.tsx";
import ProjectSummary from "./components/ProjectSummary.tsx";
import TeamVelocity from "./components/TeamVelocity.tsx";
import ProgressBoard from "./components/ProgressBoard.tsx";
import Settings from "./components/Settings.tsx";
import useStore from "./utils/store";
import { initTheme } from "./utils/theme";

const TABS = [
  { key: "features", label: "フィーチャー" },
  { key: "progress", label: "進捗管理" },
  { key: "velocity", label: "チームベロシティ" },
  { key: "settings", label: "設定" },
];

const App = () => {
  const [activeTab, setActiveTab] = useState<string>(TABS[0].key);
  const settings = useStore((s) => s.settings);

  useEffect(() => {
    // テーマを初期化
    initTheme();
  }, []);

  const renderTabContent = () => {
    switch (activeTab) {
      case "features":
        return (
          <div>
            <section className="section">
              <h2>プロジェクト概要</h2>
              <ProjectSummary />
            </section>

            <section className="section">
              <h2>フィーチャー一覧</h2>
              <FeatureTable />
            </section>
          </div>
        );

      case "progress":
        return (
          <div className="section">
            <h2>進捗管理</h2>
            <ProgressBoard />
          </div>
        );

      case "velocity":
        return (
          <div className="section">
            <h2>チームベロシティ</h2>
            <TeamVelocity />
          </div>
        );

      case "settings":
        return <Settings />;

      default:
        return null;
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>進捗管理ツール</h1>
      </header>

      <nav className="app-tabs" aria-label="メインタブ">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key)}
            aria-pressed={activeTab === t.key}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="app-main">{renderTabContent()}</main>
    </div>
  );
};

export default App;
