"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatKanjiJlptHeading, resolveKanjiJlptLevel } from "@/lib/kanji/jlpt-level";
import { formatReadings } from "@/lib/kanji/format";
import type { KanjiApiResponse, KanjiItem } from "@/lib/kanji/types";
import {
  listN4LevelRows,
  listN5LevelRows,
  trainingSetLevelLabel,
} from "@/lib/training-sets/level-labels";
import {
  hasStarForTrainingSet,
  clearLevelClearProgress,
  loadLevelClearProgress,
  recordWrongGuess,
  recordTargetCleared,
  resetTrainingSetRun,
  saveLevelClearProgress,
  starCountForTrainingSet,
  type LevelClearProgress,
} from "@/lib/smash/level-clear-progress";
import { loadSmashPoolPreference, saveSmashPoolPreference } from "@/lib/training-sets/preference";
import { loadTrainingSets } from "@/lib/training-sets/storage";
import type { TrainingSet } from "@/lib/training-sets/types";

type ToastState = {
  id: string;
  message: string;
  isCorrect: boolean;
};

type RoundState = {
  target: KanjiItem;
  buttons: KanjiItem[];
};

type PipOutcome = "right" | "wrong";

const GRID_SIZE = 9;
const TOAST_LIFETIME_MS = 2400;
const TOAST_EXIT_MS = 300;
const MAX_TOASTS = 5;
const CORRECT_FLASH_MS = 450;
const MAX_PIPS_PER_KANJI = 8;
/** Extra selection weight per round since this kanji was last the meaning prompt (interleaving). */
const SPACING_WEIGHT_PER_ROUND = 0.18;
const MAX_SPACING_ROUNDS = 18;
const FALLBACK_KANJI: KanjiItem = {
  kanji: "?",
  primaryMeaning: "Unknown",
  onReading: [],
  kunReading: [],
  commonWords: [],
};

function shuffleArray<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = next[i];
    next[i] = next[j] as T;
    next[j] = tmp as T;
  }
  return next;
}

function getRandomKanji(items: KanjiItem[]) {
  const randomIndex = Math.floor(Math.random() * items.length);
  return items[randomIndex] ?? FALLBACK_KANJI;
}

function appendOutcomeWithCap(history: PipOutcome[], outcome: PipOutcome) {
  const nextHistory = [...history, outcome];
  if (nextHistory.length <= MAX_PIPS_PER_KANJI) {
    return nextHistory;
  }

  return nextHistory.slice(nextHistory.length - MAX_PIPS_PER_KANJI);
}

function computeHistoryAfterCorrectAnswer(
  currentHistory: Record<string, PipOutcome[]>,
  targetKanji: string,
  wrongKanjiChoices: string[],
): Record<string, PipOutcome[]> {
  const nextHistory = { ...currentHistory };

  if (wrongKanjiChoices.length > 0) {
    const wrongOutcomes = [...wrongKanjiChoices, targetKanji];

    for (const kanji of wrongOutcomes) {
      nextHistory[kanji] = appendOutcomeWithCap(nextHistory[kanji] ?? [], "wrong");
    }
  }

  nextHistory[targetKanji] = appendOutcomeWithCap(
    nextHistory[targetKanji] ?? [],
    "right",
  );

  return nextHistory;
}

function wrongPipCount(pipHistoryByKanji: Record<string, PipOutcome[]>, kanji: string): number {
  return (pipHistoryByKanji[kanji] ?? []).filter((o) => o === "wrong").length;
}

function pickWeightedTarget(
  eligible: KanjiItem[],
  pipHistoryByKanji: Record<string, PipOutcome[]>,
  roundsSinceLastTarget: Record<string, number>,
  previousTargetKanji?: string,
): KanjiItem {
  const pool =
    eligible.length > 1
      ? eligible.filter((item) => item.kanji !== previousTargetKanji)
      : eligible;

  const pickFrom = pool.length > 0 ? pool : eligible;

  if (pickFrom.length === 0) {
    return FALLBACK_KANJI;
  }

  const weights = pickFrom.map((item) => {
    const wrong = wrongPipCount(pipHistoryByKanji, item.kanji);
    const since = roundsSinceLastTarget[item.kanji] ?? 0;
    const spacing =
      SPACING_WEIGHT_PER_ROUND * Math.min(since, MAX_SPACING_ROUNDS);

    return 1 + wrong + spacing;
  });
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = Math.random() * total;

  for (let i = 0; i < pickFrom.length; i += 1) {
    roll -= weights[i];

    if (roll <= 0) {
      return pickFrom[i] ?? FALLBACK_KANJI;
    }
  }

  return pickFrom[pickFrom.length - 1] ?? FALLBACK_KANJI;
}

function createRound(
  poolItems: KanjiItem[],
  pipHistoryByKanji: Record<string, PipOutcome[]>,
  roundsSinceLastTarget: Record<string, number>,
  previousTargetKanji?: string,
  targetKanji?: string,
): RoundState {
  if (poolItems.length === 0) {
    return {
      target: FALLBACK_KANJI,
      buttons: Array.from({ length: GRID_SIZE }, () => FALLBACK_KANJI),
    };
  }

  const target =
    targetKanji != null
      ? poolItems.find((item) => item.kanji === targetKanji) ?? FALLBACK_KANJI
      : pickWeightedTarget(
          poolItems,
          pipHistoryByKanji,
          roundsSinceLastTarget,
          previousTargetKanji,
        );
  const buttons = Array.from({ length: GRID_SIZE }, () => getRandomKanji(poolItems));

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
      className={`w-full cursor-pointer rounded-xl border border-white/20 px-4 py-2.5 text-sm font-medium text-white shadow-lg backdrop-blur-sm transition-all duration-300 ${
        isVisible ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
      } ${toast.isCorrect ? "bg-emerald-500/95" : "bg-rose-500/95"}`}
      onClick={() => onDone(toast.id)}
    >
      {toast.message}
    </p>
  );
}

function buildItemLookup(items: KanjiItem[]): Map<string, KanjiItem> {
  const map = new Map<string, KanjiItem>();

  for (const item of items) {
    if (!map.has(item.kanji)) {
      map.set(item.kanji, item);
    }
  }

  return map;
}

function itemsForActiveChars(chars: string[], lookup: Map<string, KanjiItem>): KanjiItem[] {
  return chars
    .map((kanji) => lookup.get(kanji))
    .filter((item): item is KanjiItem => Boolean(item));
}

function resolvePracticePoolFromSets(
  allKanji: KanjiItem[],
  sets: TrainingSet[],
  preferredSetId: string | null,
): { trainingSetId: string | null; chars: string[] } {
  const lookup = buildItemLookup(allKanji);

  if (sets.length === 0) {
    return { trainingSetId: null, chars: [] };
  }

  const fromPref =
    preferredSetId != null ? sets.find((s) => s.id === preferredSetId) : null;
  const chosen = fromPref ?? sets[0];
  if (!chosen) {
    return { trainingSetId: null, chars: [] };
  }

  const chars = itemsForActiveChars(chosen.kanjiChars, lookup).map((item) => item.kanji);

  return { trainingSetId: chosen.id, chars };
}

export default function SmashPage() {
  const [kanjiItems, setKanjiItems] = useState<KanjiItem[]>([]);
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const [round, setRound] = useState<RoundState>(() => createRound([], {}, {}));
  const [pipHistoryByKanji, setPipHistoryByKanji] = useState<Record<string, PipOutcome[]>>(
    {},
  );
  const [wrongKanjiChoices, setWrongKanjiChoices] = useState<string[]>([]);
  const [correctButtonIndex, setCorrectButtonIndex] = useState<number | null>(null);
  const [isAdvancingRound, setIsAdvancingRound] = useState(false);
  const [levelCompleteSetId, setLevelCompleteSetId] = useState<string | null>(null);
  const [levelCompleteStars, setLevelCompleteStars] = useState<number>(0);
  const [rosterPanelTab, setRosterPanelTab] = useState<"training" | "levels">("levels");
  const [showDebugRunStrip, setShowDebugRunStrip] = useState(false);
  const [runOrder, setRunOrder] = useState<string[]>([]);
  const [runIndex, setRunIndex] = useState(0);
  const [runOutcomeByKanji, setRunOutcomeByKanji] = useState<Record<string, "right" | "wrong" | undefined>>({});
  const [selectedKanjiDetails, setSelectedKanjiDetails] = useState<KanjiItem | null>(null);
  const [activeKanjiChars, setActiveKanjiChars] = useState<string[]>([]);
  const [roundsSinceLastTarget, setRoundsSinceLastTarget] = useState<Record<string, number>>({});
  const [selectedTrainingSetId, setSelectedTrainingSetId] = useState<string | null>(null);
  const [trainingSets, setTrainingSets] = useState<TrainingSet[]>([]);
  const [levelClearProgress, setLevelClearProgress] = useState<LevelClearProgress>({});
  const [n5KanjiSet, setN5KanjiSet] = useState<Set<string>>(() => new Set());
  const [n4KanjiSet, setN4KanjiSet] = useState<Set<string>>(() => new Set());
  const roundAdvanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const kanjiItemsRef = useRef<KanjiItem[]>([]);
  const pipHistoryRef = useRef<Record<string, PipOutcome[]>>({});
  const activeKanjiRef = useRef<string[]>([]);
  const roundsSinceRef = useRef<Record<string, number>>({});
  const runOrderRef = useRef<string[]>([]);
  const runIndexRef = useRef(0);

  const itemLookup = useMemo(() => buildItemLookup(kanjiItems), [kanjiItems]);

  useEffect(() => {
    kanjiItemsRef.current = kanjiItems;
  }, [kanjiItems]);

  useEffect(() => {
    pipHistoryRef.current = pipHistoryByKanji;
  }, [pipHistoryByKanji]);

  useEffect(() => {
    activeKanjiRef.current = activeKanjiChars;
  }, [activeKanjiChars]);

  useEffect(() => {
    roundsSinceRef.current = roundsSinceLastTarget;
  }, [roundsSinceLastTarget]);

  useEffect(() => {
    runOrderRef.current = runOrder;
  }, [runOrder]);

  useEffect(() => {
    runIndexRef.current = runIndex;
  }, [runIndex]);

  const applyPracticePool = useCallback(
    (params: { allKanji: KanjiItem[]; chars: string[]; trainingSetId: string | null }) => {
      const { allKanji, chars, trainingSetId } = params;
      const lookup = buildItemLookup(allKanji);
      const poolItems = itemsForActiveChars(chars, lookup);
      const uniqueChars = Array.from(new Set(chars));
      const shuffled = shuffleArray(uniqueChars);
      const firstTarget = shuffled[0];

      if (roundAdvanceTimeoutRef.current) {
        clearTimeout(roundAdvanceTimeoutRef.current);
        roundAdvanceTimeoutRef.current = null;
      }

      setSelectedTrainingSetId(trainingSetId);
      setActiveKanjiChars(chars);
      setRunOrder(shuffled);
      setRunIndex(0);
      setRunOutcomeByKanji({});
      setRoundsSinceLastTarget({});
      setPipHistoryByKanji({});
      setRound(createRound(poolItems, {}, {}, undefined, firstTarget));
      setWrongKanjiChoices([]);
      setCorrectButtonIndex(null);
      setIsAdvancingRound(false);
      setLevelCompleteSetId(null);
      setLevelCompleteStars(0);
      setShowDebugRunStrip(false);
      setToasts([]);

      if (trainingSetId) {
        setLevelClearProgress((prev) => {
          const next = resetTrainingSetRun(prev, trainingSetId);
          saveLevelClearProgress(next);
          return next;
        });
      }
    },
    [setLevelClearProgress],
  );

  useEffect(() => {
    if (!selectedKanjiDetails) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedKanjiDetails]);

  const trainingKanji = activeKanjiChars;

  const allPossibleKanji = useMemo(
    () => Array.from(new Set(trainingKanji)),
    [trainingKanji],
  );

  const currentTargetKanji = runOrder[runIndex] ?? null;

  const n5LevelRows = useMemo(() => listN5LevelRows(trainingSets), [trainingSets]);
  const n4LevelRows = useMemo(() => listN4LevelRows(trainingSets), [trainingSets]);
  const orderedLevelRows = useMemo(() => [...n5LevelRows, ...n4LevelRows], [n5LevelRows, n4LevelRows]);

  const nextLevelAfterSelected = useMemo(() => {
    if (!selectedTrainingSetId) return null;
    const idx = orderedLevelRows.findIndex(({ set }) => set.id === selectedTrainingSetId);
    if (idx < 0) return null;
    return orderedLevelRows[idx + 1]?.set ?? null;
  }, [orderedLevelRows, selectedTrainingSetId]);

  const selectTrainingSet = useCallback(
    (saved: TrainingSet) => {
      const chars = itemsForActiveChars(saved.kanjiChars, itemLookup).map((item) => item.kanji);
      saveSmashPoolPreference(saved.id);
      applyPracticePool({
        allKanji: kanjiItems,
        chars,
        trainingSetId: saved.id,
      });
    },
    [applyPracticePool, itemLookup, kanjiItems],
  );

  const selectedTrainingSet = useMemo(() => {
    if (trainingSets.length === 0) return null;
    if (selectedTrainingSetId) {
      const found = trainingSets.find((s) => s.id === selectedTrainingSetId);
      if (found) return found;
    }
    return trainingSets[0] ?? null;
  }, [trainingSets, selectedTrainingSetId]);

  useEffect(() => {
    let isMounted = true;
    const savedSets = loadTrainingSets();
    const pref = loadSmashPoolPreference();

    async function loadKanji() {
      try {
        const response = await fetch("/api/kanji");
        const data = (await response.json()) as KanjiApiResponse;

        if (!response.ok || !Array.isArray(data.kanji)) {
          return;
        }

        if (isMounted) {
          setKanjiItems(data.kanji);
          if (Array.isArray(data.n5)) {
            setN5KanjiSet(new Set(data.n5.map((k) => k.kanji)));
          }
          if (Array.isArray(data.n4)) {
            setN4KanjiSet(new Set(data.n4.map((k) => k.kanji)));
          }
          setTrainingSets(savedSets);
          const resolved = resolvePracticePoolFromSets(data.kanji, savedSets, pref);

          if (resolved.trainingSetId) {
            saveSmashPoolPreference(resolved.trainingSetId);
          }

          applyPracticePool({
            allKanji: data.kanji,
            chars: resolved.chars,
            trainingSetId: resolved.trainingSetId,
          });
        }
      } catch {
        // Ignore fetch failures and keep fallback labels.
      }
    }

    loadKanji();

    return () => {
      isMounted = false;
    };
  }, [applyPracticePool]);

  useEffect(() => {
    setLevelClearProgress(loadLevelClearProgress());
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

    let earnedRunStars: number | null = null;
    if (isCorrect && selectedTrainingSetId) {
      const setId = selectedTrainingSetId;
      const activeSet = trainingSets.find((s) => s.id === setId);
      if (activeSet) {
        const targetKanji = round.target.kanji;
        setLevelClearProgress((prev) => {
          const { next, earnedStars } = recordTargetCleared(
            prev,
            setId,
            targetKanji,
            activeSet.kanjiChars,
          );
          saveLevelClearProgress(next);
          earnedRunStars = earnedStars;
          return next;
        });
      }
    }

    showToast({
      isCorrect,
      message: isCorrect
        ? earnedRunStars
          ? `Level complete — you earned ${"⭐".repeat(earnedRunStars)}`
          : "Correct choice!"
        : "Not quite, try again.",
    });

    if (isCorrect) {
      const targetKanji = round.target.kanji;
      const historyBefore = pipHistoryByKanji;

      setPipHistoryByKanji(() =>
        computeHistoryAfterCorrectAnswer(historyBefore, targetKanji, wrongKanjiChoices),
      );

      setRunOutcomeByKanji((current) => {
        const prior = current[targetKanji];
        const outcome = prior === "wrong" || wrongKanjiChoices.length > 0 ? "wrong" : "right";
        return { ...current, [targetKanji]: outcome };
      });

      if (earnedRunStars && selectedTrainingSetId) {
        setCorrectButtonIndex(buttonIndex);
        setIsAdvancingRound(true);
        setLevelCompleteSetId(selectedTrainingSetId);
        setLevelCompleteStars(earnedRunStars);
        if (roundAdvanceTimeoutRef.current) {
          clearTimeout(roundAdvanceTimeoutRef.current);
          roundAdvanceTimeoutRef.current = null;
        }
        return;
      }

      setCorrectButtonIndex(buttonIndex);
      setIsAdvancingRound(true);

      if (roundAdvanceTimeoutRef.current) {
        clearTimeout(roundAdvanceTimeoutRef.current);
      }

      const previousTargetKanji = targetKanji;

      roundAdvanceTimeoutRef.current = setTimeout(() => {
        const lookup = buildItemLookup(kanjiItemsRef.current);
        const poolItems = itemsForActiveChars(activeKanjiRef.current, lookup);

        const nextIndex = runIndexRef.current + 1;
        const order = runOrderRef.current;
        if (nextIndex >= order.length) {
          if (selectedTrainingSetId && earnedRunStars) {
            setLevelCompleteSetId(selectedTrainingSetId);
            setLevelCompleteStars(earnedRunStars);
          }
          setWrongKanjiChoices([]);
          setCorrectButtonIndex(null);
          setIsAdvancingRound(false);
          roundAdvanceTimeoutRef.current = null;
          return;
        }

        const nextRoundsSince: Record<string, number> = {};

        for (const k of activeKanjiRef.current) {
          if (k === previousTargetKanji) {
            nextRoundsSince[k] = 0;
          } else {
            nextRoundsSince[k] = (roundsSinceRef.current[k] ?? 0) + 1;
          }
        }

        setRoundsSinceLastTarget(nextRoundsSince);
        setRunIndex(nextIndex);
        setRound(
          createRound(
            poolItems,
            pipHistoryRef.current,
            nextRoundsSince,
            previousTargetKanji,
            order[nextIndex],
          ),
        );
        setWrongKanjiChoices([]);
        setCorrectButtonIndex(null);
        setIsAdvancingRound(false);
        roundAdvanceTimeoutRef.current = null;
      }, CORRECT_FLASH_MS);
      return;
    }

    setRunOutcomeByKanji((current) => {
      const targetKanji = round.target.kanji;
      if (!targetKanji || targetKanji === "?") return current;
      if (current[targetKanji] === "wrong") return current;
      return { ...current, [targetKanji]: "wrong" };
    });
    if (selectedTrainingSetId) {
      const setId = selectedTrainingSetId;
      setLevelClearProgress((prev) => {
        const next = recordWrongGuess(prev, setId);
        saveLevelClearProgress(next);
        return next;
      });
    }
    setWrongKanjiChoices((currentWrongChoices) =>
      currentWrongChoices.includes(clickedKanji)
        ? currentWrongChoices
        : [...currentWrongChoices, clickedKanji],
    );
  }

  const removeToast = useCallback((toastId: string) => {
    setToasts((currentToasts) =>
      currentToasts.filter((toast) => toast.id !== toastId),
    );
  }, []);

  const kanjiDetailsJlptLabel = useMemo(() => {
    if (!selectedKanjiDetails) {
      return null;
    }

    return resolveKanjiJlptLevel(selectedKanjiDetails.kanji, n5KanjiSet, n4KanjiSet);
  }, [selectedKanjiDetails, n5KanjiSet, n4KanjiSet]);

  function openKanjiDetails(kanji: string) {
    setSelectedKanjiDetails((currentSelection) => {
      if (currentSelection?.kanji === kanji) {
        return null;
      }

      return kanjiItems.find((item) => item.kanji === kanji) ?? null;
    });
  }

  const kanjiDetailsDialog =
    selectedKanjiDetails && typeof document !== "undefined"
      ? createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <button
              type="button"
              aria-label="Close kanji details"
              className="absolute inset-0 bg-black/25 transition hover:bg-black/30"
              onClick={() => setSelectedKanjiDetails(null)}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="kanji-details-title"
              className="relative z-10 max-h-[min(42rem,92vh)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-zinc-200 bg-white px-5 py-4 dark:border-zinc-700 dark:bg-zinc-900"
              style={{ boxShadow: "none" }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-3 flex items-start justify-between gap-3 border-b border-zinc-200 pb-3 dark:border-zinc-700">
                <div>
                  <p id="kanji-details-title" className="text-4xl font-semibold leading-none">
                    {selectedKanjiDetails.kanji}
                  </p>
                  <p className="mt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    {formatKanjiJlptHeading(kanjiDetailsJlptLabel)}
                  </p>
                  <p className="text-sm text-zinc-600">{selectedKanjiDetails.primaryMeaning}</p>
                  {selectedKanjiDetails.otherMeaning ? (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {selectedKanjiDetails.otherMeaning}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="cursor-pointer rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                  onClick={() => setSelectedKanjiDetails(null)}
                >
                  Close
                </button>
              </div>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="font-semibold text-zinc-700 dark:text-zinc-200">On reading</p>
                  <p>{formatReadings(selectedKanjiDetails.onReading)}</p>
                </div>
                <div>
                  <p className="font-semibold text-zinc-700 dark:text-zinc-200">Kun reading</p>
                  <p>{formatReadings(selectedKanjiDetails.kunReading)}</p>
                </div>
                <div>
                  <p className="font-semibold text-zinc-700 dark:text-zinc-200">Common words</p>
                  <ul className="space-y-1">
                    {selectedKanjiDetails.commonWords.slice(0, 3).map((word) => (
                      <li
                        key={`${selectedKanjiDetails.kanji}-${word.word}`}
                        className="rounded border border-zinc-200 px-2 py-1 dark:border-zinc-700"
                      >
                        <p className="font-medium">{word.word}</p>
                        <p className="text-xs text-zinc-600 dark:text-zinc-300">
                          {word.readingKana} ({word.readingRomaji}) - {word.meaning}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  const levelCompleteDialog =
    levelCompleteSetId && typeof document !== "undefined"
      ? createPortal(
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <button
              type="button"
              aria-label="Close level complete dialog"
              className="absolute inset-0 bg-black/35 transition hover:bg-black/40"
              onClick={() => {
                setLevelCompleteSetId(null);
                setIsAdvancingRound(false);
                setCorrectButtonIndex(null);
              }}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="level-complete-title"
              className="relative z-10 w-full max-w-md rounded-2xl border border-zinc-200 bg-white px-5 py-4 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
              onClick={(event) => event.stopPropagation()}
            >
              <p id="level-complete-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Level complete — you earned {levelCompleteStars > 0 ? "⭐".repeat(levelCompleteStars) : "⭐"}!
              </p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                Nice work. Want to keep going?
              </p>

              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  className="cursor-pointer rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                  onClick={() => {
                    const next = nextLevelAfterSelected;
                    if (next) {
                      setRosterPanelTab("levels");
                      setLevelCompleteSetId(null);
                      setIsAdvancingRound(false);
                      setCorrectButtonIndex(null);
                      selectTrainingSet(next);
                      return;
                    }
                    setRosterPanelTab("levels");
                    setLevelCompleteSetId(null);
                    setIsAdvancingRound(false);
                    setCorrectButtonIndex(null);
                  }}
                >
                  {nextLevelAfterSelected ? "Next level" : "Choose a level"}
                </button>
                <button
                  type="button"
                  className="cursor-pointer rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                  onClick={() => {
                    const current = selectedTrainingSet;
                    if (!current) {
                      setLevelCompleteSetId(null);
                      setIsAdvancingRound(false);
                      setCorrectButtonIndex(null);
                      return;
                    }
                    setLevelClearProgress((prev) => {
                      const next = resetTrainingSetRun(prev, current.id);
                      saveLevelClearProgress(next);
                      return next;
                    });
                    setLevelCompleteSetId(null);
                    setLevelCompleteStars(0);
                    setIsAdvancingRound(false);
                    setCorrectButtonIndex(null);
                    selectTrainingSet(current);
                  }}
                >
                  Do it again
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
    <section className="relative flex flex-1 items-center justify-center overflow-hidden rounded-3xl border border-black/10 bg-white/40 p-6 shadow-[0_10px_40px_rgba(0,0,0,0.06)] backdrop-blur-sm dark:border-white/10 dark:bg-white/5">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.10),_transparent_45%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.10),_transparent_40%)]" />
      <div className="absolute right-4 top-4 z-30 w-full max-w-64 space-y-2">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDone={removeToast} />
        ))}
      </div>
      <div className="relative z-10 flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-4 border-b border-zinc-200/80 pb-4 dark:border-zinc-700/80">
          <div className="flex min-w-[14rem] flex-col gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
              Training set
            </span>
            <div className="flex items-baseline gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {selectedTrainingSet ? (
                <>
                  <span className="font-mono text-base font-semibold tabular-nums text-zinc-500 dark:text-zinc-400">
                    {trainingSetLevelLabel(selectedTrainingSet) ?? "—"}
                  </span>
                  <span className="text-zinc-400 dark:text-zinc-600">·</span>
                  <span className="leading-snug">{selectedTrainingSet.name}</span>
                </>
              ) : (
                <span className="text-zinc-500 dark:text-zinc-400">Loading…</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-start gap-8">
          <div className="flex w-80 flex-col items-center gap-3">
            <p className="w-full rounded-2xl border-2 border-zinc-300/90 bg-zinc-50/80 px-5 py-2 text-center leading-snug shadow-sm dark:border-zinc-600 dark:bg-zinc-900/60">
              <span className="text-3xl font-semibold text-zinc-700 dark:text-zinc-100">
                {round.target.primaryMeaning}
              </span>
              {round.target.otherMeaning?.trim() ? (
                <span className="mt-1.5 block text-sm font-normal text-zinc-500 dark:text-zinc-400">
                  {round.target.otherMeaning.trim()}
                </span>
              ) : null}
            </p>
            <div className="grid grid-cols-3 gap-4">
              {round.buttons.map((item, index) => (
                <button
                  key={`${item.kanji}-${index}`}
                  type="button"
                  disabled={wrongKanjiChoices.includes(item.kanji) || isAdvancingRound}
                  className={`aspect-square w-24 rounded-2xl border text-4xl font-semibold shadow-sm transition duration-150 ${
                    correctButtonIndex !== null && item.kanji === round.target.kanji
                      ? "cursor-not-allowed scale-[1.02] border-emerald-500 bg-emerald-500 text-white shadow-emerald-500/30"
                      : wrongKanjiChoices.includes(item.kanji)
                      ? "cursor-not-allowed border-rose-500 bg-rose-500 text-white"
                      : "cursor-pointer border-zinc-300 bg-white hover:-translate-y-0.5 hover:border-zinc-400 hover:bg-zinc-50 hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900/80 dark:hover:border-zinc-500 dark:hover:bg-zinc-800"
                  }`}
                  onClick={() => handleKanjiClick(item.kanji, index)}
                >
                  {item.kanji}
                </button>
              ))}
            </div>
            <div className="w-full max-w-md">
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  className="cursor-pointer rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-100 dark:hover:bg-zinc-800"
                  onClick={() => setShowDebugRunStrip((v) => !v)}
                >
                  {showDebugRunStrip ? "Hide debug" : "Show debug"}
                </button>
              </div>
              {showDebugRunStrip ? (
                <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                  {runOrder.map((kanji) => {
                    const status = runOutcomeByKanji[kanji];
                    const isActive = kanji === currentTargetKanji;
                    const statusClass =
                      status === "right"
                        ? "border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-100"
                        : status === "wrong"
                        ? "border-rose-300 bg-rose-100 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-100"
                        : "border-zinc-200 bg-white text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-100";

                    return (
                      <span
                        key={`training-pill-${kanji}`}
                        className={`inline-flex h-7 min-w-7 items-center justify-center rounded-lg border px-2 font-mono text-sm font-semibold leading-none ${statusClass} ${
                          isActive ? "ring-2 ring-sky-400/50" : ""
                        }`}
                        title={isActive ? "Current target" : "In run"}
                      >
                        {kanji}
                      </span>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex items-start gap-3">
            <aside className="flex max-h-[26rem] w-[22rem] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white/80 shadow-sm backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/75">
              <div
                role="tablist"
                aria-label="Roster"
                className="flex shrink-0 gap-1 border-b border-zinc-200 px-2 pt-2 dark:border-zinc-700"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={rosterPanelTab === "levels"}
                  id="roster-tab-levels"
                  aria-controls="roster-panel-levels"
                  className={`cursor-pointer flex-1 rounded-t-lg px-1.5 py-2 text-[10px] font-semibold uppercase tracking-wide transition sm:px-2 sm:text-xs ${
                    rosterPanelTab === "levels"
                      ? "bg-white text-zinc-800 shadow-[inset_0_-2px_0_0_var(--tw-shadow-color)] shadow-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:shadow-zinc-100"
                      : "text-zinc-500 hover:bg-zinc-100/80 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800/80 dark:hover:text-zinc-200"
                  }`}
                  onClick={() => setRosterPanelTab("levels")}
                >
                  Levels
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={rosterPanelTab === "training"}
                  id="roster-tab-training"
                  aria-controls="roster-panel-training"
                  className={`cursor-pointer flex-1 rounded-t-lg px-1.5 py-2 text-[10px] font-semibold uppercase tracking-wide transition sm:px-2 sm:text-xs ${
                    rosterPanelTab === "training"
                      ? "bg-white text-zinc-800 shadow-[inset_0_-2px_0_0_var(--tw-shadow-color)] shadow-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:shadow-zinc-100"
                      : "text-zinc-500 hover:bg-zinc-100/80 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800/80 dark:hover:text-zinc-200"
                  }`}
                  onClick={() => setRosterPanelTab("training")}
                >
                  Currently training
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                <div
                  role="tabpanel"
                  id="roster-panel-training"
                  aria-labelledby="roster-tab-training"
                  hidden={rosterPanelTab !== "training"}
                >
                  <p className="mb-3 text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
                    More red pips → more likely as the meaning prompt. Kanji you have not seen as the
                    prompt for a few rounds get a slight boost so the session mixes characters
                    instead of only chasing mistakes.
                  </p>
                  <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-center text-2xl font-semibold text-zinc-800 sm:grid-cols-3 xl:grid-cols-4">
                    {trainingKanji.map((kanji) => (
                        <li
                          key={`training-${kanji}`}
                          className="flex flex-col items-center justify-center gap-1"
                        >
                          <button
                            type="button"
                            className="w-full cursor-pointer rounded-md p-1 transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
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
                </div>
                <div
                  role="tabpanel"
                  id="roster-panel-levels"
                  aria-labelledby="roster-tab-levels"
                  hidden={rosterPanelTab !== "levels"}
                >
                  <p className="mb-3 text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
                    N5 levels use <span className="font-mono">1-1</span>, <span className="font-mono">1-2</span>, …;
                    N4 uses <span className="font-mono">2-1</span>, <span className="font-mono">2-2</span>, … Answer
                    each kanji correctly when it is the prompt to clear the level and earn a star.
                  </p>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                      Levels
                    </p>
                    <button
                      type="button"
                      className="cursor-pointer rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-rose-700 transition hover:bg-rose-100 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200 dark:hover:bg-rose-950/50"
                      onClick={() => {
                        if (typeof window !== "undefined" && !window.confirm("Reset all Smash stars and progress?")) {
                          return;
                        }
                        clearLevelClearProgress();
                        setLevelClearProgress({});
                        setLevelCompleteSetId(null);
                        setLevelCompleteStars(0);
                      }}
                    >
                      Reset stars
                    </button>
                  </div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                    N5
                  </p>
                  <ul className="mb-4 grid grid-cols-3 gap-1.5">
                    {n5LevelRows.map(({ levelLabel, set }) => {
                      const selected = selectedTrainingSetId === set.id;
                      const stars = starCountForTrainingSet(set.id, levelClearProgress);

                      return (
                        <li key={set.id} className="min-w-0">
                          <button
                            type="button"
                            onClick={() => selectTrainingSet(set)}
                            className={`relative flex w-full min-h-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-lg border px-1 py-2 pt-3 text-center transition ${
                              selected
                                ? "border-sky-500 bg-sky-50 ring-1 ring-sky-500/30 dark:border-sky-600 dark:bg-sky-950/50 dark:ring-sky-400/25"
                                : "border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900/60 dark:hover:bg-zinc-800/80"
                            }`}
                          >
                            {stars > 0 ? (
                              <span
                                className="absolute right-0.5 top-0.5 text-sm leading-none"
                                title={`Stars earned: ${stars}`}
                                aria-label={`${stars} star${stars === 1 ? "" : "s"} earned for this level`}
                              >
                                {"⭐".repeat(stars)}
                              </span>
                            ) : null}
                            <span className="font-mono text-xs font-semibold tabular-nums text-zinc-800 dark:text-zinc-100">
                              {levelLabel}
                            </span>
                            <span className="line-clamp-2 w-full text-[10px] font-medium leading-snug text-zinc-500 dark:text-zinc-400">
                              {set.name}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                    N4
                  </p>
                  <ul className="grid grid-cols-3 gap-1.5">
                    {n4LevelRows.map(({ levelLabel, set }) => {
                      const selected = selectedTrainingSetId === set.id;
                      const stars = starCountForTrainingSet(set.id, levelClearProgress);

                      return (
                        <li key={set.id} className="min-w-0">
                          <button
                            type="button"
                            onClick={() => selectTrainingSet(set)}
                            className={`relative flex w-full min-h-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-lg border px-1 py-2 pt-3 text-center transition ${
                              selected
                                ? "border-sky-500 bg-sky-50 ring-1 ring-sky-500/30 dark:border-sky-600 dark:bg-sky-950/50 dark:ring-sky-400/25"
                                : "border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900/60 dark:hover:bg-zinc-800/80"
                            }`}
                          >
                            {stars > 0 ? (
                              <span
                                className="absolute right-0.5 top-0.5 text-sm leading-none"
                                title={`Stars earned: ${stars}`}
                                aria-label={`${stars} star${stars === 1 ? "" : "s"} earned for this level`}
                              >
                                {"⭐".repeat(stars)}
                              </span>
                            ) : null}
                            <span className="font-mono text-xs font-semibold tabular-nums text-zinc-800 dark:text-zinc-100">
                              {levelLabel}
                            </span>
                            <span className="line-clamp-2 w-full text-[10px] font-medium leading-snug text-zinc-500 dark:text-zinc-400">
                              {set.name}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </section>
    {kanjiDetailsDialog}
    {levelCompleteDialog}
    </>
  );
}
