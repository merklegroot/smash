const STORAGE_KEY = "smash-level-clear-progress";

/** Maps training set id → kanji that have been answered correctly at least once as the meaning prompt while that set was selected. */
export type LevelClearProgress = Record<string, string[]>;

export function loadLevelClearProgress(): LevelClearProgress {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: LevelClearProgress = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
        out[key] = value;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function saveLevelClearProgress(progress: LevelClearProgress): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function hasStarForTrainingSet(
  setId: string,
  kanjiChars: string[],
  progress: LevelClearProgress,
): boolean {
  if (kanjiChars.length === 0) return false;
  const cleared = new Set(progress[setId] ?? []);
  return kanjiChars.every((k) => cleared.has(k));
}

export function recordTargetCleared(
  progress: LevelClearProgress,
  trainingSetId: string,
  targetKanji: string,
  requiredKanji: string[],
): { next: LevelClearProgress; earnedStar: boolean } {
  if (!requiredKanji.includes(targetKanji)) {
    return { next: progress, earnedStar: false };
  }

  const wasStar = hasStarForTrainingSet(trainingSetId, requiredKanji, progress);
  const merged = new Set(progress[trainingSetId] ?? []);
  merged.add(targetKanji);
  const next: LevelClearProgress = {
    ...progress,
    [trainingSetId]: Array.from(merged),
  };
  const earnedStar =
    !wasStar && hasStarForTrainingSet(trainingSetId, requiredKanji, next);

  return { next, earnedStar };
}
