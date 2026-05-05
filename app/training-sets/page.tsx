"use client";

import { useEffect, useMemo, useState } from "react";
import { formatKanjiGlosses } from "@/lib/kanji/format";
import type { KanjiApiResponse, KanjiItem } from "@/lib/kanji/types";
import { trainingSetLevelLabel } from "@/lib/training-sets/level-labels";
import { loadTrainingSets } from "@/lib/training-sets/storage";

export default function TrainingSets() {
  const sets = useMemo(() => loadTrainingSets(), []);
  const [kanji, setKanji] = useState<KanjiItem[]>([]);
  const [isLoadingKanji, setIsLoadingKanji] = useState(true);
  const [kanjiError, setKanjiError] = useState(false);

  useEffect(() => {
    async function loadKanji() {
      try {
        const response = await fetch("/api/kanji");
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

  return (
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
        <ul className="flex flex-col gap-4">
          {sets.map((set) => {
            const level = trainingSetLevelLabel(set);
            return (
              <li
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
                      <span
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
                      </span>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
