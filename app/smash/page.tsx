"use client";

import { useEffect, useState } from "react";

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

type RoundState = {
  target: KanjiApiItem;
  buttons: KanjiApiItem[];
};

const GRID_SIZE = 9;
const TOAST_LIFETIME_MS = 2400;
const TOAST_EXIT_MS = 300;
const FALLBACK_KANJI: KanjiApiItem = { kanji: "?", meaning: "Unknown" };

function getRandomKanji(items: KanjiApiItem[]) {
  const randomIndex = Math.floor(Math.random() * items.length);
  return items[randomIndex] ?? FALLBACK_KANJI;
}

function createRound(items: KanjiApiItem[], previousTargetKanji?: string): RoundState {
  if (items.length === 0) {
    return {
      target: FALLBACK_KANJI,
      buttons: Array.from({ length: GRID_SIZE }, () => FALLBACK_KANJI),
    };
  }

  const targetPool =
    items.length > 1
      ? items.filter((item) => item.kanji !== previousTargetKanji)
      : items;

  const target = getRandomKanji(targetPool.length > 0 ? targetPool : items);
  const buttons = Array.from({ length: GRID_SIZE }, () => getRandomKanji(items));

  // Guarantee at least one correct answer in every board.
  if (!buttons.some((button) => button.kanji === target.kanji)) {
    const replaceIndex = Math.floor(Math.random() * buttons.length);
    buttons[replaceIndex] = target;
  }

  return { target, buttons };
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
      className={`w-full cursor-pointer rounded-md px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-300 ${
        isVisible ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
      } ${toast.isCorrect ? "bg-emerald-600" : "bg-rose-600"}`}
      onClick={() => onDone(toast.id)}
    >
      {toast.message}
    </p>
  );
}

export default function SmashPage() {
  const [kanjiItems, setKanjiItems] = useState<KanjiApiItem[]>([]);
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const [round, setRound] = useState<RoundState>(() => createRound([]));

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
          setRound(createRound(data.kanji));
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
    const isCorrect = clickedKanji === round.target.kanji;
    showToast({
      isCorrect,
      message: isCorrect ? "Correct choice!" : "Not quite, try again.",
    });

    if (isCorrect) {
      setRound((currentRound) => createRound(kanjiItems, currentRound.target.kanji));
    }
  }

  function removeToast(toastId: string) {
    setToasts((currentToasts) =>
      currentToasts.filter((toast) => toast.id !== toastId),
    );
  }

  return (
    <section className="relative flex flex-1 items-center justify-center p-6">
      <div className="absolute left-1/2 top-6 z-10 w-full max-w-64 -translate-x-1/2 space-y-2">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDone={removeToast} />
        ))}
      </div>
      <div className="flex flex-col items-center gap-4">
        <p className="text-lg font-medium text-zinc-700">Meaning: {round.target.meaning}</p>
        <div className="grid grid-cols-3 gap-4">
          {round.buttons.map((item, index) => (
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
