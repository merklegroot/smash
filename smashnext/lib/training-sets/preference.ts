const STORAGE_KEY = "smash-pool-preference";

/** Preferred training set id for Smash. `null` = unset or legacy "automatic deck" preference. */
export function loadSmashPoolPreference(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const o = parsed as Record<string, unknown>;
    if (o.mode === "auto") return null;
    if (
      o.mode === "training-set" &&
      typeof o.trainingSetId === "string" &&
      o.trainingSetId.length > 0
    ) {
      return o.trainingSetId;
    }
    if (typeof o.trainingSetId === "string" && o.trainingSetId.length > 0) {
      return o.trainingSetId;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function saveSmashPoolPreference(trainingSetId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ trainingSetId }));
}
