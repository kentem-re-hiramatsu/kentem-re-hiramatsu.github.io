import React, { useState } from "react";
import useStore from "../../utils/store";
import FileImporter from "../FileImporter";

const Step1_TSV: React.FC<{ onNext: () => void; onComplete: () => void }> = ({
  onNext,
  onComplete,
}) => {
  const features = useStore((s) => s.features);
  const [imported, setImported] = useState(false);

  const handleImportComplete = () => {
    setImported(true);
    // TSV取り込み完了後、自動的にマッピング画面（ステップ2）に遷移
    setTimeout(() => {
      onComplete(); // ステップ2に遷移
    }, 500);
  };

  return (
    <div>
      <h3>ステップ2: TSV 取込み</h3>
      <p>フィーチャー TSV ファイルをアップロードしてください。</p>
      <FileImporter skipHeaderCheck={true} onImportComplete={handleImportComplete} />
      {imported && features.length > 0 && (
        <div
          style={{
            marginTop: 12,
            padding: 8,
            background: "var(--success-light)",
            borderRadius: 4,
          }}
        >
          <p style={{ margin: 0 }}>
            ✓ {features.length} 件のフィーチャーが読み込まれました。マッピング画面に遷移します...
          </p>
        </div>
      )}
    </div>
  );
};

export default Step1_TSV;
