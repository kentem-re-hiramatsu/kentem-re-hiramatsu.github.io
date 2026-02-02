import { Feature } from "./store";

export type StatusMappings = Record<string, string>;

export function mapStatus(raw: string | undefined, mappings?: StatusMappings): string | null {
  if (!raw) return null;
  const key = raw.trim();
  if (mappings) {
    // try direct match first (case-sensitive), then lowercase
    if (mappings[key]) return mappings[key];
    const lower = key.toLowerCase();
    for (const k of Object.keys(mappings)) {
      if (k.toLowerCase() === lower) return mappings[k];
    }
  }
  // default normalization
  const lower = key.toLowerCase();
  if (["完了", "done", "完了済み"].includes(key) || lower === "done") return "完了";
  if (["プルリク中", "in_pr", "in pr", "pr"].includes(lower)) return "プルリク中";
  return key;
}

export function isDone(feature: Feature, settings?: any, mappings?: StatusMappings): boolean {
  const mapped = mapStatus(feature.status ?? "", mappings);
  if (!mapped) return false;
  if (mapped === "完了") return true;
  const includePR = !!settings?.includePRinDone;
  if (includePR && mapped === "プルリク中") return true;
  return false;
}

