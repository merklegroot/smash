import type { TrainingSet } from "./types";

const STORAGE_KEY = "smash-training-sets";

function isTrainingSet(value: unknown): value is TrainingSet {
  if (value === null || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.name === "string" &&
    Array.isArray(o.kanjiChars) &&
    o.kanjiChars.every((c) => typeof c === "string") &&
    typeof o.createdAt === "string"
  );
}

export function loadTrainingSets(): TrainingSet[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isTrainingSet);
  } catch {
    return [];
  }
}

export function saveTrainingSets(sets: TrainingSet[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sets));
}

export function createTrainingSetId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
