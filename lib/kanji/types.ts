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
  meaning: string;
  onReading: Reading[];
  kunReading: Reading[];
  commonWords: CommonWord[];
};

export type KanjiApiResponse = {
  kanji: KanjiItem[];
};
