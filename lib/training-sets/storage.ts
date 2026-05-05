import { DEFAULT_TRAINING_SETS } from "./defaults";
import type { TrainingSet } from "./types";

/** Static catalog from `data/n5-training-sets.json` — not persisted or user-editable. */
export function loadTrainingSets(): TrainingSet[] {
  return DEFAULT_TRAINING_SETS.map((s) => ({
    ...s,
    kanjiChars: [...s.kanjiChars],
  }));
}
