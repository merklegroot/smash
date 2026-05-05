import { N4_TRAINING_SETS, N5_TRAINING_SETS } from "./defaults";
import type { TrainingSet } from "./types";

/** JLPT tier shown as the first segment of “1-2” / “2-3” (N5 → 1, N4 → 2). */
export const N5_LEVEL_MAJOR = 1;
export const N4_LEVEL_MAJOR = 2;

export function formatJlptLevel(major: number, minor: number): string {
  return `${major}-${minor}`;
}

export type TierLevelRow = {
  levelLabel: string;
  minor: number;
  set: TrainingSet;
};

function listLevelRowsForCatalog(
  catalog: TrainingSet[],
  sets: TrainingSet[],
  major: number,
): TierLevelRow[] {
  const byId = new Map(sets.map((s) => [s.id, s]));
  const rows: TierLevelRow[] = [];

  for (let i = 0; i < catalog.length; i += 1) {
    const def = catalog[i]!;
    const set = byId.get(def.id);

    if (set) {
      const minor = i + 1;
      rows.push({
        levelLabel: formatJlptLevel(major, minor),
        minor,
        set,
      });
    }
  }

  return rows;
}

export function listN5LevelRows(sets: TrainingSet[]): TierLevelRow[] {
  return listLevelRowsForCatalog(N5_TRAINING_SETS, sets, N5_LEVEL_MAJOR);
}

export function listN4LevelRows(sets: TrainingSet[]): TierLevelRow[] {
  return listLevelRowsForCatalog(N4_TRAINING_SETS, sets, N4_LEVEL_MAJOR);
}

/** “1-1”, “2-3”, … when this set is in the bundled N5 or N4 catalogs (matched by id). */
export function trainingSetLevelLabel(set: TrainingSet): string | null {
  const n5Index = N5_TRAINING_SETS.findIndex((s) => s.id === set.id);
  if (n5Index >= 0) {
    return formatJlptLevel(N5_LEVEL_MAJOR, n5Index + 1);
  }

  const n4Index = N4_TRAINING_SETS.findIndex((s) => s.id === set.id);
  if (n4Index >= 0) {
    return formatJlptLevel(N4_LEVEL_MAJOR, n4Index + 1);
  }

  return null;
}

/** @deprecated Prefer {@link trainingSetLevelLabel} — name kept for older imports. */
export const n5LevelLabelForTrainingSet = trainingSetLevelLabel;
