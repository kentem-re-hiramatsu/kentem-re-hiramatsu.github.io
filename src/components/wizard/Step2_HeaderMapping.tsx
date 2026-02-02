import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import useStore, { Feature } from "../../utils/store";
import {
  autoMapHeaders,
  parseTSVToFeatures,
  extractMembersFromAssignees,
} from "./utils";

const Step2_HeaderMapping: React.FC<{
  onNext: () => void;
  onBack: () => void;
}> = ({ onNext, onBack }) => {
  const features = useStore((s) => s.features);
  const settings: any = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);

  // TSVヘッダーを取得（storeに保存されたもの、またはフィーチャーから推測）
  const tsvHeaders: string[] =
    settings?.tsvHeaders?.length > 0
      ? settings.tsvHeaders
      : features.length > 0
      ? Object.keys(features[0]).filter((k) => k !== "id")
      : [];

  // 既存のマッピングがある場合はそれを使用、ない場合は自動マッピングを試行
  const existingMapping = settings?.headerMapping ?? {};
  const hasExistingMapping =
    existingMapping.title &&
    existingMapping.status &&
    existingMapping.iteration;

  const initialMapping = hasExistingMapping
    ? existingMapping
    : tsvHeaders.length > 0
    ? { ...existingMapping, ...autoMapHeaders(tsvHeaders) }
    : existingMapping;

  const [headerMapping, setHeaderMapping] =
    useState<Record<string, string>>(initialMapping);

  // tsvHeadersが変更された場合、自動マッピングを再実行
  useEffect(() => {
    if (tsvHeaders.length > 0 && !hasExistingMapping) {
      const autoMapping = autoMapHeaders(tsvHeaders);
      setHeaderMapping((prev) => {
        // 既にマッピングがあるフィールドは上書きしない
        const merged = { ...autoMapping };
        Object.keys(prev).forEach((key) => {
          if (prev[key]) {
            merged[key] = prev[key];
          }
        });
        return merged;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tsvHeaders.length]);

  const requiredFields = ["title", "status", "iteration", "storyPoints", "estimatedHours", "actualHours", "assignee", "category"];

  // フィールド名の日本語表示用マッピング
  const fieldLabels: Record<string, string> = {
    title: "タイトル",
    status: "状態",
    iteration: "イテレーション",
    storyPoints: "ストーリーポイント",
    estimatedHours: "予定時間",
    actualHours: "実績時間",
    assignee: "担当者",
    category: "分類",
  };

  // canProceedをuseMemoで計算（すべての必須フィールドが入力されているかチェック）
  const canProceed = useMemo(() => {
    return requiredFields.every((field) => {
      const value = headerMapping[field];
      return value && value.trim() !== "";
    });
  }, [headerMapping]);

  // headerMappingとcanProceedの変更を即座にstoreに保存
  useEffect(() => {
    // 最新のsettingsを取得
    const currentSettings = useStore.getState().settings;
    const updatedSettings = { ...currentSettings, headerMapping, step2CanProceed: canProceed };
    setSettings(updatedSettings);
  }, [headerMapping, canProceed, setSettings]);

  const handleSave = useCallback(() => {
    const updatedSettings = { ...settings, headerMapping };
    setSettings(updatedSettings);

    // TSVの生データがあれば、マッピングに基づいてパース
    const tsvRawData = settings?.tsvRawData;

    if (tsvRawData && tsvRawData.headers && tsvRawData.rows) {
      const parsed = parseTSVToFeatures(tsvRawData, headerMapping);

      // assigneeとcategoryのマッピングを収集（担当を推測するため）
      const assigneeCategoryMap = new Map<string, Set<string>>();
      parsed.forEach((feature) => {
        if (feature.assignee && feature.category) {
          const assigneeName = feature.assignee.trim();
          if (!assigneeCategoryMap.has(assigneeName)) {
            assigneeCategoryMap.set(assigneeName, new Set<string>());
          }
          assigneeCategoryMap.get(assigneeName)!.add(feature.category);
        }
      });

      // assigneeとroleのマッピングを作成して、直接membersに追加
      const extractedAssigneesWithRole =
        extractMembersFromAssignees(assigneeCategoryMap);

      // 既存のmembersとマージ
      const existingMembers = Array.isArray(updatedSettings?.members)
        ? updatedSettings.members
        : [];
      const existingMemberNames = existingMembers
        .map((m: any) => m?.name)
        .filter(Boolean);
      const newMembers = extractedAssigneesWithRole.filter(
        (m: any) => !existingMemberNames.includes(m.name)
      );
      const mergedMembers = [...existingMembers, ...newMembers];

      // パースしたフィーチャーを保存
      useStore.getState().setFeatures(parsed);

      // 抽出されたassigneeをmembersに統合してsettingsに保存
      const finalSettings = { ...updatedSettings, members: mergedMembers };
      setSettings(finalSettings);
    }
  }, [headerMapping, settings, setSettings]);

  // canProceedがtrueになったときにhandleSaveを実行（次へボタンが押される前でも保存）
  const lastCanProceedRef = useRef(false);
  useEffect(() => {
    if (canProceed && !lastCanProceedRef.current) {
      handleSave();
    }
    lastCanProceedRef.current = canProceed;
  }, [canProceed, handleSave]);

  return (
    <div className="wizard-step-content">
      <h3>ステップ3: ヘッダーマッピング</h3>
      <p>TSV の各ヘッダーをアプリ内部項目にマッピングしてください。</p>
      {tsvHeaders.length === 0 && (
        <div className="wizard-info-box error" role="alert">
          <p>
            フィーチャーデータが読み込まれていません。ステップ1に戻って TSV
            をインポートしてください。
          </p>
        </div>
      )}
      {tsvHeaders.length > 0 && (
        <div style={{ marginTop: 24, overflowX: "auto" }}>
          <table style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>内部項目</th>
                <th>TSV ヘッダー</th>
              </tr>
            </thead>
            <tbody>
              {requiredFields.map((field) => (
                <tr key={field}>
                  <td>
                    <strong>{fieldLabels[field] || field}</strong>{" "}
                    <span style={{ color: "var(--error)" }}>*</span>
                  </td>
                  <td>
                    <select
                      value={headerMapping[field] ?? ""}
                      onChange={(e) => {
                        const newMapping = {
                          ...headerMapping,
                          [field]: e.target.value,
                        };
                        setHeaderMapping(newMapping);
                        // 即座にstoreに保存してstep2CanProceedを更新
                        const allRequiredFields = ["title", "status", "iteration", "storyPoints", "estimatedHours", "actualHours", "assignee", "category"];
                        const currentCanProceed = allRequiredFields.every((f) => {
                          const value = f === field ? e.target.value : newMapping[f];
                          return value && value.trim() !== "";
                        });
                        const currentSettings = useStore.getState().settings;
                        setSettings({ ...currentSettings, headerMapping: newMapping, step2CanProceed: currentCanProceed });
                      }}
                      aria-label={`${fieldLabels[field] || field} のマッピング`}
                      style={{
                        width: "100%",
                        padding: 8,
                        borderRadius: 4,
                        border: "1px solid var(--neutral-300)",
                      }}
                    >
                      <option value="">選択してください</option>
                      {tsvHeaders.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Step2_HeaderMapping;
