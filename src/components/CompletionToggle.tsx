import React from "react";
import useStore from "../utils/store";

const CompletionToggle: React.FC = () => {
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings({ ...settings, includePRinDone: e.target.checked });
  };

  return (
    <div style={{ marginBottom: 8 }}>
      <label>
        完了判定にプルリク中を含める:
        <input
          type="checkbox"
          style={{ marginLeft: 8 }}
          checked={!!settings?.includePRinDone}
          onChange={onChange}
        />
      </label>
    </div>
  );
};

export default CompletionToggle;

