import React, { useMemo } from "react";
import useStore from "../utils/store";
import { mapStatus } from "../utils/status";
import { normalizeCategory } from "../utils/aggregate";

const ProjectSummary: React.FC = () => {
  const features = useStore((s) => s.features);
  const settings: any = useStore((s) => s.settings);
  const statusMappings = settings?.statusMappings;

  const summary = useMemo(() => {
    // FE、BE、テストの合計PT（破棄を除く）と破棄PT
    const feFeatures = features.filter((f) => {
      const mappedStatus = mapStatus(f.status, statusMappings);
      return normalizeCategory(f.category) === "FE" && mappedStatus !== "破棄";
    });
    const fePT = feFeatures
      .filter((f) => typeof f.storyPoints === "number")
      .reduce((acc, f) => acc + (f.storyPoints ?? 0), 0);
    
    const feDiscardedPT = features
      .filter((f) => {
        const mappedStatus = mapStatus(f.status, statusMappings);
        return mappedStatus === "破棄" && normalizeCategory(f.category) === "FE" && typeof f.storyPoints === "number";
      })
      .reduce((acc, f) => acc + (f.storyPoints ?? 0), 0);
    
    const beFeatures = features.filter((f) => {
      const mappedStatus = mapStatus(f.status, statusMappings);
      return normalizeCategory(f.category) === "BE" && mappedStatus !== "破棄";
    });
    const bePT = beFeatures
      .filter((f) => typeof f.storyPoints === "number")
      .reduce((acc, f) => acc + (f.storyPoints ?? 0), 0);
    
    const beDiscardedPT = features
      .filter((f) => {
        const mappedStatus = mapStatus(f.status, statusMappings);
        return mappedStatus === "破棄" && normalizeCategory(f.category) === "BE" && typeof f.storyPoints === "number";
      })
      .reduce((acc, f) => acc + (f.storyPoints ?? 0), 0);
    
    const testFeatures = features.filter((f) => {
      const mappedStatus = mapStatus(f.status, statusMappings);
      return normalizeCategory(f.category) === "テスト" && mappedStatus !== "破棄";
    });
    const testPT = testFeatures
      .filter((f) => typeof f.storyPoints === "number")
      .reduce((acc, f) => acc + (f.storyPoints ?? 0), 0);
    
    const testDiscardedPT = features
      .filter((f) => {
        const mappedStatus = mapStatus(f.status, statusMappings);
        return mappedStatus === "破棄" && normalizeCategory(f.category) === "テスト" && typeof f.storyPoints === "number";
      })
      .reduce((acc, f) => acc + (f.storyPoints ?? 0), 0);
    
    // 全体の合計（破棄を除く）と破棄の合計
    const validFeatures = features.filter((f) => {
      const mappedStatus = mapStatus(f.status, statusMappings);
      return mappedStatus !== "破棄";
    });
    const total = validFeatures.reduce((acc, f) => acc + (typeof f.storyPoints === "number" ? f.storyPoints : 0), 0);
    const validFeatureCount = validFeatures.length;
    
    const discardedFeatures = features.filter((f) => {
      const mappedStatus = mapStatus(f.status, statusMappings);
      return mappedStatus === "破棄";
    });
    const discardedCount = discardedFeatures.length;
    const discardedPT = discardedFeatures.reduce((acc, f) => acc + (typeof f.storyPoints === "number" ? f.storyPoints : 0), 0);
    
    return {
      total,
      validFeatureCount,
      discardedCount,
      discardedPT,
      fePT,
      bePT,
      testPT,
      feDiscardedPT,
      beDiscardedPT,
      testDiscardedPT,
    };
  }, [features, statusMappings]);

  return (
    <div className="project-summary">
      <div className="project-summary-grid">
        <div className="project-summary-item">
          <div className="project-summary-label">インポート済みフィーチャー数</div>
          <div className="project-summary-value">
            {summary.validFeatureCount}
            <span className="project-summary-discarded"> (破棄: {summary.discardedCount})</span>
          </div>
        </div>
        <div className="project-summary-item">
          <div className="project-summary-label">合計ストーリーポイント</div>
          <div className="project-summary-value">
            {summary.total}
            <span className="project-summary-discarded"> (破棄: {summary.discardedPT})</span>
          </div>
        </div>
        <div className="project-summary-item">
          <div className="project-summary-label">FE合計ポイント</div>
          <div className="project-summary-value">
            {summary.fePT}
            <span className="project-summary-discarded"> (破棄: {summary.feDiscardedPT})</span>
          </div>
        </div>
        <div className="project-summary-item">
          <div className="project-summary-label">BE合計ポイント</div>
          <div className="project-summary-value">
            {summary.bePT}
            <span className="project-summary-discarded"> (破棄: {summary.beDiscardedPT})</span>
          </div>
        </div>
        <div className="project-summary-item">
          <div className="project-summary-label">テスト合計ポイント</div>
          <div className="project-summary-value">
            {summary.testPT}
            <span className="project-summary-discarded"> (破棄: {summary.testDiscardedPT})</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectSummary;

