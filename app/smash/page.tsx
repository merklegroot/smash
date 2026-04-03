"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type KanjiApiItem = {
  kanji: string;
  meaning: string;
};

type KanjiApiResponse = {
  kanji: KanjiApiItem[];
};

type ToastState = {
  message: string;
  isCorrect: boolean;
};

const GRID_SIZE = 9;

function getRandomKanji(items: KanjiApiItem[]) {
  const randomIndex = Math.floor(Math.random() * items.length);
  return items[randomIndex] ?? { kanji: "?", meaning: "Unknown" };
}

export default function SmashPage() {
  const [kanjiItems, setKanjiItems] = useState<KanjiApiItem[]>([]);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadKanji() {
      try {
        const response = await fetch("/api/kanji");
        const data = (await response.json()) as KanjiApiResponse;

        if (!response.ok || !Array.isArray(data.kanji)) {
          return;
        }

        if (isMounted) {
          setKanjiItems(data.kanji);
        }
      } catch {
        // Ignore fetch failures and keep fallback labels.
      }
    }

    loadKanji();

    return () => {
      isMounted = false;
    };
  }, []);

  const gridKanji = useMemo(() => {
    return Array.from({ length: GRID_SIZE }, () => getRandomKanji(kanjiItems));
  }, [kanjiItems]);

  const targetKanji = useMemo(() => {
    const randomIndex = Math.floor(Math.random() * gridKanji.length);
    return gridKanji[randomIndex] ?? { kanji: "?", meaning: "Unknown" };
  }, [gridKanji]);

  function showToast(nextToast: ToastState) {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    setToast(nextToast);
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
      toastTimeoutRef.current = null;
    }, 2000);
  }

  function handleKanjiClick(clickedKanji: string) {
    const isCorrect = clickedKanji === targetKanji.kanji;
    showToast({
      isCorrect,
      message: isCorrect ? "Correct choice!" : "Not quite, try again.",
    });
  }

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  return (
    <section className="flex flex-1 items-center justify-center p-6">
      <div className="flex flex-col items-center gap-4">
        {toast ? (
          <p
            role="status"
            className={`rounded-md px-4 py-2 text-sm font-medium text-white ${
              toast.isCorrect ? "bg-emerald-600" : "bg-rose-600"
            }`}
          >
            {toast.message}
          </p>
        ) : null}
        <p className="text-lg font-medium text-zinc-700">Meaning: {targetKanji.meaning}</p>
        <div className="grid grid-cols-3 gap-4">
          {gridKanji.map((item, index) => (
            <button
              key={`${item.kanji}-${index}`}
              type="button"
              className="aspect-square w-24 cursor-pointer rounded-xl border border-zinc-300 bg-white text-4xl font-semibold shadow-sm transition hover:bg-zinc-50"
              onClick={() => handleKanjiClick(item.kanji)}
            >
              {item.kanji}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
