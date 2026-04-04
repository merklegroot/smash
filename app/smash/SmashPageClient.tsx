"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatReadings } from "@/lib/kanji/format";
import type { KanjiApiResponse, KanjiItem } from "@/lib/kanji/types";

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

type PendingRestSwap = {
  restingKanji: string;
  replacementKanji: string;
  slotIndex: number;
  roundsLeft: number;
};

type MasteryCelebration =
  | { kind: "swap"; restingKanji: string; replacementKanji: string }
  | { kind: "cooldown"; restingKanji: string };

const GRID_SIZE = 9;
const TOAST_LIFETIME_MS = 2400;
const TOAST_EXIT_MS = 300;
const MAX_TOASTS = 5;
const CORRECT_FLASH_MS = 450;
const TRAINING_SET_SIZE = 12;
const MAX_PIPS_PER_KANJI = 8;
/** Trailing green pips (correct answers when this kanji was the target) → rest period. */
const MASTERY_TRAILING_RIGHTS = 3;
/** Rounds where a resting kanji is not chosen as the quiz target. */
const REST_ROUNDS_AFTER_MASTERY = 10;
/** Extra selection weight per round since this kanji was last the meaning prompt (interleaving). */
const SPACING_WEIGHT_PER_ROUND = 0.18;
const MAX_SPACING_ROUNDS = 18;
/** How long the mastery full-screen celebration stays visible (ms). */
const MASTERY_CELEBRATION_MS = 2600;
const FALLBACK_KANJI: KanjiItem = {
  kanji: "?",
  meaning: "Unknown",
  onReading: [],
  kunReading: [],
  commonWords: [],
};

function getRandomKanji(items: KanjiItem[]) {
  const randomIndex = Math.floor(Math.random() * items.length);
  return items[randomIndex] ?? FALLBACK_KANJI;
}

/** First occurrence wins — stable order for “next kanji in the deck”. */
function buildOrderedUniqueItems(items: KanjiItem[]): KanjiItem[] {
  const seen = new Set<string>();
  const ordered: KanjiItem[] = [];

  for (const item of items) {
    if (seen.has(item.kanji)) {
      continue;
    }

    seen.add(item.kanji);
    ordered.push(item);
  }

  return ordered;
}

function countTrailingRights(pips: PipOutcome[]): number {
  let count = 0;

  for (let i = pips.length - 1; i >= 0; i -= 1) {
    if (pips[i] !== "right") {
      break;
    }

    count += 1;
  }

  return count;
}

function tickCooldownRounds(map: Record<string, number>): Record<string, number> {
  const next: Record<string, number> = {};

  for (const [key, value] of Object.entries(map)) {
    if (value <= 1) {
      continue;
    }

    next[key] = value - 1;
  }

  return next;
}

function processRestSwaps(
  activeKanji: string[],
  swaps: PendingRestSwap[],
): { nextActive: string[]; nextSwaps: PendingRestSwap[] } {
  let nextActive = [...activeKanji];
  const nextSwaps: PendingRestSwap[] = [];

  for (const swap of swaps) {
    const roundsLeft = swap.roundsLeft - 1;

    if (roundsLeft <= 0) {
      nextActive[swap.slotIndex] = swap.restingKanji;
    } else {
      nextSwaps.push({ ...swap, roundsLeft });
    }
  }

  return { nextActive, nextSwaps };
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
  cooldownRoundsLeft: Record<string, number>,
  roundsSinceLastTarget: Record<string, number>,
  previousTargetKanji?: string,
): RoundState {
  if (poolItems.length === 0) {
    return {
      target: FALLBACK_KANJI,
      buttons: Array.from({ length: GRID_SIZE }, () => FALLBACK_KANJI),
    };
  }

  let eligible = poolItems.filter((item) => (cooldownRoundsLeft[item.kanji] ?? 0) === 0);

  if (eligible.length === 0) {
    eligible = poolItems;
  }

  const target = pickWeightedTarget(
    eligible,
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

export default function SmashPage() {
  const [kanjiItems, setKanjiItems] = useState<KanjiItem[]>([]);
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const [round, setRound] = useState<RoundState>(() => createRound([], {}, {}, {}));
  const [pipHistoryByKanji, setPipHistoryByKanji] = useState<Record<string, PipOutcome[]>>(
    {},
  );
  const [wrongKanjiChoices, setWrongKanjiChoices] = useState<string[]>([]);
  const [correctButtonIndex, setCorrectButtonIndex] = useState<number | null>(null);
  const [isAdvancingRound, setIsAdvancingRound] = useState(false);
  const [showDebugStats, setShowDebugStats] = useState(false);
  const [selectedKanjiDetails, setSelectedKanjiDetails] = useState<KanjiItem | null>(null);
  const [activeKanjiChars, setActiveKanjiChars] = useState<string[]>([]);
  const [cooldownRoundsLeft, setCooldownRoundsLeft] = useState<Record<string, number>>({});
  const [pendingRestSwaps, setPendingRestSwaps] = useState<PendingRestSwap[]>([]);
  const [roundsSinceLastTarget, setRoundsSinceLastTarget] = useState<Record<string, number>>({});
  const [masteryCelebration, setMasteryCelebration] = useState<MasteryCelebration | null>(null);
  const roundAdvanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const masteryCelebrationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const kanjiItemsRef = useRef<KanjiItem[]>([]);
  const pipHistoryRef = useRef<Record<string, PipOutcome[]>>({});
  const cooldownRef = useRef<Record<string, number>>({});
  const activeKanjiRef = useRef<string[]>([]);
  const pendingSwapsRef = useRef<PendingRestSwap[]>([]);
  const roundsSinceRef = useRef<Record<string, number>>({});

  const orderedItems = useMemo(() => buildOrderedUniqueItems(kanjiItems), [kanjiItems]);
  const itemLookup = useMemo(() => buildItemLookup(kanjiItems), [kanjiItems]);
  const orderedKanjiChars = useMemo(() => orderedItems.map((item) => item.kanji), [orderedItems]);

  useEffect(() => {
    kanjiItemsRef.current = kanjiItems;
  }, [kanjiItems]);

  useEffect(() => {
    pipHistoryRef.current = pipHistoryByKanji;
  }, [pipHistoryByKanji]);

  useEffect(() => {
    cooldownRef.current = cooldownRoundsLeft;
  }, [cooldownRoundsLeft]);

  useEffect(() => {
    activeKanjiRef.current = activeKanjiChars;
  }, [activeKanjiChars]);

  useEffect(() => {
    pendingSwapsRef.current = pendingRestSwaps;
  }, [pendingRestSwaps]);

  useEffect(() => {
    roundsSinceRef.current = roundsSinceLastTarget;
  }, [roundsSinceLastTarget]);

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
    () => Array.from(new Set(kanjiItems.map((item) => item.kanji))),
    [kanjiItems],
  );

  /** Deck kanji that are neither in the current training roster nor on break (incl. swapped-out rest). */
  const kanjiOutsideTrainingOrBreak = useMemo(() => {
    const excluded = new Set<string>(activeKanjiChars);

    for (const swap of pendingRestSwaps) {
      excluded.add(swap.restingKanji);
    }

    return orderedKanjiChars.filter((kanji) => !excluded.has(kanji));
  }, [orderedKanjiChars, activeKanjiChars, pendingRestSwaps]);

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
          const ordered = buildOrderedUniqueItems(data.kanji);
          const initialChars = ordered
            .slice(0, TRAINING_SET_SIZE)
            .map((item) => item.kanji);
          const lookup = buildItemLookup(data.kanji);
          const initialPool = itemsForActiveChars(initialChars, lookup);
          setActiveKanjiChars(initialChars);
          setCooldownRoundsLeft({});
          setPendingRestSwaps([]);
          setRoundsSinceLastTarget({});
          setRound(createRound(initialPool, {}, {}, {}, undefined));
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

      if (masteryCelebrationTimeoutRef.current) {
        clearTimeout(masteryCelebrationTimeoutRef.current);
      }
    };
  }, []);

  function scheduleMasteryCelebrationClear() {
    if (masteryCelebrationTimeoutRef.current) {
      clearTimeout(masteryCelebrationTimeoutRef.current);
    }

    masteryCelebrationTimeoutRef.current = setTimeout(() => {
      setMasteryCelebration(null);
      masteryCelebrationTimeoutRef.current = null;
    }, MASTERY_CELEBRATION_MS);
  }

  function bootstrapNearMasteryTransition() {
    if (isAdvancingRound || kanjiItems.length === 0) {
      return;
    }

    const targetKanji = round.target.kanji;

    if (targetKanji === FALLBACK_KANJI.kanji) {
      return;
    }

    if (roundAdvanceTimeoutRef.current) {
      clearTimeout(roundAdvanceTimeoutRef.current);
      roundAdvanceTimeoutRef.current = null;
    }

    setIsAdvancingRound(false);
    setCorrectButtonIndex(null);
    setWrongKanjiChoices([]);

    setPipHistoryByKanji((current) => {
      const twoTrailingGreens = appendOutcomeWithCap(
        appendOutcomeWithCap([], "right"),
        "right",
      );

      return {
        ...current,
        [targetKanji]: twoTrailingGreens,
      };
    });

    showToast({
      isCorrect: true,
      message: `Ready: ${targetKanji} has two greens — one more correct answer here triggers rest / swap.`,
    });
  }

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
      const targetKanji = round.target.kanji;
      const historyBefore = pipHistoryByKanji;
      const pipsBeforeRightOnTarget = (() => {
        const draft = { ...historyBefore };

        if (wrongKanjiChoices.length > 0) {
          const wrongOutcomes = [...wrongKanjiChoices, targetKanji];

          for (const kanji of wrongOutcomes) {
            draft[kanji] = appendOutcomeWithCap(draft[kanji] ?? [], "wrong");
          }
        }

        return draft[targetKanji] ?? [];
      })();
      const pipsAfterRightOnTarget = appendOutcomeWithCap(pipsBeforeRightOnTarget, "right");
      const oldTrailing = countTrailingRights(pipsBeforeRightOnTarget);
      const newTrailing = countTrailingRights(pipsAfterRightOnTarget);
      const justMastered =
        newTrailing >= MASTERY_TRAILING_RIGHTS && oldTrailing < MASTERY_TRAILING_RIGHTS;

      setPipHistoryByKanji(() =>
        computeHistoryAfterCorrectAnswer(historyBefore, targetKanji, wrongKanjiChoices),
      );

      if (justMastered) {
        const idx = activeKanjiChars.indexOf(targetKanji);
        const nextChar = orderedKanjiChars.find((c) => !activeKanjiChars.includes(c));

        if (idx >= 0 && nextChar) {
          setMasteryCelebration({
            kind: "swap",
            restingKanji: targetKanji,
            replacementKanji: nextChar,
          });
          setPendingRestSwaps((previous) => [
            ...previous,
            {
              restingKanji: targetKanji,
              replacementKanji: nextChar,
              slotIndex: idx,
              roundsLeft: REST_ROUNDS_AFTER_MASTERY,
            },
          ]);
          setActiveKanjiChars((previous) => {
            const next = [...previous];
            next[idx] = nextChar;
            return next;
          });
        } else {
          setMasteryCelebration({ kind: "cooldown", restingKanji: targetKanji });
          setCooldownRoundsLeft((previous) => ({
            ...previous,
            [targetKanji]: REST_ROUNDS_AFTER_MASTERY,
          }));
        }

        scheduleMasteryCelebrationClear();
      }

      setCorrectButtonIndex(buttonIndex);
      setIsAdvancingRound(true);

      if (roundAdvanceTimeoutRef.current) {
        clearTimeout(roundAdvanceTimeoutRef.current);
      }

      const previousTargetKanji = targetKanji;

      roundAdvanceTimeoutRef.current = setTimeout(() => {
        const nextCooldown = tickCooldownRounds(cooldownRef.current);
        const { nextActive, nextSwaps } = processRestSwaps(
          activeKanjiRef.current,
          pendingSwapsRef.current,
        );
        const lookup = buildItemLookup(kanjiItemsRef.current);
        const poolItems = itemsForActiveChars(nextActive, lookup);

        const nextRoundsSince: Record<string, number> = {};

        for (const k of nextActive) {
          if (k === previousTargetKanji) {
            nextRoundsSince[k] = 0;
          } else {
            nextRoundsSince[k] = (roundsSinceRef.current[k] ?? 0) + 1;
          }
        }

        setCooldownRoundsLeft(nextCooldown);
        setActiveKanjiChars(nextActive);
        setPendingRestSwaps(nextSwaps);
        setRoundsSinceLastTarget(nextRoundsSince);
        setRound(
          createRound(
            poolItems,
            pipHistoryRef.current,
            nextCooldown,
            nextRoundsSince,
            previousTargetKanji,
          ),
        );
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

  function restRoundsLabelForKanji(kanji: string): string | null {
    const swap = pendingRestSwaps.find((entry) => entry.restingKanji === kanji);

    if (swap) {
      return `${swap.roundsLeft} round${swap.roundsLeft === 1 ? "" : "s"}`;
    }

    const cooldown = cooldownRoundsLeft[kanji];

    if (cooldown && cooldown > 0) {
      return `${cooldown} round${cooldown === 1 ? "" : "s"}`;
    }

    return null;
  }

  const restingNotInRotation = pendingRestSwaps.filter(
    (entry) => !activeKanjiChars.includes(entry.restingKanji),
  );

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
                  <p className="text-sm text-zinc-600">{selectedKanjiDetails.meaning}</p>
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

  return (
    <>
    <section className="relative flex flex-1 items-center justify-center overflow-hidden rounded-3xl border border-black/10 bg-white/40 p-6 shadow-[0_10px_40px_rgba(0,0,0,0.06)] backdrop-blur-sm dark:border-white/10 dark:bg-white/5">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.10),_transparent_45%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.10),_transparent_40%)]" />
      {masteryCelebration ? (
        <div
          className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center overflow-hidden"
          aria-live="polite"
          role="status"
        >
          <div className="mastery-overlay-in absolute inset-0 bg-gradient-to-br from-emerald-400/35 via-amber-200/30 to-sky-400/30 dark:from-emerald-700/30 dark:via-amber-950/40 dark:to-sky-950/35" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(251,191,36,0.42)_0%,_transparent_58%)]" />
          <div className="absolute flex items-center justify-center">
            <div className="mastery-ring-pulse absolute size-[18rem] rounded-full border-2 border-emerald-400/55 sm:size-[20rem]" />
            <div
              className="mastery-ring-pulse absolute size-[13rem] rounded-full border border-amber-300/45 sm:size-[15rem]"
              style={{ animationDelay: "0.35s" }}
            />
          </div>
          <div className="relative z-10 flex max-w-sm flex-col items-center gap-2 px-6 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-900/90 dark:text-emerald-200">
              Three in a row
            </p>
            <p className="animate-mastery-pop text-7xl font-bold leading-none text-zinc-900 drop-shadow-md dark:text-white sm:text-8xl">
              {masteryCelebration.restingKanji}
            </p>
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
              {masteryCelebration.kind === "swap" ? (
                <>
                  On break —{" "}
                  <span className="font-semibold tabular-nums">
                    {masteryCelebration.replacementKanji}
                  </span>{" "}
                  joins the set
                </>
              ) : (
                <>On break from the prompt</>
              )}
            </p>
          </div>
        </div>
      ) : null}
      <div className="absolute right-4 top-4 z-30 w-full max-w-64 space-y-2">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDone={removeToast} />
        ))}
      </div>
      <div className="absolute left-4 top-4 z-30 flex flex-wrap gap-2">
        <button
          type="button"
          className="cursor-pointer rounded-full border border-zinc-300 bg-white/90 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-700 shadow-sm backdrop-blur transition hover:bg-white dark:border-zinc-600 dark:bg-zinc-900/90 dark:text-zinc-100 dark:hover:bg-zinc-800"
          onClick={() => setShowDebugStats((current) => !current)}
        >
          {showDebugStats ? "Hide debug" : "Show debug"}
        </button>
        <button
          type="button"
          title="Set the current prompt’s kanji to two trailing greens so the next correct answer triggers rest or deck swap"
          disabled={isAdvancingRound || kanjiItems.length === 0 || round.target.kanji === FALLBACK_KANJI.kanji}
          className="cursor-pointer rounded-full border border-amber-400/80 bg-amber-50/95 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-amber-900 shadow-sm backdrop-blur transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-amber-600/60 dark:bg-amber-950/80 dark:text-amber-100 dark:hover:bg-amber-900/80"
          onClick={bootstrapNearMasteryTransition}
        >
          Bootstrap
        </button>
      </div>
      <div className="relative z-10 flex flex-col gap-4">
        <div className="flex items-start gap-8">
          <div className="flex max-w-md flex-col items-center gap-3">
            <p className="text-center text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
              <span className="font-semibold text-zinc-700 dark:text-zinc-200">How practice works: </span>
              Red pips mean you missed that kanji before getting the round right — those kanji are
              weighted to appear as the prompt more often. Kanji you have not seen as the prompt for
              a while also get a small nudge so the session mixes characters instead of only chasing
              mistakes. Three green pips in a row at the end of your strip (three correct rounds in a
              row for that kanji) sends it on a short break from being the prompt. If there are more
              kanji in the deck, a new one takes that slot while the old one rests.
            </p>
            <p className="rounded-full border border-black/10 bg-white/70 px-5 py-2 text-3xl font-semibold text-zinc-700 shadow-sm dark:border-white/10 dark:bg-white/10 dark:text-zinc-100">
              {round.target.meaning}
            </p>
            <div className="grid grid-cols-3 gap-4">
              {round.buttons.map((item, index) => (
                <button
                  key={`${item.kanji}-${index}`}
                  type="button"
                  disabled={wrongKanjiChoices.includes(item.kanji) || isAdvancingRound}
                  className={`aspect-square w-24 rounded-2xl border text-4xl font-semibold shadow-sm transition duration-150 ${
                    correctButtonIndex === index
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
          </div>
          <div className="flex items-start gap-3">
            <div className="flex max-h-[26rem] items-stretch gap-3">
              <aside className="w-[22rem] overflow-y-auto rounded-2xl border border-zinc-200 bg-white/80 px-4 py-3 shadow-sm backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/75">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Currently training
                </p>
                <p className="mb-3 text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
                  More red pips → more likely as the prompt; not seen as the prompt for several
                  rounds → slight boost too. &quot;Resting&quot; = not chosen as that prompt for
                  that many rounds (count ticks down after each round).
                </p>
                <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-center text-2xl font-semibold text-zinc-800 sm:grid-cols-3 xl:grid-cols-4">
                  {trainingKanji.map((kanji) => {
                    const restLabel = restRoundsLabelForKanji(kanji);

                    return (
                    <li key={`training-${kanji}`} className="flex flex-col items-center justify-center gap-1">
                      <button
                        type="button"
                        className="w-full cursor-pointer rounded-md p-1 transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        onClick={() => openKanjiDetails(kanji)}
                      >
                        <span>{kanji}</span>
                        {restLabel ? (
                          <span className="block text-[10px] font-medium leading-tight text-sky-700 dark:text-sky-300">
                            Resting ({restLabel})
                          </span>
                        ) : null}
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
                    );
                  })}
                </ul>
                {restingNotInRotation.length > 0 ? (
                  <div className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-700">
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                      On break (slot filled by next kanji)
                    </p>
                    <ul className="space-y-1 text-sm text-zinc-700 dark:text-zinc-200">
                      {restingNotInRotation.map((entry) => (
                        <li key={entry.restingKanji} className="flex items-center justify-between gap-2">
                          <span className="text-2xl font-semibold">{entry.restingKanji}</span>
                          <span className="text-xs text-zinc-500">
                            {entry.roundsLeft} round{entry.roundsLeft === 1 ? "" : "s"} left
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </aside>
              <aside className="w-[22rem] overflow-y-auto rounded-2xl border border-zinc-200 bg-white/80 px-4 py-3 shadow-sm backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/75">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Outside training
                </p>
                <p className="mb-3 text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
                  Kanji not in the current training set and not on break (including characters listed
                  under &quot;On break&quot;).
                </p>
                {kanjiOutsideTrainingOrBreak.length === 0 ? (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Every kanji in the deck is either in training or on break.
                  </p>
                ) : (
                  <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-center text-2xl font-semibold text-zinc-800 sm:grid-cols-3 xl:grid-cols-4">
                    {kanjiOutsideTrainingOrBreak.map((kanji) => (
                      <li key={`outside-${kanji}`} className="flex items-center justify-center">
                        <button
                          type="button"
                          className="w-full cursor-pointer rounded-md p-1 transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          onClick={() => openKanjiDetails(kanji)}
                        >
                          {kanji}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </aside>
            </div>
          </div>
        </div>
        {showDebugStats ? (
          <div className="rounded-2xl border border-zinc-200 bg-white/80 px-4 py-3 shadow-sm backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/75">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Debug totals per kanji
              </p>
            </div>
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
                    className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white/80 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900/70"
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
          </div>
        ) : null}
      </div>
    </section>
    {kanjiDetailsDialog}
    </>
  );
}
