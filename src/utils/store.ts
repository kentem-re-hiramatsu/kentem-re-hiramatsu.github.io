import create from "zustand";

export type Feature = {
  id: string;
  title: string;
  category?: string;
  storyPoints?: number | null;
  estimatedHours?: number | null;
  actualHours?: number | null;
  iteration?: number | null;
  status?: string;
  assignee?: string;
};

type Settings = {
  includePRinDone?: boolean;
  [k: string]: any;
};

type AppState = {
  features: Feature[];
  settings: Settings;
  lastUpdated?: number;
  setFeatures: (f: Feature[]) => void;
  clearFeatures: () => void;
  setSettings: (s: Settings) => void;
};

const useStore = create<AppState>((set) => ({
  features: [],
  settings: { includePRinDone: false },
  lastUpdated: Date.now(),
  setFeatures: (f: Feature[]) => set({ features: f, lastUpdated: Date.now() }),
  clearFeatures: () => set({ features: [], lastUpdated: Date.now() }),
  setSettings: (s: Settings) => {
    // 配列も新しい配列として作成して、変更を確実に検知できるようにする
    const newSettings: Settings = { ...s };
    if (Array.isArray(s.members)) {
      newSettings.members = [...s.members];
    }
    if (Array.isArray(s.iterations)) {
      newSettings.iterations = [...s.iterations];
    }
    set({ settings: newSettings, lastUpdated: Date.now() });
  },
}));

export default useStore;

