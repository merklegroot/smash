"use client";

import { useEffect, useMemo, useState } from "react";
import { formatKanjiGlosses } from "@/lib/kanji/format";
import type { KanjiApiResponse, KanjiItem } from "@/lib/kanji/types";
import { trainingSetLevelLabel } from "@/lib/training-sets/level-labels";
import { loadTrainingSets } from "@/lib/training-sets/storage";
import { KanjiDetailsPanel } from "@/app/components/KanjiDetailsPanel";

export default function TrainingSets() {
  const sets = useMemo(() => loadTrainingSets(), []);
  const [tier, setTier] = useState<"n5" | "n4">("n5");
  const [kanji, setKanji] = useState<KanjiItem[]>([]);
  const [isLoadingKanji, setIsLoadingKanji] = useState(true);
  const [kanjiError, setKanjiError] = useState(false);
  const [selectedKanji, setSelectedKanji] = useState<KanjiItem | null>(null);

  useEffect(() => {
    async function loadKanji() {
      try {
        const response = await fetch("/kanji-data.json");
        if (!response.ok) throw new Error("Failed");
        const data: KanjiApiResponse = await response.json();
        setKanji(data.kanji);
      } catch {
        setKanjiError(true);
      } finally {
        setIsLoadingKanji(false);
      }
    }
    loadKanji();
  }, []);

  const kanjiByChar = useMemo(() => {
    const map = new Map<string, KanjiItem>();
    for (const item of kanji) {
      if (!map.has(item.kanji)) {
        map.set(item.kanji, item);
      }
    }
    return map;
  }, [kanji]);

  const setsForTier = useMemo(() => {
    const major = tier === "n5" ? "1" : "2";
    return sets.filter((set) => trainingSetLevelLabel(set)?.startsWith(`${major}-`));
  }, [sets, tier]);

  return (
    <>
      <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Training sets</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          Fixed N5 and N4 sets shipped with the app. Selection happens on the Smash page (dropdown or
          Levels tab).
        </p>
      </header>

      {isLoadingKanji && (
        <div className="rounded-2xl border border-black/10 bg-black/[0.02] px-4 py-10 text-center text-black/60 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/60">
          Loading kanji…
        </div>
      )}

      {kanjiError && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-10 text-center text-red-700 dark:text-red-300">
          Could not load kanji. Try refreshing the page.
        </div>
      )}

      {!isLoadingKanji && !kanjiError && (
        <div className="flex min-h-0 flex-1 flex-col gap-5 lg:grid lg:min-h-[min(720px,calc(100vh-10rem))] lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] lg:items-start lg:gap-6">
          <div className="flex min-h-0 flex-col gap-4">
            <div
              role="tablist"
              aria-label="JLPT tier"
              className="flex max-w-md gap-1 rounded-xl border border-black/10 bg-black/[0.02] p-1 dark:border-white/10 dark:bg-white/[0.04]"
            >
              {(
                [
                  {
                    id: "n5" as const,
                    label: "N5",
                    count: sets.filter((s) => trainingSetLevelLabel(s)?.startsWith("1-")).length,
                  },
                  {
                    id: "n4" as const,
                    label: "N4",
                    count: sets.filter((s) => trainingSetLevelLabel(s)?.startsWith("2-")).length,
                  },
                ] satisfies { id: "n5" | "n4"; label: string; count: number }[]
              ).map(({ id, label, count }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tier === id}
                  id={`training-sets-tab-${id}`}
                  aria-controls="training-sets-tab-panel"
                  disabled={count === 0}
                  className={`flex-1 cursor-pointer rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    tier === id
                      ? "bg-white text-black shadow-sm ring-1 ring-black/10 dark:bg-zinc-900 dark:text-white dark:ring-white/15"
                      : "text-black/55 hover:bg-black/[0.06] hover:text-black/80 disabled:cursor-not-allowed disabled:opacity-40 dark:text-white/55 dark:hover:bg-white/[0.08] dark:hover:text-white/85"
                  }`}
                  onClick={() => setTier(id)}
                >
                  {label}
                  {count > 0 ? (
                    <span className="ml-1.5 tabular-nums text-black/45 dark:text-white/45">
                      ({count})
                    </span>
                  ) : null}
                </button>
              ))}
            </div>

            <div
              id="training-sets-tab-panel"
              role="tabpanel"
              aria-labelledby={`training-sets-tab-${tier}`}
              className="flex min-h-0 flex-col gap-4"
            >
              {setsForTier.map((set) => {
                const level = trainingSetLevelLabel(set);
                return (
                  <div
                    key={set.id}
                    className="rounded-2xl border border-black/10 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5"
                  >
                    <div className="mb-3 flex flex-wrap items-baseline gap-2 gap-y-1">
                      {level ? (
                        <span className="font-mono text-sm font-semibold tabular-nums text-black/70 dark:text-white/70">
                          {level}
                        </span>
                      ) : null}
                      <h2 className="text-lg font-semibold tracking-tight">{set.name}</h2>
                      <span className="text-sm text-black/50 dark:text-white/50">
                        {set.kanjiChars.length} kanji
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {set.kanjiChars.map((c) => {
                        const kItem = kanjiByChar.get(c);
                        return (
                          <button
                            type="button"
                            onClick={() => {
                              if (kItem) {
                                setSelectedKanji(kItem);
                              }
                            }}
                            key={`${set.id}-${c}`}
                            className="inline-flex min-w-[2.5rem] flex-col items-center justify-center rounded-md bg-black/[0.06] px-1.5 py-1 text-base font-semibold tabular-nums dark:bg-white/[0.08]"
                            title={kItem ? formatKanjiGlosses(kItem) : undefined}
                          >
                            <span className="leading-none">{c}</span>
                            {kItem ? (
                              <span className="mt-0.5 text-[10px] font-medium leading-snug text-black/60 dark:text-white/60">
                                {kItem.primaryMeaning}
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <aside className="min-h-0 rounded-2xl border border-black/10 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 lg:sticky lg:top-20 lg:max-h-[min(720px,calc(100vh-7rem))] lg:overflow-y-auto">
            {selectedKanji ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
                    Kanji details
                  </p>
                  <button
                    type="button"
                    className="cursor-pointer rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                    onClick={() => setSelectedKanji(null)}
                  >
                    Close
                  </button>
                </div>
                <KanjiDetailsPanel kanji={selectedKanji} />
              </div>
            ) : (
              <p className="text-black/60 dark:text-white/60">
                Click a kanji in a set to view details.
              </p>
            )}
          </aside>
        </div>
      )}
      </section>
    </>
  );
}
