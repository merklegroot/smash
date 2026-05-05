"use client";

import { useEffect, useMemo, useState } from "react";
import { formatKanjiGlosses, formatReadings, kanjiGlossSearchText } from "@/lib/kanji/format";
import type { KanjiApiResponse, KanjiItem, KanjiLevelId } from "@/lib/kanji/types";
import { trainingSetLevelLabel } from "@/lib/training-sets/level-labels";
import { loadTrainingSets } from "@/lib/training-sets/storage";

function matchesFilter(item: KanjiItem, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  if (item.kanji.includes(query)) return true;
  if (kanjiGlossSearchText(item).toLowerCase().includes(q)) return true;
  for (const r of [...item.onReading, ...item.kunReading]) {
    if (r.kana.toLowerCase().includes(q) || r.romaji.toLowerCase().includes(q)) {
      return true;
    }
  }
  return item.commonWords.some(
    (w) =>
      w.word.includes(query) ||
      w.readingKana.toLowerCase().includes(q) ||
      w.readingRomaji.toLowerCase().includes(q) ||
      w.meaning.toLowerCase().includes(q),
  );
}

export default function KanjiList() {
  const [decks, setDecks] = useState<{ n5: KanjiItem[]; n4: KanjiItem[] }>({ n5: [], n4: [] });
  const [level, setLevel] = useState<KanjiLevelId>("n5");
  const [selectedKanji, setSelectedKanji] = useState<KanjiItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [filter, setFilter] = useState("");

  const kanji = decks[level];
  const trainingSets = useMemo(() => loadTrainingSets(), []);

  useEffect(() => {
    async function loadKanji() {
      try {
        const response = await fetch("/api/kanji");
        if (!response.ok) {
          throw new Error("Failed to load kanji.");
        }

        const data: KanjiApiResponse = await response.json();
        setDecks({ n5: data.n5, n4: data.n4 });
        setSelectedKanji(data.n5[0] ?? data.n4[0] ?? null);
      } catch {
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    }

    loadKanji();
  }, []);

  const filteredKanji = useMemo(() => {
    const q = filter.trim();
    if (!q) return kanji;
    return kanji.filter((item) => matchesFilter(item, q));
  }, [kanji, filter]);

  const trainingSetsIncludingSelected = useMemo(() => {
    if (!selectedKanji) return [];
    const char = selectedKanji.kanji;
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
  }, [selectedKanji, trainingSets]);

  useEffect(() => {
    if (filteredKanji.length === 0) return;
    setSelectedKanji((prev) => {
      if (prev && filteredKanji.some((k) => k.kanji === prev.kanji)) return prev;
      return filteredKanji[0];
    });
  }, [filteredKanji]);

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5">
      <header className="space-y-3">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">Kanji List</h1>
          <p className="text-sm text-black/60 dark:text-white/60">
            Browse JLPT N5 and N4 kanji
            {!isLoading && !hasError
              ? ` (${decks.n5.length + decks.n4.length} unique across both levels)`
              : null}
            . Filter by character, reading, meaning, or vocabulary.
          </p>
        </div>
        {!isLoading && !hasError && (decks.n5.length > 0 || decks.n4.length > 0) ? (
          <div
            role="tablist"
            aria-label="JLPT level"
            className="flex max-w-md gap-1 rounded-xl border border-black/10 bg-black/[0.02] p-1 dark:border-white/10 dark:bg-white/[0.04]"
          >
            {(
              [
                { id: "n5" as const, label: "N5", count: decks.n5.length },
                { id: "n4" as const, label: "N4", count: decks.n4.length },
              ] satisfies { id: KanjiLevelId; label: string; count: number }[]
            ).map(({ id, label, count }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={level === id}
                id={`kanji-list-tab-${id}`}
                aria-controls="kanji-list-tab-panel"
                disabled={count === 0}
                className={`flex-1 cursor-pointer rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  level === id
                    ? "bg-white text-black shadow-sm ring-1 ring-black/10 dark:bg-zinc-900 dark:text-white dark:ring-white/15"
                    : "text-black/55 hover:bg-black/[0.06] hover:text-black/80 disabled:cursor-not-allowed disabled:opacity-40 dark:text-white/55 dark:hover:bg-white/[0.08] dark:hover:text-white/85"
                }`}
                onClick={() => setLevel(id)}
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
        ) : null}
      </header>
      {isLoading && (
        <div className="rounded-2xl border border-black/10 bg-black/[0.02] px-4 py-10 text-center text-black/60 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/60">
          Loading kanji...
        </div>
      )}
      {hasError && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-10 text-center text-red-700 dark:text-red-300">
          Could not load kanji.
        </div>
      )}
      {!isLoading && !hasError && (
        <div
          id="kanji-list-tab-panel"
          role="tabpanel"
          aria-labelledby={`kanji-list-tab-${level}`}
          className="flex min-h-0 flex-1 flex-col gap-5 lg:grid lg:min-h-[min(720px,calc(100vh-10rem))] lg:grid-cols-[minmax(260px,340px)_1fr] lg:gap-6 lg:items-start"
        >
          <div className="flex min-h-0 flex-col gap-3 lg:sticky lg:top-20 lg:max-h-[min(720px,calc(100vh-7rem))]">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-black/50 dark:text-white/50">
                Search
              </span>
              <input
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Meaning, reading, word…"
                autoComplete="off"
                spellCheck={false}
                className="w-full cursor-text rounded-xl border border-black/15 bg-white px-3 py-2 text-sm outline-none ring-black/20 placeholder:text-black/40 focus:border-black/30 focus:ring-2 dark:border-white/15 dark:bg-black/40 dark:placeholder:text-white/40 dark:focus:border-white/30 dark:focus:ring-white/20"
              />
            </label>
            <p className="text-xs text-black/50 dark:text-white/50" aria-live="polite">
              {filteredKanji.length === kanji.length
                ? `Showing all ${kanji.length}`
                : `${filteredKanji.length} of ${kanji.length} match`}
            </p>
            <div className="min-h-0 max-h-[min(52vh,24rem)] flex-1 overflow-y-auto rounded-2xl border border-black/10 bg-white/70 p-2 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 lg:max-h-none">
              {filteredKanji.length === 0 ? (
                <p className="px-2 py-8 text-center text-sm text-black/55 dark:text-white/55">
                  No kanji match this filter.
                </p>
              ) : (
                <div
                  className="grid grid-cols-5 gap-1 sm:grid-cols-6 sm:gap-1.5"
                  role="listbox"
                  aria-label="Kanji list"
                >
                  {filteredKanji.map((item) => {
                    const selected = selectedKanji?.kanji === item.kanji;
                    return (
                      <button
                        key={`${level}-${item.kanji}`}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        title={formatKanjiGlosses(item)}
                        onClick={() => setSelectedKanji(item)}
                        className={`flex aspect-square min-h-[2.75rem] cursor-pointer items-center justify-center rounded-lg text-xl font-semibold transition sm:text-2xl ${
                          selected
                            ? "bg-black text-white shadow-md ring-2 ring-black/30 dark:bg-white dark:text-black dark:ring-white/40"
                            : "bg-black/[0.04] hover:bg-black/10 dark:bg-white/[0.06] dark:hover:bg-white/12"
                        }`}
                      >
                        {item.kanji}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <aside className="min-h-0 rounded-2xl border border-black/10 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 lg:max-h-[min(720px,calc(100vh-7rem))] lg:overflow-y-auto">
            {selectedKanji && filteredKanji.length > 0 ? (
              <div className="space-y-5">
                <div className="flex flex-col gap-2 border-b border-black/10 pb-4 sm:flex-row sm:items-end sm:justify-between dark:border-white/10">
                  <h2 className="text-5xl font-semibold leading-none tracking-tight">
                    {selectedKanji.kanji}
                  </h2>
                  <div className="max-w-prose text-right sm:text-right">
                    <p className="text-sm leading-snug text-black/85 dark:text-white/85">
                      {selectedKanji.primaryMeaning}
                    </p>
                    {selectedKanji.otherMeaning ? (
                      <p className="mt-1 text-sm leading-snug text-black/60 dark:text-white/60">
                        {selectedKanji.otherMeaning}
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
                    <p className="text-sm">{formatReadings(selectedKanji.onReading)}</p>
                  </div>
                  <div className="rounded-xl border border-black/10 bg-black/[0.03] p-3 dark:border-white/10 dark:bg-white/[0.03]">
                    <p className="mb-1 text-sm font-semibold">Kun reading</p>
                    <p className="text-sm">{formatReadings(selectedKanji.kunReading)}</p>
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-black/60 dark:text-white/60">
                    Common words
                  </p>
                  <ul className="space-y-2">
                    {selectedKanji.commonWords.map((word) => (
                      <li
                        key={`${selectedKanji.kanji}-${word.word}-${word.readingKana}`}
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
            ) : (
              <p className="text-black/60 dark:text-white/60">
                {filteredKanji.length === 0
                  ? "Adjust your search to see details."
                  : "Select a kanji to view details."}
              </p>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}
