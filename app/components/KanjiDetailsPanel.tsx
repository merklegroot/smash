"use client";

import { useMemo } from "react";
import { formatReadings } from "@/lib/kanji/format";
import type { KanjiItem } from "@/lib/kanji/types";
import { trainingSetLevelLabel } from "@/lib/training-sets/level-labels";
import { loadTrainingSets } from "@/lib/training-sets/storage";

export function KanjiDetailsPanel({ kanji }: { kanji: KanjiItem }) {
  const trainingSets = useMemo(() => loadTrainingSets(), []);

  const trainingSetsIncludingSelected = useMemo(() => {
    const char = kanji.kanji;
    return trainingSets
      .filter((set) => set.kanjiChars.includes(char))
      .map((set) => ({ set, levelLabel: trainingSetLevelLabel(set) }))
      .sort((a, b) => {
        if (a.levelLabel && b.levelLabel) {
          return a.levelLabel.localeCompare(b.levelLabel, undefined, { numeric: true });
        }
        if (a.levelLabel) return -1;
        if (b.levelLabel) return 1;
        return a.set.name.localeCompare(b.set.name);
      });
  }, [kanji.kanji, trainingSets]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 border-b border-black/10 pb-4 sm:flex-row sm:items-end sm:justify-between dark:border-white/10">
        <h2 className="text-5xl font-semibold leading-none tracking-tight">{kanji.kanji}</h2>
        <div className="max-w-prose text-right sm:text-right">
          <p className="text-sm leading-snug text-black/85 dark:text-white/85">
            {kanji.primaryMeaning}
          </p>
          {kanji.otherMeaning ? (
            <p className="mt-1 text-sm leading-snug text-black/60 dark:text-white/60">
              {kanji.otherMeaning}
            </p>
          ) : null}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-black/60 dark:text-white/60">
          Training sets
        </p>
        {trainingSetsIncludingSelected.length === 0 ? (
          <p className="text-sm text-black/60 dark:text-white/60">
            Not included in any training set.
          </p>
        ) : (
          <ul className="space-y-1">
            {trainingSetsIncludingSelected.map(({ set, levelLabel }) => (
              <li
                key={`set-${set.id}`}
                className="flex items-baseline justify-between gap-3 rounded-xl border border-black/10 bg-black/[0.02] px-3 py-2 text-sm dark:border-white/10 dark:bg-white/[0.03]"
              >
                <span className="min-w-0 truncate font-medium text-black/85 dark:text-white/85">
                  {set.name}
                </span>
                {levelLabel ? (
                  <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-black/60 dark:text-white/60">
                    {levelLabel}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-black/10 bg-black/[0.03] p-3 dark:border-white/10 dark:bg-white/[0.03]">
          <p className="mb-1 text-sm font-semibold">On reading</p>
          <p className="text-sm">{formatReadings(kanji.onReading)}</p>
        </div>
        <div className="rounded-xl border border-black/10 bg-black/[0.03] p-3 dark:border-white/10 dark:bg-white/[0.03]">
          <p className="mb-1 text-sm font-semibold">Kun reading</p>
          <p className="text-sm">{formatReadings(kanji.kunReading)}</p>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-black/60 dark:text-white/60">
          Common words
        </p>
        <ul className="space-y-2">
          {kanji.commonWords.map((word) => (
            <li
              key={`${kanji.kanji}-${word.word}-${word.readingKana}`}
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
  );
}

