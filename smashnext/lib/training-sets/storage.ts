import { ALL_TRAINING_SETS } from "./defaults";
import type { TrainingSet } from "./types";

/** Static catalog from `data/n5-training-sets.json` and `data/n4-training-sets.json` — not persisted. */
export function loadTrainingSets(): TrainingSet[] {
  return ALL_TRAINING_SETS.map((s) => ({
    ...s,
    kanjiChars: [...s.kanjiChars],
  }));
}
