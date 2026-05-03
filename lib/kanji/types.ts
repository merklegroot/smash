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

export type KanjiApiResponse = {
  kanji: KanjiItem[];
};
