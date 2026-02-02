import React, { useState, useEffect, useRef } from "react";
import useStore from "../../utils/store";
import MembersEditor, { MembersEditorRef } from "../MembersEditor";
import { WizardStepProps } from "./types";

const Step7_Members: React.FC<WizardStepProps> = ({ onNext, onBack }) => {
  const settings: any = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  
  // MembersEditorのrefを保持
  const membersEditorRef = useRef<MembersEditorRef>(null);
  
  // 初回マウント時のみsettings.membersから初期値を設定
  const [members, setMembers] = useState<any[]>(() => {
    return Array.isArray(settings?.members) ? settings.members : [];
  });
  const [errors, setErrors] = useState<string[]>([]);
  const isInitializedRef = useRef(false);

  // 初回マウント時のみsettings.membersから初期値を設定
  useEffect(() => {
    if (!isInitializedRef.current && Array.isArray(settings?.members) && settings.members.length > 0) {
      setMembers(settings.members);
      isInitializedRef.current = true;
    }
  }, []); // 初回マウント時のみ実行

  // membersが変更されたときにローカル状態とstoreのsettingsを更新して保存
  const handleMembersChange = (newMembers: any[]) => {
    setMembers(newMembers);
    // 最新のstore値を取得してから保存（クロージャによる古いsettings参照を避ける）
    const currentSettings = useStore.getState().settings;
    useStore.getState().setSettings({ ...currentSettings, members: newMembers });
  };

  const validateAndSave = () => {
    // ref経由で最新のmembersを取得（デバウンス中でも最新値が取れる）
    const latestMembers = membersEditorRef.current?.getMembers() ?? members;
    
    const errs: string[] = [];
    latestMembers.forEach((m, i) => {
      if (!m.name || m.name.trim() === "")
        errs.push(`行 ${i + 1}: 氏名は必須です`);
      if (
        Number.isNaN(Number(m.plannedVelocity)) ||
        Number(m.plannedVelocity) < 0
      )
        errs.push(
          `行 ${i + 1}: plannedVelocity は 0 以上の数値である必要があります`
        );
    });
    if (errs.length > 0) {
      setErrors(errs);
      return false;
    }
    // 最新のmembersでstoreを更新
    const currentSettings = useStore.getState().settings;
    useStore.getState().setSettings({ ...currentSettings, members: latestMembers });
    setMembers(latestMembers);
    setErrors([]);
    return true;
  };

  const handleNext = () => {
    if (validateAndSave()) {
      onNext();
    }
  };

  // メンバーが入力されている場合、すべてのメンバーに名前が入力されているかチェック
  const canProceed =
    members.length === 0 ||
    members.every((m: any) => m.name && m.name.trim() !== "");

  return (
    <div className="wizard-step-content">
      <h3>ステップ7: メンバー情報の入力</h3>
      <p>メンバー情報を入力してください（任意）。</p>
      <MembersEditor 
        ref={membersEditorRef}
        hideSaveButton={true} 
        onMembersChange={handleMembersChange}
      />
      {errors.length > 0 && (
        <div
          className="wizard-info-box error"
          role="alert"
          style={{ marginTop: 16 }}
        >
          <p>
            <strong>エラー:</strong>
          </p>
          <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20 }}>
            {errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default Step7_Members;
