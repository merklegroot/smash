export type TrainingSet = {
  id: string;
  name: string;
  /** Kanji characters (`KanjiItem.kanji`), deduped when saving */
  kanjiChars: string[];
  createdAt: string;
};
