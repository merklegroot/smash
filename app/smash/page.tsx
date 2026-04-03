"use client";

import { useEffect, useMemo, useState } from "react";

type KanjiApiItem = {
  kanji: string;
  meaning: string;
};

type KanjiApiResponse = {
  kanji: KanjiApiItem[];
};

type ToastState = {
  id: string;
  message: string;
  isCorrect: boolean;
};

const GRID_SIZE = 9;
const TOAST_LIFETIME_MS = 2400;
const TOAST_EXIT_MS = 300;

function getRandomKanji(items: KanjiApiItem[]) {
  const randomIndex = Math.floor(Math.random() * items.length);
  return items[randomIndex] ?? { kanji: "?", meaning: "Unknown" };
}

function Toast({
  toast,
  onDone,
}: {
  toast: ToastState;
  onDone: (toastId: string) => void;
}) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const enterFrame = requestAnimationFrame(() => {
      setIsVisible(true);
    });

    const exitTimer = setTimeout(() => {
      setIsVisible(false);
    }, TOAST_LIFETIME_MS - TOAST_EXIT_MS);

    const removeTimer = setTimeout(() => {
      onDone(toast.id);
    }, TOAST_LIFETIME_MS);

    return () => {
      cancelAnimationFrame(enterFrame);
      clearTimeout(exitTimer);
      clearTimeout(removeTimer);
    };
  }, [onDone, toast.id]);

  return (
    <p
      role="status"
      className={`w-full rounded-md px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-300 ${
        isVisible ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
      } ${toast.isCorrect ? "bg-emerald-600" : "bg-rose-600"}`}
    >
      {toast.message}
    </p>
  );
}

export default function SmashPage() {
  const [kanjiItems, setKanjiItems] = useState<KanjiApiItem[]>([]);
  const [toasts, setToasts] = useState<ToastState[]>([]);

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

  function showToast(nextToast: Omit<ToastState, "id">) {
    setToasts((currentToasts) => [
      ...currentToasts,
      {
        id: `${Date.now()}-${Math.random()}`,
        ...nextToast,
      },
    ]);
  }

  function handleKanjiClick(clickedKanji: string) {
    const isCorrect = clickedKanji === targetKanji.kanji;
    showToast({
      isCorrect,
      message: isCorrect ? "Correct choice!" : "Not quite, try again.",
    });
  }

  function removeToast(toastId: string) {
    setToasts((currentToasts) =>
      currentToasts.filter((toast) => toast.id !== toastId),
    );
  }

  return (
    <section className="flex flex-1 items-center justify-center p-6">
      <div className="flex flex-col items-center gap-4">
        <div className="w-full max-w-64 space-y-2">
          {toasts.map((toast) => (
            <Toast key={toast.id} toast={toast} onDone={removeToast} />
          ))}
        </div>
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
