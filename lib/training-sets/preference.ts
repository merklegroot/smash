export type SmashPoolPreference =
  | { mode: "auto" }
  | { mode: "training-set"; trainingSetId: string };

const STORAGE_KEY = "smash-pool-preference";

export function loadSmashPoolPreference(): SmashPoolPreference {
  if (typeof window === "undefined") return { mode: "auto" };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { mode: "auto" };
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return { mode: "auto" };
    const o = parsed as Record<string, unknown>;
    if (o.mode === "auto") return { mode: "auto" };
    if (
      o.mode === "training-set" &&
      typeof o.trainingSetId === "string" &&
      o.trainingSetId.length > 0
    ) {
      return { mode: "training-set", trainingSetId: o.trainingSetId };
    }
  } catch {
    /* ignore */
  }
  return { mode: "auto" };
}

export function saveSmashPoolPreference(pref: SmashPoolPreference): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pref));
}
