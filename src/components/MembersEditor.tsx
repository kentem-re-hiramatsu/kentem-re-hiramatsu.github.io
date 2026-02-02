import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef, memo } from "react";
import useStore from "../utils/store";
import Button from "./Button";

export interface MembersEditorRef {
  getMembers: () => any[];
}

const MembersEditor = forwardRef<MembersEditorRef, { hideSaveButton?: boolean; onMembersChange?: (members: any[]) => void; initialMembers?: any[] }>(({ hideSaveButton = false, onMembersChange, initialMembers }, ref) => {
  const settings: any = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  // initialMembersが提供されている場合はそれを使用、そうでなければsettings.membersを使用
  const initial = initialMembers !== undefined 
    ? (Array.isArray(initialMembers) ? initialMembers : [])
    : (Array.isArray(settings?.members) ? settings.members : []);
  
  const [members, setMembers] = useState(() => {
    try {
      if (!Array.isArray(initial)) {
        return [];
      }
      return initial
        .filter((m: any) => m != null && typeof m === "object") // nullやundefinedを除外
        .map((m: any) => ({ 
          name: String(m?.name || ""), 
          role: String(m?.role || "FE"), 
          plannedVelocity: Number(m?.plannedVelocity ?? 0) 
        }));
    } catch (error) {
      return [];
    }
  });

  // 前回のsettings.membersの値を保存（無限ループを防ぐため）
  const prevSettingsMembersRef = useRef<any[]>([]);
  const isUpdatingRef = useRef(false);
  const scrollPositionRef = useRef<number>(0);

  // ref経由でmembersを取得できるようにする
  useImperativeHandle(ref, () => ({
    getMembers: () => members,
  }), [members]);

  // initialMembersが変更されたときにmembers状態を更新（初回マウント時のみ）
  const prevInitialMembersRef = useRef<any[] | undefined>(initialMembers);
  useEffect(() => {
    // initialMembersが提供されている場合のみ処理
    if (initialMembers === undefined) {
      return;
    }

    // 前回の値と同じ場合はスキップ
    const prevInitialMembers = prevInitialMembersRef.current;
    if (prevInitialMembers === initialMembers) {
      return;
    }

    // 更新中フラグが立っている場合はスキップ（ユーザーが入力中）
    if (isUpdatingRef.current) {
      return;
    }

    // initialMembersの内容を正規化
    const updatedMembers = (Array.isArray(initialMembers) ? initialMembers : [])
      .filter((m: any) => m != null && typeof m === "object")
      .map((m: any) => ({ 
        name: String(m?.name || ""), 
        role: String(m?.role || "FE"), 
        plannedVelocity: Number(m?.plannedVelocity ?? 0) 
      }));

    // 現在のmembersの内容を取得
    const currentLocalMembers = Array.isArray(members) ? members : [];
    
    // 現在のローカル状態と比較（JSON文字列で比較）
    const currentLocalMembersStr = JSON.stringify(currentLocalMembers.map((m: any) => ({ 
      name: m?.name, 
      role: m?.role, 
      plannedVelocity: m?.plannedVelocity 
    })));
    const updatedMembersStr = JSON.stringify(updatedMembers.map((m: any) => ({ 
      name: m?.name, 
      role: m?.role, 
      plannedVelocity: m?.plannedVelocity 
    })));
    
    // 実際に変更があった場合のみsetMembersを呼び出す
    if (currentLocalMembersStr !== updatedMembersStr) {
      isUpdatingRef.current = true;
      setMembers(updatedMembers);
      prevInitialMembersRef.current = initialMembers;
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 0);
    } else {
      prevInitialMembersRef.current = initialMembers;
    }
  }, [initialMembers, members]);

  // settings.membersが変更されたときにmembers状態を更新（メンバーがいれば取得）
  useEffect(() => {
    // initialMembersが提供されている場合は、settings.membersの変更を無視
    if (initialMembers !== undefined) {
      return;
    }

    // 更新中フラグが立っている場合はスキップ（無限ループを防ぐ）
    if (isUpdatingRef.current) {
      return;
    }

    // settings.membersが配列でない場合はスキップ
    if (!Array.isArray(settings?.members)) {
      return;
    }
    
    const currentMembers = settings.members;
    
    // 前回の値と比較（参照ではなく内容を比較）
    const prevMembers = prevSettingsMembersRef.current;
    
    // 前回の値と同じ内容の場合はスキップ（JSON文字列で比較して確実に）
    const prevMembersStr = JSON.stringify(prevMembers.map((m: any) => ({ 
      name: m?.name, 
      role: m?.role, 
      plannedVelocity: m?.plannedVelocity 
    })));
    const currentMembersStr = JSON.stringify(currentMembers.map((m: any) => ({ 
      name: m?.name, 
      role: m?.role, 
      plannedVelocity: m?.plannedVelocity 
    })));
    
    if (prevMembersStr === currentMembersStr && prevMembers.length > 0) {
      return;
    }
    
    // 現在のmembersの内容を取得
    const currentLocalMembers = Array.isArray(members) ? members : [];
    
    // settings.membersの内容を正規化
    const updatedMembers = currentMembers
      .filter((m: any) => m != null)
      .map((m: any) => ({ 
        name: String(m?.name || ""), 
        role: String(m?.role || "FE"), 
        plannedVelocity: Number(m?.plannedVelocity ?? 0) 
      }));
    
    // 現在のローカル状態と比較（JSON文字列で比較）
    const currentLocalMembersStr = JSON.stringify(currentLocalMembers.map((m: any) => ({ 
      name: m?.name, 
      role: m?.role, 
      plannedVelocity: m?.plannedVelocity 
    })));
    const updatedMembersStr = JSON.stringify(updatedMembers.map((m: any) => ({ 
      name: m?.name, 
      role: m?.role, 
      plannedVelocity: m?.plannedVelocity 
    })));
    
    // 実際に変更があった場合のみsetMembersを呼び出す
    if (currentLocalMembersStr !== updatedMembersStr) {
      isUpdatingRef.current = true;
      setMembers(updatedMembers);
      prevSettingsMembersRef.current = [...currentMembers];
      // onMembersChangeは、settings.membersからの更新時には呼び出さない（無限ループを防ぐため）
      // ユーザーが直接編集した場合のみonMembersChangeを呼び出す
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 0);
    } else {
      // 内容が同じでも、参照が変わっている可能性があるので、prevSettingsMembersRefを更新
      prevSettingsMembersRef.current = [...currentMembers];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.members, initialMembers]);

  const onAdd = () => {
    setMembers((prevMembers) => {
      const currentMembers = Array.isArray(prevMembers) ? prevMembers : [];
      const newMembers = [...currentMembers, { name: "", role: "FE", plannedVelocity: 0 }];
      // ユーザー操作なので isUpdatingRef は設定しない（onMembersChangeを呼び出すため）
      return newMembers;
    });
  };
  const onChange = React.useCallback((idx: number, key: string, value: any) => {
    setMembers((prevMembers) => {
      const currentMembers = Array.isArray(prevMembers) ? prevMembers : [];
      const copy = [...currentMembers];
      if (copy[idx]) {
        copy[idx] = { ...copy[idx], [key]: value };
        // スクロール位置を保存
        scrollPositionRef.current = window.scrollY || window.pageYOffset || 0;
        // ユーザー操作なので isUpdatingRef は設定しない（onMembersChangeを呼び出すため）
        return copy;
      }
      return prevMembers;
    });
  }, []);

  // membersの変更を監視してonMembersChangeを呼び出す
  // ただし、initialMembersが提供されている場合は呼び出さない（親コンポーネントの再レンダリングを防ぐため）
  const prevMembersForChangeRef = React.useRef<any[] | null>(null);
  React.useEffect(() => {
    // initialMembersが提供されている場合は、onMembersChangeを呼び出さない
    if (initialMembers !== undefined) {
      return;
    }
    // settings.membersからの更新時はスキップ
    if (isUpdatingRef.current) {
      return;
    }
    // 前回と同じ内容なら呼び出さない
    const prevMembersStr = JSON.stringify(prevMembersForChangeRef.current);
    const currentMembersStr = JSON.stringify(members);
    if (prevMembersStr === currentMembersStr) {
      return;
    }
    prevMembersForChangeRef.current = members;
    // 即座にonMembersChangeを呼び出す
    if (onMembersChange) {
      onMembersChange(members);
    }
  }, [members, onMembersChange, initialMembers]);

  // レンダリング後にスクロール位置を復元
  React.useLayoutEffect(() => {
    if (scrollPositionRef.current > 0) {
      window.scrollTo(0, scrollPositionRef.current);
      scrollPositionRef.current = 0;
    }
  });

  const onRemove = (idx: number) => {
    setMembers((prevMembers) => {
      const currentMembers = Array.isArray(prevMembers) ? prevMembers : [];
      const newMembers = currentMembers.filter((_, i) => i !== idx);
      // ユーザー操作なので isUpdatingRef は設定しない（onMembersChangeを呼び出すため）
      return newMembers;
    });
  };

  const validateMembers = (): string[] => {
    const errs: string[] = [];
    const currentMembers = Array.isArray(members) ? members : [];
    currentMembers.forEach((m: any, i: number) => {
      if (!m?.name || m.name.trim() === "") errs.push(`行 ${i + 1}: 氏名は必須です`);
      if (Number.isNaN(Number(m?.plannedVelocity)) || Number(m?.plannedVelocity) < 0) errs.push(`行 ${i + 1}: plannedVelocity は 0 以上の数値である必要があります`);
    });
    return errs;
  };

  const onSave = () => {
    const errs = validateMembers();
    if (errs.length > 0) {
      alert("エラー:\n" + errs.join("\n"));
      return;
    }
    setSettings({ ...settings, members });
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <h4 style={{ margin: 0 }}>メンバー情報</h4>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="secondary" onClick={onAdd}>
            メンバーを追加
          </Button>
          {!hideSaveButton && (
            <Button variant="primary" onClick={onSave}>
              保存
            </Button>
          )}
        </div>
      </div>
      <table style={{ width: "100%", marginBottom: 8 }}>
        <thead>
          <tr>
            <th>氏名</th>
            <th>担当</th>
            <th>計画ベロシティ (pt/day)</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {Array.isArray(members) && members.map((m: any, idx: number) => (
            <tr key={`member-${idx}`}>
              <td>
                <label>
                  <span className="visually-hidden">氏名</span>
                  <input
                    key={`name-${idx}`}
                    aria-label={`氏名 ${idx + 1}`}
                    value={m.name}
                    onChange={(e) => onChange(idx, "name", e.target.value)}
                  />
                </label>
              </td>
              <td>
                <label>
                  <span className="visually-hidden">担当</span>
                  <select key={`role-${idx}`} aria-label={`担当 ${idx + 1}`} value={m.role} onChange={(e) => onChange(idx, "role", e.target.value)}>
                    <option value="FE">FE</option>
                    <option value="BE">BE</option>
                    <option value="テスト">テスト</option>
                  </select>
                </label>
              </td>
              <td>
                <label>
                  <span className="visually-hidden">計画ベロシティ</span>
                  <input
                    key={`velocity-${idx}`}
                    aria-label={`計画ベロシティ ${idx + 1}`}
                    type="number"
                    value={m.plannedVelocity}
                    onChange={(e) => onChange(idx, "plannedVelocity", Number(e.target.value))}
                  />
                </label>
              </td>
              <td>
                <Button variant="secondary" size="sm" onClick={() => onRemove(idx)}>
                  削除
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* buttons moved to header */}
    </div>
  );
});

MembersEditor.displayName = "MembersEditor";

export default memo(MembersEditor);

