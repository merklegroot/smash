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
    <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Kanji List</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          Select a kanji to see readings and example words.
        </p>
      </header>
      {isLoading && (
        <div className="rounded-2xl border border-black/10 bg-black/[0.02] px-4 py-10 text-center text-black/60 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/60">
          Loading kanji...
        </div>
      )}
      {hasError && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-10 text-center text-red-700 dark:text-red-300">
          Could not load kanji.
        </div>
      )}
      {!isLoading && !hasError && (
        <div className="grid w-full gap-6 lg:grid-cols-[340px_1fr]">
          <div className="rounded-2xl border border-black/10 bg-white/70 p-3 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
            <ul className="space-y-2">
            {kanji.map((item) => (
              <li key={item.kanji}>
                <button
                  type="button"
                  onClick={() => setSelectedKanji(item)}
                  className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                    selectedKanji?.kanji === item.kanji
                      ? "border-black/30 bg-black/10 shadow-sm dark:border-white/30 dark:bg-white/10"
                      : "border-black/10 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"
                  }`}
                >
                  <span className="text-2xl font-semibold">{item.kanji}</span>
                  <span className="text-sm text-black/70 dark:text-white/70">
                    {item.meaning}
                  </span>
                </button>
              </li>
            ))}
            </ul>
          </div>
          <aside className="rounded-2xl border border-black/10 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
            {selectedKanji ? (
              <div className="space-y-5">
                <div className="flex items-end justify-between border-b border-black/10 pb-4 dark:border-white/10">
                  <h2 className="text-5xl font-semibold leading-none">
                    {selectedKanji.kanji}
                  </h2>
                  <p className="text-sm text-black/70 dark:text-white/70">
                    {selectedKanji.meaning}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-black/10 bg-black/[0.03] p-3 dark:border-white/10 dark:bg-white/[0.03]">
                    <p className="mb-1 text-sm font-semibold">On Reading</p>
                    <p className="text-sm">{formatReadings(selectedKanji.onReading)}</p>
                  </div>
                  <div className="rounded-xl border border-black/10 bg-black/[0.03] p-3 dark:border-white/10 dark:bg-white/[0.03]">
                    <p className="mb-1 text-sm font-semibold">Kun Reading</p>
                    <p className="text-sm">{formatReadings(selectedKanji.kunReading)}</p>
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-black/60 dark:text-white/60">
                    Common words
                  </p>
                  <ul className="space-y-2">
                    {selectedKanji.commonWords.map((word) => (
                      <li
                        key={`${selectedKanji.kanji}-${word.word}`}
                        className="rounded-xl border border-black/10 px-3 py-2 dark:border-white/10"
                      >
                        <p className="text-lg font-medium">{word.word}</p>
                        <p className="text-sm text-black/70 dark:text-white/70">
                          {word.readingKana} ({word.readingRomaji})
                        </p>
                        <p className="text-sm">{word.meaning}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="text-black/60 dark:text-white/60">
                Select a kanji to view details.
              </p>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}
