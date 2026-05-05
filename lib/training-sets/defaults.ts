import defaultTrainingSets from "@/data/n5-training-sets.json";
import type { TrainingSet } from "./types";

/**
 * Source of truth: `data/n5-training-sets.json` (static; not user-edited in the app).
 * Every entry is an N5 training set (N5-only kanji from `data/n5.json`), ordered for level
 * labels 1-1, 1-2, … in Smash. Themed after a common N5 study breakdown; each set only includes
 * characters that exist in `data/n5.json`. Omitted: body parts, 分/週/店/駅/道, several
 * nature/adjective/school characters not in the deck, and the “look-alike” set (not enough of
 * those kanji in data). Meanings in the source list are for study reference; the app stores
 * kanji only.
 */
export const DEFAULT_TRAINING_SETS: TrainingSet[] = defaultTrainingSets;
