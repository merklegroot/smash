import n4TrainingSets from "@/data/n4-training-sets.json";
import n5TrainingSets from "@/data/n5-training-sets.json";
import type { TrainingSet } from "./types";

/**
 * Source of truth: `data/n5-training-sets.json` — static N5 sets (kanji from `data/n5.json`),
 * ordered for levels 1-1, 1-2, … in Smash.
 */
export const N5_TRAINING_SETS: TrainingSet[] = n5TrainingSets;

/**
 * Source of truth: `data/n4-training-sets.json` — static N4 sets (kanji from `data/n4.json`),
 * ordered for levels 2-1, 2-2, … (tier 2 = N4).
 */
export const N4_TRAINING_SETS: TrainingSet[] = n4TrainingSets;

/** Full catalog: all N5 sets first, then all N4 sets (Smash pool dropdown and training-set browser). */
export const ALL_TRAINING_SETS: TrainingSet[] = [...N5_TRAINING_SETS, ...N4_TRAINING_SETS];
