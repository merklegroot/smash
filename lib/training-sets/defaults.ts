import defaultTrainingSets from "@/data/training-sets-defaults.json";
import type { TrainingSet } from "./types";

/**
 * Seeded when localStorage has no training sets yet (`smash-training-sets` missing).
 *
 * Source of truth: `data/training-sets-defaults.json`. Themed after a common N5 study
 * breakdown; each set only includes characters that exist in `data/n5.json`. Omitted:
 * body parts, 分/週/店/駅/道, several nature/adjective/school characters not in the
 * deck, and the “look-alike” set (not enough of those kanji in data). Meanings in the
 * source list are for study reference; the app stores kanji only.
 */
export const DEFAULT_TRAINING_SETS: TrainingSet[] = defaultTrainingSets;
