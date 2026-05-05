import { DEFAULT_TRAINING_SETS } from "./defaults";
import type { TrainingSet } from "./types";

/** Major tier for every seeded default set (all are N5); first segment of “1-2”, etc. */
export const N5_LEVEL_MAJOR = 1;

export function formatN5Level(minor: number): string {
  return `${N5_LEVEL_MAJOR}-${minor}`;
}

/** Seeded N5 default id → 1-based minor level from `n5-training-sets.json` order, or null if not in that catalog. */
export function n5MinorLevelForDefaultSetId(id: string): number | null {
  const index = DEFAULT_TRAINING_SETS.findIndex((s) => s.id === id);
  if (index < 0) {
    return null;
  }

  return index + 1;
}

/** “1-1”, “1-2”, … when this set matches a seeded N5 default (id in `DEFAULT_TRAINING_SETS`). */
export function n5LevelLabelForTrainingSet(set: TrainingSet): string | null {
  const minor = n5MinorLevelForDefaultSetId(set.id);
  if (minor == null) {
    return null;
  }

  return formatN5Level(minor);
}

export type N5LevelRow = {
  levelLabel: string;
  minor: number;
  set: TrainingSet;
};

/**
 * Seeded N5 sets that appear in `sets`, in catalog order, each with level 1-1, 1-2, …
 */
export function listN5LevelRows(sets: TrainingSet[]): N5LevelRow[] {
  const byId = new Map(sets.map((s) => [s.id, s]));
  const rows: N5LevelRow[] = [];

  for (let i = 0; i < DEFAULT_TRAINING_SETS.length; i += 1) {
    const def = DEFAULT_TRAINING_SETS[i]!;
    const set = byId.get(def.id);

    if (set) {
      const minor = i + 1;
      rows.push({
        levelLabel: formatN5Level(minor),
        minor,
        set,
      });
    }
  }

  return rows;
}
