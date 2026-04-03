"use client";

import { useEffect, useState } from "react";

type KanjiItem = {
  kanji: string;
  meaning: string;
  onReading: { kana: string; romaji: string }[];
  kunReading: { kana: string; romaji: string }[];
  commonWords: {
    word: string;
    readingKana: string;
    readingRomaji: string;
    meaning: string;
  }[];
};

function formatReadings(readings: { kana: string; romaji: string }[]) {
  return readings.map((reading) => `${reading.kana} (${reading.romaji})`).join(", ");
}

export default function KanjiList() {
  const [kanji, setKanji] = useState<KanjiItem[]>([]);
  const [selectedKanji, setSelectedKanji] = useState<KanjiItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    async function loadKanji() {
      try {
        const response = await fetch("/api/kanji");
        if (!response.ok) {
          throw new Error("Failed to load kanji.");
        }

        const data: { kanji: KanjiItem[] } = await response.json();
        setKanji(data.kanji);
        setSelectedKanji(data.kanji[0] ?? null);
      } catch {
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    }

    loadKanji();
  }, []);

  return (
    <section className="flex flex-1 flex-col items-center gap-6">
      <h1 className="text-3xl font-semibold">Kanji List</h1>
      {isLoading && <p>Loading...</p>}
      {hasError && <p>Could not load kanji.</p>}
      {!isLoading && !hasError && (
        <div className="grid w-full max-w-5xl gap-6 md:grid-cols-2">
          <ul className="space-y-2">
            {kanji.map((item) => (
              <li key={item.kanji}>
                <button
                  type="button"
                  onClick={() => setSelectedKanji(item)}
                  className="flex w-full items-center justify-between rounded border border-black/10 px-4 py-2 text-left hover:bg-black/5"
                >
                  <span className="text-2xl">{item.kanji}</span>
                  <span>{item.meaning}</span>
                </button>
              </li>
            ))}
          </ul>
          <aside className="rounded border border-black/10 p-4">
            {selectedKanji ? (
              <div className="space-y-3">
                <h2 className="text-2xl font-semibold">{selectedKanji.kanji}</h2>
                <p>{selectedKanji.meaning}</p>
                <p>
                  <span className="font-semibold">On:</span>{" "}
                  {formatReadings(selectedKanji.onReading)}
                </p>
                <p>
                  <span className="font-semibold">Kun:</span>{" "}
                  {formatReadings(selectedKanji.kunReading)}
                </p>
                <div>
                  <p className="font-semibold">Common words:</p>
                  <ul className="mt-2 space-y-1">
                    {selectedKanji.commonWords.map((word) => (
                      <li key={`${selectedKanji.kanji}-${word.word}`}>
                        {word.word} - {word.readingKana} ({word.readingRomaji}):{" "}
                        {word.meaning}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p>Select a kanji to view details.</p>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}
