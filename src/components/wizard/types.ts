export interface WizardStepProps {
  onNext: () => void;
  onBack: () => void;
}

export interface Step1Props {
  onNext: () => void;
  onComplete: () => void;
}

export interface Step3JSONCheckProps {
  onNext: () => void;
  onHasJSON: () => void;
  hasJSON: boolean | null;
  setHasJSON: (value: boolean | null) => void;
}

export interface Step3bJSONImportProps {
  onNext: () => void;
  onBack: () => void;
  onApply: (s: any) => void;
  onConfirmApplyReady?: (ready: boolean, applyFn: () => void) => void;
}

export interface Step9Props {
  onComplete: () => void;
  onBack: () => void;
  onExport: () => void;
}
