const STORAGE_KEY = "smash-level-clear-progress";

export type LevelClearEntry = {
  /** Kanji answered correctly at least once as the meaning prompt for the current run. */
  cleared: string[];
  /** Wrong guesses made during the current run. */
  wrongCount: number;
  /** Best stars earned for this training set (0-3). */
  stars: number;
};

export type LevelClearProgress = Record<string, LevelClearEntry>;

function normalizeEntry(value: unknown): LevelClearEntry | null {
  // Back-compat: older shape stored an array of cleared kanji only.
  if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
    return { cleared: value, wrongCount: 0, stars: value.length > 0 ? 1 : 0 };
  }
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const clearedRaw = record.cleared;
  const wrongCountRaw = record.wrongCount;
  const starsRaw = record.stars;

  const cleared =
    Array.isArray(clearedRaw) && clearedRaw.every((v) => typeof v === "string")
      ? clearedRaw
      : [];
  const wrongCount = typeof wrongCountRaw === "number" && Number.isFinite(wrongCountRaw) ? wrongCountRaw : 0;
  const stars = typeof starsRaw === "number" && Number.isFinite(starsRaw) ? starsRaw : 0;

  return {
    cleared,
    wrongCount: Math.max(0, Math.floor(wrongCount)),
    stars: Math.max(0, Math.min(3, Math.floor(stars))),
  };
}

export function loadLevelClearProgress(): LevelClearProgress {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: LevelClearProgress = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      const entry = normalizeEntry(value);
      if (entry) {
        out[key] = entry;
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

export function starCountForTrainingSet(setId: string, progress: LevelClearProgress): number {
  return progress[setId]?.stars ?? 0;
}

export function hasStarForTrainingSet(
  setId: string,
  kanjiChars: string[],
  progress: LevelClearProgress,
): boolean {
  return starCountForTrainingSet(setId, progress) > 0 && kanjiChars.length > 0;
}

export function recordWrongGuess(
  progress: LevelClearProgress,
  trainingSetId: string,
): LevelClearProgress {
  const current = progress[trainingSetId] ?? { cleared: [], wrongCount: 0, stars: 0 };
  return {
    ...progress,
    [trainingSetId]: {
      ...current,
      wrongCount: current.wrongCount + 1,
    },
  };
}

export function resetTrainingSetRun(progress: LevelClearProgress, trainingSetId: string): LevelClearProgress {
  const current = progress[trainingSetId] ?? { cleared: [], wrongCount: 0, stars: 0 };
  return {
    ...progress,
    [trainingSetId]: {
      ...current,
      cleared: [],
      wrongCount: 0,
    },
  };
}

export function recordTargetCleared(
  progress: LevelClearProgress,
  trainingSetId: string,
  targetKanji: string,
  requiredKanji: string[],
): { next: LevelClearProgress; earnedStars: number | null } {
  if (!requiredKanji.includes(targetKanji)) {
    return { next: progress, earnedStars: null };
  }

  const current = progress[trainingSetId] ?? { cleared: [], wrongCount: 0, stars: 0 };
  const wasComplete =
    requiredKanji.length > 0 &&
    requiredKanji.every((k) => new Set(current.cleared).has(k));

  const merged = new Set(current.cleared);
  merged.add(targetKanji);
  const nextEntry: LevelClearEntry = {
    ...current,
    cleared: Array.from(merged),
  };

  const isComplete =
    requiredKanji.length > 0 &&
    requiredKanji.every((k) => new Set(nextEntry.cleared).has(k));

  if (!wasComplete && isComplete) {
    const runStars =
      nextEntry.wrongCount === 0 ? 3 : nextEntry.wrongCount === 1 ? 2 : 1;
    const next: LevelClearProgress = {
      ...progress,
      [trainingSetId]: {
        ...nextEntry,
        stars: Math.max(nextEntry.stars, runStars),
      },
    };
    return { next, earnedStars: runStars };
  }

  const next: LevelClearProgress = {
    ...progress,
    [trainingSetId]: nextEntry,
  };
  return { next, earnedStars: null };
}
