"use client";

import { useEffect, useRef, useState } from "react";

type Reading = {
  kana: string;
  romaji: string;
};

type CommonWord = {
  word: string;
  readingKana: string;
  readingRomaji: string;
  meaning: string;
};

type KanjiApiItem = {
  kanji: string;
  meaning: string;
  onReading: Reading[];
  kunReading: Reading[];
  commonWords: CommonWord[];
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

type PipOutcome = "right" | "wrong";

const GRID_SIZE = 9;
const TOAST_LIFETIME_MS = 2400;
const TOAST_EXIT_MS = 300;
const MAX_TOASTS = 5;
const CORRECT_FLASH_MS = 450;
const TRAINING_SET_SIZE = 12;
const MAX_PIPS_PER_KANJI = 8;
const FALLBACK_KANJI: KanjiApiItem = {
  kanji: "?",
  meaning: "Unknown",
  onReading: [],
  kunReading: [],
  commonWords: [],
};

function getRandomKanji(items: KanjiApiItem[]) {
  const randomIndex = Math.floor(Math.random() * items.length);
  return items[randomIndex] ?? FALLBACK_KANJI;
}

function chunkKanji(items: KanjiApiItem[], size: number) {
  const chunks: KanjiApiItem[][] = [];

  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }

  return chunks;
}

function clampNonNegativeCount(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, value);
}

function appendOutcomeWithCap(history: PipOutcome[], outcome: PipOutcome) {
  const nextHistory = [...history, outcome];
  if (nextHistory.length <= MAX_PIPS_PER_KANJI) {
    return nextHistory;
  }

  return nextHistory.slice(nextHistory.length - MAX_PIPS_PER_KANJI);
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

function formatReadings(readings: Reading[]) {
  return readings.map((reading) => `${reading.kana} (${reading.romaji})`).join(", ");
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
  const [trainingSetIndex] = useState(0);
  const [round, setRound] = useState<RoundState>(() => createRound([]));
  const [pipHistoryByKanji, setPipHistoryByKanji] = useState<Record<string, PipOutcome[]>>(
    {},
  );
  const [wrongKanjiChoices, setWrongKanjiChoices] = useState<string[]>([]);
  const [correctButtonIndex, setCorrectButtonIndex] = useState<number | null>(null);
  const [isAdvancingRound, setIsAdvancingRound] = useState(false);
  const [showDebugStats, setShowDebugStats] = useState(true);
  const [selectedKanjiDetails, setSelectedKanjiDetails] = useState<KanjiApiItem | null>(null);
  const roundAdvanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const kanjiSets = chunkKanji(kanjiItems, TRAINING_SET_SIZE);
  const currentTrainingSet = kanjiSets[trainingSetIndex] ?? [];
  const trainingKanji = Array.from(new Set(currentTrainingSet.map((item) => item.kanji)));
  const allPossibleKanji = Array.from(new Set(kanjiItems.map((item) => item.kanji)));

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
          const nextSets = chunkKanji(data.kanji, TRAINING_SET_SIZE);
          const initialTrainingSet = nextSets[trainingSetIndex] ?? [];
          setRound(createRound(initialTrainingSet));
          setWrongKanjiChoices([]);
          setCorrectButtonIndex(null);
          setIsAdvancingRound(false);
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

  useEffect(() => {
    return () => {
      if (roundAdvanceTimeoutRef.current) {
        clearTimeout(roundAdvanceTimeoutRef.current);
      }
    };
  }, []);

  function showToast(nextToast: Omit<ToastState, "id">) {
    setToasts((currentToasts) => {
      const nextToasts = [
        ...currentToasts,
        {
          id: `${Date.now()}-${Math.random()}`,
          ...nextToast,
        },
      ];

      if (nextToasts.length <= MAX_TOASTS) {
        return nextToasts;
      }

      return nextToasts.slice(nextToasts.length - MAX_TOASTS);
    });
  }

  function handleKanjiClick(clickedKanji: string, buttonIndex: number) {
    if (isAdvancingRound) {
      return;
    }

    const isCorrect = clickedKanji === round.target.kanji;
    showToast({
      isCorrect,
      message: isCorrect ? "Correct choice!" : "Not quite, try again.",
    });

    if (isCorrect) {
      setPipHistoryByKanji((currentHistory) => {
        const nextHistory = { ...currentHistory };

        if (wrongKanjiChoices.length > 0) {
          const wrongOutcomes = [...wrongKanjiChoices, round.target.kanji];
          for (const kanji of wrongOutcomes) {
            nextHistory[kanji] = appendOutcomeWithCap(nextHistory[kanji] ?? [], "wrong");
          }
        }

        nextHistory[round.target.kanji] = appendOutcomeWithCap(
          nextHistory[round.target.kanji] ?? [],
          "right",
        );

        return nextHistory;
      });
      setCorrectButtonIndex(buttonIndex);
      setIsAdvancingRound(true);

      if (roundAdvanceTimeoutRef.current) {
        clearTimeout(roundAdvanceTimeoutRef.current);
      }

      roundAdvanceTimeoutRef.current = setTimeout(() => {
        setRound((currentRound) => createRound(currentTrainingSet, currentRound.target.kanji));
        setWrongKanjiChoices([]);
        setCorrectButtonIndex(null);
        setIsAdvancingRound(false);
        roundAdvanceTimeoutRef.current = null;
      }, CORRECT_FLASH_MS);
      return;
    }

    setWrongKanjiChoices((currentWrongChoices) =>
      currentWrongChoices.includes(clickedKanji)
        ? currentWrongChoices
        : [...currentWrongChoices, clickedKanji],
    );
  }

  function removeToast(toastId: string) {
    setToasts((currentToasts) =>
      currentToasts.filter((toast) => toast.id !== toastId),
    );
  }

  function updateOutcomeCount(kanji: string, outcome: PipOutcome, nextCount: number) {
    const existingHistory = pipHistoryByKanji[kanji] ?? [];
    const oppositeOutcome: PipOutcome = outcome === "right" ? "wrong" : "right";
    const oppositeCount = existingHistory.filter(
      (existingOutcome) => existingOutcome === oppositeOutcome,
    ).length;
    const targetCount = Math.min(
      clampNonNegativeCount(nextCount),
      Math.max(0, MAX_PIPS_PER_KANJI - oppositeCount),
    );

    setPipHistoryByKanji((currentHistory) => {
      const currentKanjiHistory = currentHistory[kanji] ?? [];
      const currentCount = currentKanjiHistory.filter(
        (existingOutcome) => existingOutcome === outcome,
      ).length;

      if (currentCount === targetCount) {
        return currentHistory;
      }

      const nextHistory = [...currentKanjiHistory];

      if (targetCount > currentCount) {
        const additions = targetCount - currentCount;
        return {
          ...currentHistory,
          [kanji]: Array.from({ length: additions }).reduce<PipOutcome[]>(
            (history) => appendOutcomeWithCap(history, outcome),
            nextHistory,
          ),
        };
      }

      let toRemove = currentCount - targetCount;
      for (let i = nextHistory.length - 1; i >= 0 && toRemove > 0; i -= 1) {
        if (nextHistory[i] === outcome) {
          nextHistory.splice(i, 1);
          toRemove -= 1;
        }
      }

      return {
        ...currentHistory,
        [kanji]: nextHistory,
      };
    });
  }

  function openKanjiDetails(kanji: string) {
    setSelectedKanjiDetails((currentSelection) => {
      if (currentSelection?.kanji === kanji) {
        return null;
      }

      return kanjiItems.find((item) => item.kanji === kanji) ?? null;
    });
  }

  return (
    <section className="relative flex flex-1 items-center justify-center p-6">
      <div className="absolute right-4 top-4 z-10 w-full max-w-64 space-y-2">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDone={removeToast} />
        ))}
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-8">
          <div className="flex flex-col items-center gap-4">
            <p className="text-3xl font-semibold text-zinc-700">{round.target.meaning}</p>
            <div className="grid grid-cols-3 gap-4">
              {round.buttons.map((item, index) => (
                <button
                  key={`${item.kanji}-${index}`}
                  type="button"
                  disabled={wrongKanjiChoices.includes(item.kanji) || isAdvancingRound}
                  className={`aspect-square w-24 rounded-xl border text-4xl font-semibold shadow-sm transition ${
                    correctButtonIndex === index
                      ? "cursor-not-allowed border-emerald-500 bg-emerald-500 text-white"
                      : wrongKanjiChoices.includes(item.kanji)
                      ? "cursor-not-allowed border-rose-500 bg-rose-500 text-white"
                      : "cursor-pointer border-zinc-300 bg-white hover:bg-zinc-50"
                  }`}
                  onClick={() => handleKanjiClick(item.kanji, index)}
                >
                  {item.kanji}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex max-h-[26rem] items-stretch gap-3">
              <aside className="w-[22rem] overflow-y-auto rounded-xl border border-zinc-200 bg-white/70 px-4 py-3 shadow-sm">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Currently training
                </p>
                <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-center text-2xl font-semibold text-zinc-800 sm:grid-cols-3 xl:grid-cols-4">
                  {trainingKanji.map((kanji) => (
                    <li key={`training-${kanji}`} className="flex flex-col items-center justify-center gap-1">
                      <button
                        type="button"
                        className="w-full cursor-pointer rounded-md p-1 transition hover:bg-zinc-100"
                        onClick={() => openKanjiDetails(kanji)}
                      >
                        <span>{kanji}</span>
                        <span className="grid min-h-5 grid-cols-4 grid-rows-2 gap-1">
                          {(pipHistoryByKanji[kanji] ?? [])
                            .slice(-MAX_PIPS_PER_KANJI)
                            .map((outcome, index) => (
                              <span
                                key={`pip-${kanji}-${index}`}
                                aria-label={
                                  outcome === "right"
                                    ? "correct answer"
                                    : "missed before correct answer"
                                }
                                className={`inline-block size-2 rounded-full ${
                                  outcome === "right" ? "bg-emerald-500" : "bg-rose-500"
                                }`}
                              />
                            ))}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </aside>
              <aside className="w-[22rem] overflow-y-auto rounded-xl border border-zinc-200 bg-white/70 px-4 py-3 shadow-sm">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  All kanji
                </p>
                <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-center text-2xl font-semibold text-zinc-800 sm:grid-cols-3 xl:grid-cols-4">
                  {allPossibleKanji.map((kanji) => (
                    <li key={`all-${kanji}`} className="flex items-center justify-center">
                      <button
                        type="button"
                        className="w-full cursor-pointer rounded-md p-1 transition hover:bg-zinc-100"
                        onClick={() => openKanjiDetails(kanji)}
                      >
                        {kanji}
                      </button>
                    </li>
                  ))}
                </ul>
              </aside>
            </div>
            {selectedKanjiDetails ? (
              <aside className="w-[22rem] rounded-xl border border-zinc-200 bg-white/70 px-4 py-3 shadow-sm">
                <div className="mb-3 flex items-start justify-between gap-3 border-b border-zinc-200 pb-3">
                  <div>
                    <p className="text-4xl font-semibold leading-none">{selectedKanjiDetails.kanji}</p>
                    <p className="text-sm text-zinc-600">{selectedKanjiDetails.meaning}</p>
                  </div>
                  <button
                    type="button"
                    className="cursor-pointer rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
                    onClick={() => setSelectedKanjiDetails(null)}
                  >
                    Close
                  </button>
                </div>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="font-semibold text-zinc-700">On reading</p>
                    <p>{formatReadings(selectedKanjiDetails.onReading)}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-zinc-700">Kun reading</p>
                    <p>{formatReadings(selectedKanjiDetails.kunReading)}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-zinc-700">Common words</p>
                    <ul className="space-y-1">
                      {selectedKanjiDetails.commonWords.slice(0, 3).map((word) => (
                        <li
                          key={`${selectedKanjiDetails.kanji}-${word.word}`}
                          className="rounded border border-zinc-200 px-2 py-1"
                        >
                          <p className="font-medium">{word.word}</p>
                          <p className="text-xs text-zinc-600">
                            {word.readingKana} ({word.readingRomaji}) - {word.meaning}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </aside>
            ) : null}
          </div>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white/70 px-4 py-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Debug totals per kanji
            </p>
            <button
              type="button"
              className="cursor-pointer rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
              onClick={() => setShowDebugStats((current) => !current)}
            >
              {showDebugStats ? "Hide debug" : "Show debug"}
            </button>
          </div>
          {showDebugStats ? (
            <ul className="grid max-h-40 grid-cols-2 gap-x-3 gap-y-1 overflow-y-auto text-sm text-zinc-700 sm:grid-cols-3">
              {allPossibleKanji.map((kanji) => {
                const rightCount = (pipHistoryByKanji[kanji] ?? []).filter(
                  (outcome) => outcome === "right",
                ).length;
                const wrongCount = (pipHistoryByKanji[kanji] ?? []).filter(
                  (outcome) => outcome === "wrong",
                ).length;

                return (
                  <li
                    key={`debug-${kanji}`}
                    className="flex items-center justify-between gap-2 rounded border border-zinc-200 px-2 py-1"
                  >
                    <span className="text-lg font-semibold leading-none text-zinc-900">{kanji}</span>
                    <div className="flex items-center gap-2 text-xs">
                      <label className="flex items-center gap-1">
                        <span>R</span>
                        <input
                          type="number"
                          min={0}
                          value={rightCount}
                          onChange={(event) =>
                            updateOutcomeCount(
                              kanji,
                              "right",
                              Number.parseInt(event.currentTarget.value, 10),
                            )
                          }
                          className="w-14 rounded border border-zinc-300 px-1 py-0.5 text-right"
                        />
                      </label>
                      <label className="flex items-center gap-1">
                        <span>W</span>
                        <input
                          type="number"
                          min={0}
                          value={wrongCount}
                          onChange={(event) =>
                            updateOutcomeCount(
                              kanji,
                              "wrong",
                              Number.parseInt(event.currentTarget.value, 10),
                            )
                          }
                          className="w-14 rounded border border-zinc-300 px-1 py-0.5 text-right"
                        />
                      </label>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      </div>
    </section>
  );
}
