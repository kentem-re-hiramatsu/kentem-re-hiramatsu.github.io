import React, { useState, useEffect, useMemo, useRef } from "react";
import useStore, { Feature } from "../../utils/store";
import { getField } from "./utils";
import { WizardStepProps } from "./types";
import Button from "../Button";

const Step4_StatusMapping: React.FC<WizardStepProps> = ({ onNext, onBack }) => {
  const settings: any = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const features = useStore((s) => s.features);
  const internalStatuses = ["未対応", "作業中", "PR中", "完了", "破棄"];

  // TSVのstatus値を取得（ユニークな値のみ）
  const availableStatusValues = useMemo(() => {
    const statusSet = new Set<string>();
    const headerMapping = settings?.headerMapping ?? {};
    const tsvRawData = settings?.tsvRawData;
    
    if (tsvRawData && tsvRawData.headers && tsvRawData.rows) {
      const headers = tsvRawData.headers;
      const rows = tsvRawData.rows;
      const statusHeaderIndex = headers.findIndex((h: string) => h === headerMapping.status);
      
      if (statusHeaderIndex >= 0) {
        rows.forEach((cells: string[]) => {
          const statusValue = (cells[statusHeaderIndex] ?? "").trim();
          if (statusValue) {
            statusSet.add(statusValue);
          }
        });
      }
    }
    
    return Array.from(statusSet).sort();
  }, [settings?.tsvRawData, settings?.headerMapping]);

  // 各内部状態に対して、マッピングされたTSV status値を保持（1対1）
  const [statusMappings, setStatusMappings] = useState<Record<string, string>>(
    () => {
      // 既存のstatusMappingsを逆引き（内部状態 -> TSV status値）
      const existing = settings?.statusMappings ?? {};
      const reversed: Record<string, string> = {};
      // 各内部状態に対して、最初に見つかったTSV status値を使用
      internalStatuses.forEach((internalStatus) => {
        const found = Object.entries(existing).find(([tsvStatus, intStatus]) => intStatus === internalStatus);
        if (found) {
          reversed[internalStatus] = found[0];
        }
      });
      return reversed;
    }
  );

  // settingsが変更されたときにstatusMappingsを更新
  useEffect(() => {
    const existing = settings?.statusMappings ?? {};
    const reversed: Record<string, string> = {};
    // 各内部状態に対して、最初に見つかったTSV status値を使用
    internalStatuses.forEach((internalStatus) => {
      const found = Object.entries(existing).find(([tsvStatus, intStatus]) => intStatus === internalStatus);
      if (found) {
        reversed[internalStatus] = found[0];
      }
    });
    setStatusMappings(reversed);
  }, [settings?.statusMappings]);

  // canProceedをsettingsに保存して、フッターの次へボタンで参照できるようにする
  useEffect(() => {
    const canProceed = internalStatuses.every((status) => {
      const mappedValue = statusMappings[status];
      return mappedValue && mappedValue.trim() !== "";
    });
    const currentSettings = useStore.getState().settings;
    setSettings({ ...currentSettings, step4CanProceed: canProceed });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusMappings]);

  // statusMappingsをsettings形式に変換して保存
  const updateSettings = (newMappings: Record<string, string>, additionalMaps: Array<{ internalStatus: string; tsvStatus: string }> = []) => {
    // 設定に保存（TSV status値 -> 内部状態の形式に変換）
    const mappingsObj: Record<string, string> = {};
    // デフォルトのマッピング
    Object.entries(newMappings).forEach(([internalStatus, tsvStatus]) => {
      if (tsvStatus && tsvStatus.trim() !== "") {
        mappingsObj[tsvStatus] = internalStatus;
      }
    });
    // 追加マッピング
    additionalMaps.forEach(({ internalStatus, tsvStatus }) => {
      if (tsvStatus && tsvStatus.trim() !== "") {
        mappingsObj[tsvStatus] = internalStatus;
      }
    });
    const currentSettings = useStore.getState().settings;
    const updatedSettings = { ...currentSettings, statusMappings: mappingsObj };
    setSettings(updatedSettings);

    // statusマッピングを適用してfeaturesを再パース
    const tsvRawData = currentSettings?.tsvRawData;
    const headerMapping = currentSettings?.headerMapping ?? {};
    if (tsvRawData && tsvRawData.headers && tsvRawData.rows) {
      const parsed: Feature[] = [];
      const headers = tsvRawData.headers;
      const rows = tsvRawData.rows;

      rows.forEach((cells: string[], rowIndex: number) => {
        const title = getField(cells, headers, headerMapping, "title");
        if (!title) return;

        const category = getField(cells, headers, headerMapping, "category");
        const storyPointsRaw = getField(
          cells,
          headers,
          headerMapping,
          "storyPoints"
        );
        const estimatedRaw = getField(
          cells,
          headers,
          headerMapping,
          "estimatedHours"
        );
        const actualRaw = getField(
          cells,
          headers,
          headerMapping,
          "actualHours"
        );
        const iterationRaw = getField(
          cells,
          headers,
          headerMapping,
          "iteration"
        );
        const statusRaw = getField(cells, headers, headerMapping, "status"); // 生のstatus値
        const assigneeRaw = getField(cells, headers, headerMapping, "assignee");

        // statusマッピングを適用
        const status = mappingsObj[statusRaw] || undefined;

        let assignee = assigneeRaw;
        if (assigneeRaw && /[,、;\/]/.test(assigneeRaw)) {
          assignee = assigneeRaw.split(/[,、;\/]/)[0].trim();
        }

        const storyPoints =
          storyPointsRaw === "" ? null : Number(storyPointsRaw);
        const estimatedHours = estimatedRaw === "" ? null : Number(estimatedRaw);
        const actualHours = actualRaw === "" ? null : Number(actualRaw);
        const iteration = iterationRaw === "" ? null : Number(iterationRaw);

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
          status: status,
          assignee: assignee || undefined,
        });
      });

      useStore.getState().setFeatures(parsed);
    }
  };

  // 追加マッピング（デフォルト以外）を管理
  const [additionalMappings, setAdditionalMappings] = useState<Array<{ internalStatus: string; tsvStatus: string }>>(
    () => {
      // 既存のstatusMappingsから、デフォルトの内部状態にマッピングされていないものを取得
      const existing = settings?.statusMappings ?? {};
      const defaultMappedTsvStatuses = new Set<string>();
      // 各内部状態に対して、最初に見つかったTSV status値を記録
      internalStatuses.forEach((internalStatus) => {
        const found = Object.entries(existing).find(([tsvStatus, intStatus]) => intStatus === internalStatus);
        if (found) {
          defaultMappedTsvStatuses.add(found[0]);
        }
      });
      
      const additional: Array<{ internalStatus: string; tsvStatus: string }> = [];
      Object.entries(existing).forEach(([tsvStatus, internalStatus]) => {
        // デフォルトのマッピングに含まれていないものを追加
        if (!defaultMappedTsvStatuses.has(tsvStatus)) {
          additional.push({ internalStatus: internalStatus as string, tsvStatus });
        }
      });
      return additional;
    }
  );

  // 手動変更を追跡するためのref
  const isManualUpdateRef = useRef(false);
  
  // settingsが変更されたときにadditionalMappingsを更新（手動変更でない場合のみ）
  useEffect(() => {
    // 手動変更の場合は再計算しない
    if (isManualUpdateRef.current) {
      isManualUpdateRef.current = false;
      return;
    }
    
    const existing = settings?.statusMappings ?? {};
    const defaultMappedTsvStatuses = new Set<string>();
    // 各内部状態に対して、最初に見つかったTSV status値を記録
    internalStatuses.forEach((internalStatus) => {
      const found = Object.entries(existing).find(([tsvStatus, intStatus]) => intStatus === internalStatus);
      if (found) {
        defaultMappedTsvStatuses.add(found[0]);
      }
    });
    
    const additional: Array<{ internalStatus: string; tsvStatus: string }> = [];
    Object.entries(existing).forEach(([tsvStatus, internalStatus]) => {
      // デフォルトのマッピングに含まれていないものを追加
      if (!defaultMappedTsvStatuses.has(tsvStatus)) {
        additional.push({ internalStatus: internalStatus as string, tsvStatus });
      }
    });
    setAdditionalMappings(additional);
  }, [settings?.statusMappings]);

  const handleStatusMappingChange = (internalStatus: string, tsvStatus: string) => {
    const newMappings = { ...statusMappings, [internalStatus]: tsvStatus };
    setStatusMappings(newMappings);
    updateSettings(newMappings, additionalMappings);
  };

  const handleAddAdditionalMapping = () => {
    const newAdditional = [...additionalMappings, { internalStatus: internalStatuses[0], tsvStatus: "" }];
    setAdditionalMappings(newAdditional);
    // 手動変更フラグを設定
    isManualUpdateRef.current = true;
    updateSettings(statusMappings, newAdditional);
  };

  const handleUpdateAdditionalMapping = (index: number, field: "internalStatus" | "tsvStatus", value: string) => {
    const newAdditional = [...additionalMappings];
    newAdditional[index] = { ...newAdditional[index], [field]: value };
    setAdditionalMappings(newAdditional);
    // 手動変更フラグを設定
    isManualUpdateRef.current = true;
    updateSettings(statusMappings, newAdditional);
  };

  const handleRemoveAdditionalMapping = (index: number) => {
    const newAdditional = additionalMappings.filter((_, i) => i !== index);
    setAdditionalMappings(newAdditional);
    // 手動変更フラグを設定
    isManualUpdateRef.current = true;
    updateSettings(statusMappings, newAdditional);
  };

  // すべての内部状態がマッピングされているかチェック
  const canProceed = internalStatuses.every((status) => {
    const mappedValue = statusMappings[status];
    return mappedValue && mappedValue.trim() !== "";
  });

  return (
    <div className="wizard-step-content">
      <h3>ステップ4: statusマッピング</h3>
      <p>
        プロジェクトの status 値を、内部の状態値にマッピングしてください。
        <strong>すべてのフィールドが必須です。</strong>
      </p>
      <div style={{ marginTop: 24, overflowX: "auto" }}>
        <table style={{ width: "100%" }}>
          <thead>
            <tr>
              <th>内部状態</th>
              <th>TSV の status 値</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {internalStatuses.map((internalStatus) => (
              <tr key={internalStatus}>
                <td>
                  <strong>{internalStatus}</strong>{" "}
                  <span style={{ color: "var(--error)" }}>*</span>
                </td>
                <td>
                  <input
                    type="text"
                    value={statusMappings[internalStatus] ?? ""}
                    onChange={(e) =>
                      handleStatusMappingChange(internalStatus, e.target.value)
                    }
                    placeholder="例: Done, 完了, Closed"
                    aria-label={`${internalStatus} のマッピング`}
                    style={{
                      width: "100%",
                      padding: 8,
                      borderRadius: 4,
                      border: "1px solid var(--neutral-300)",
                    }}
                    required
                  />
                </td>
                <td></td>
              </tr>
            ))}
            {additionalMappings.length > 0 && (
              <>
                <tr>
                  <td colSpan={3} style={{ paddingTop: 24, borderTop: "2px solid var(--neutral-300)" }}>
                    <strong>追加マッピング</strong>
                  </td>
                </tr>
                {additionalMappings.map((mapping, index) => (
                  <tr key={`additional-${index}`}>
                    <td>
                      <select
                        value={mapping.internalStatus}
                        onChange={(e) => handleUpdateAdditionalMapping(index, "internalStatus", e.target.value)}
                        style={{
                          width: "100%",
                          padding: 8,
                          borderRadius: 4,
                          border: "1px solid var(--neutral-300)",
                        }}
                      >
                        {internalStatuses.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="text"
                        value={mapping.tsvStatus}
                        onChange={(e) => handleUpdateAdditionalMapping(index, "tsvStatus", e.target.value)}
                        placeholder="TSV status値を入力"
                        style={{
                          width: "100%",
                          padding: 8,
                          borderRadius: 4,
                          border: "1px solid var(--neutral-300)",
                        }}
                      />
                    </td>
                    <td>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleRemoveAdditionalMapping(index)}
                      >
                        削除
                      </Button>
                    </td>
                  </tr>
                ))}
              </>
            )}
            <tr>
              <td colSpan={3} style={{ paddingTop: 16 }}>
                <Button variant="secondary" onClick={handleAddAdditionalMapping}>
                  追加
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Step4_StatusMapping;
