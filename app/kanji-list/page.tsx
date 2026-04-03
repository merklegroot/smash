"use client";

import { useEffect, useState } from "react";

type KanjiItem = {
  kanji: string;
  meaning: string;
};

export default function KanjiList() {
  const [kanji, setKanji] = useState<KanjiItem[]>([]);
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
        <ul className="w-full max-w-md space-y-2">
          {kanji.map((item) => (
            <li
              key={item.kanji}
              className="flex items-center justify-between rounded border border-black/10 px-4 py-2"
            >
              <span className="text-2xl">{item.kanji}</span>
              <span>{item.meaning}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
