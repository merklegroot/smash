export type Reading = {
  kana: string;
  romaji: string;
};

export type CommonWord = {
  word: string;
  readingKana: string;
  readingRomaji: string;
  meaning: string;
};

export type KanjiItem = {
  kanji: string;
  /** Main gloss; may include several comma- or slash-separated senses in one string. */
  primaryMeaning: string;
  /** Optional extra glosses or notes (e.g. secondary sense, disambiguation). */
  otherMeaning?: string;
  onReading: Reading[];
  kunReading: Reading[];
  commonWords: CommonWord[];
};

export type KanjiLevelId = "n5" | "n4";

export type KanjiApiResponse = {
  /** N5 first, then N4 entries whose character is not already in N5 (stable pool for drills). */
  kanji: KanjiItem[];
  n5: KanjiItem[];
  n4: KanjiItem[];
};
