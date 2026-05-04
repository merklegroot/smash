"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatKanjiGlosses, kanjiGlossSearchText } from "@/lib/kanji/format";
import type { KanjiApiResponse, KanjiItem } from "@/lib/kanji/types";
import { DEFAULT_TRAINING_SETS } from "@/lib/training-sets/defaults";
import { saveSmashPoolPreference } from "@/lib/training-sets/preference";
import { createTrainingSetId, loadTrainingSets, saveTrainingSets } from "@/lib/training-sets/storage";
import type { TrainingSet } from "@/lib/training-sets/types";

export default function TrainingSets() {
  const [kanji, setKanji] = useState<KanjiItem[]>([]);
  const [sets, setSets] = useState<TrainingSet[]>([]);
  const [isLoadingKanji, setIsLoadingKanji] = useState(true);
  const [kanjiError, setKanjiError] = useState(false);
  const [newName, setNewName] = useState("");
  const [selectedChars, setSelectedChars] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [storageReady, setStorageReady] = useState(false);

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

  useEffect(() => {
    setSets(loadTrainingSets());
    setStorageReady(true);
  }, []);

  const persist = useCallback((next: TrainingSet[]) => {
    setSets(next);
    saveTrainingSets(next);
  }, []);

  const filteredKanji = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return kanji;
    return kanji.filter(
      (k) =>
        k.kanji.includes(q) ||
        kanjiGlossSearchText(k).toLowerCase().includes(q),
    );
  }, [kanji, filter]);

  const toggleChar = (char: string) => {
    setSelectedChars((prev) => {
      const next = new Set(prev);
      if (next.has(char)) next.delete(char);
      else next.add(char);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedChars((prev) => {
      const next = new Set(prev);
      for (const k of filteredKanji) {
        next.add(k.kanji);
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedChars(new Set());

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name || selectedChars.size === 0) return;

    const trainingSet: TrainingSet = {
      id: createTrainingSetId(),
      name,
      kanjiChars: Array.from(selectedChars),
      createdAt: new Date().toISOString(),
    };

    persist([trainingSet, ...sets]);
    setNewName("");
    setSelectedChars(new Set());
    setFilter("");
  };

  const handleDelete = (id: string) => {
    persist(sets.filter((s) => s.id !== id));
  };

  const handleRestoreDefaults = () => {
    if (
      !window.confirm(
        "Replace all training sets with the built-in defaults? Your current sets will be removed. Smash will use the first default set. This cannot be undone.",
      )
    ) {
      return;
    }
    const fresh = DEFAULT_TRAINING_SETS.map((s) => ({
      ...s,
      kanjiChars: [...s.kanjiChars],
    }));
    persist(fresh);
    if (fresh[0]) {
      saveSmashPoolPreference(fresh[0].id);
    }
  };

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Training Sets</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          Create named sets and choose which kanji each set includes. Sets are saved in this browser.
        </p>
      </header>

      {isLoadingKanji && (
        <div className="rounded-2xl border border-black/10 bg-black/[0.02] px-4 py-10 text-center text-black/60 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/60">
          Loading kanji...
        </div>
      )}

      {kanjiError && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-10 text-center text-red-700 dark:text-red-300">
          Could not load kanji. Try refreshing the page.
        </div>
      )}

      {!isLoadingKanji && !kanjiError && storageReady && (
        <div className="flex min-h-0 flex-col gap-8 lg:grid lg:grid-cols-[minmax(240px,300px)_minmax(0,1fr)] lg:items-start lg:gap-8">
          {/* Sidebar: saved sets first on mobile for quick access */}
          <aside className="order-1 flex min-h-0 flex-col gap-3 lg:sticky lg:top-20 lg:max-h-[min(640px,calc(100vh-6rem))] lg:overflow-y-auto">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold tracking-tight">Your sets</h2>
              <button
                type="button"
                onClick={handleRestoreDefaults}
                className="rounded-lg border border-amber-600/40 px-2.5 py-1 text-xs font-medium text-amber-900 transition hover:bg-amber-500/15 dark:border-amber-500/45 dark:text-amber-100 dark:hover:bg-amber-500/10"
              >
                Restore defaults
              </button>
            </div>
            {sets.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-black/15 px-4 py-8 text-center text-sm text-black/55 dark:border-white/20 dark:text-white/55">
                No sets yet. Use the form to create one.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {sets.map((set) => (
                  <li
                    key={set.id}
                    className="rounded-xl border border-black/10 bg-white/70 p-3 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold leading-tight">{set.name}</p>
                        <p className="mt-0.5 text-xs text-black/55 dark:text-white/55">
                          {set.kanjiChars.length} kanji
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDelete(set.id)}
                        className="shrink-0 rounded-lg border border-red-500/35 px-2 py-1 text-xs font-medium text-red-700 transition hover:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/15"
                      >
                        Delete
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {set.kanjiChars.map((c) => {
                        const kItem = kanji.find((j) => j.kanji === c);
                        return (
                          <span
                            key={`${set.id}-${c}`}
                            className="inline-flex min-w-[1.75rem] items-center justify-center rounded-md bg-black/[0.06] px-1.5 py-0.5 text-base font-semibold tabular-nums dark:bg-white/[0.08]"
                            title={kItem ? formatKanjiGlosses(kItem) : undefined}
                          >
                            {c}
                          </span>
                        );
                      })}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          {/* Main: builder */}
          <form
            onSubmit={handleCreate}
            className="order-2 flex min-w-0 flex-col gap-4 rounded-2xl border border-black/10 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5"
          >
            <h2 className="text-base font-semibold tracking-tight">New training set</h2>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-3">
              <label className="block min-w-0 flex-1 space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-black/55 dark:text-white/55">
                  Name
                </span>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Week 3 review"
                  className="w-full cursor-text rounded-xl border border-black/15 bg-white px-3 py-2 text-sm outline-none ring-black/20 transition placeholder:text-black/40 focus:ring-2 dark:border-white/15 dark:bg-black/40 dark:placeholder:text-white/40 dark:focus:ring-white/30"
                />
              </label>
              <button
                type="submit"
                disabled={!newName.trim() || selectedChars.size === 0}
                className="shrink-0 rounded-xl bg-black px-4 py-2.5 text-sm font-medium text-white transition enabled:hover:bg-black/85 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-black dark:enabled:hover:bg-white/90 sm:min-w-[10rem]"
              >
                Create set
              </button>
            </div>

            <div className="space-y-2 border-t border-black/10 pt-4 dark:border-white/10">
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <span className="text-sm text-black/75 dark:text-white/75">
                  <span className="font-medium tabular-nums">{selectedChars.size}</span> selected
                  {kanji.length > 0 && (
                    <span className="text-black/45 dark:text-white/45">
                      {" "}
                      · {filteredKanji.length === kanji.length
                        ? `${kanji.length} shown`
                        : `${filteredKanji.length} match`}
                    </span>
                  )}
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={selectAllFiltered}
                    className="rounded-lg border border-black/15 px-3 py-1.5 text-xs font-medium transition hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
                  >
                    Add all in filter
                  </button>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="rounded-lg border border-black/15 px-3 py-1.5 text-xs font-medium transition hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
                  >
                    Clear selection
                  </button>
                </div>
              </div>

              <input
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter by kanji or meaning…"
                className="w-full cursor-text rounded-xl border border-black/15 bg-white px-3 py-2 text-sm outline-none ring-black/20 transition placeholder:text-black/40 focus:ring-2 dark:border-white/15 dark:bg-black/40 dark:placeholder:text-white/40 dark:focus:ring-white/30"
              />

              <div className="max-h-[min(52vh,22rem)] overflow-y-auto rounded-xl border border-black/10 bg-black/[0.02] p-2 dark:border-white/10 dark:bg-white/[0.02] lg:max-h-[min(56vh,26rem)]">
                <ul className="grid grid-cols-3 gap-1 sm:grid-cols-4 md:grid-cols-5">
                  {filteredKanji.map((item) => {
                    const checked = selectedChars.has(item.kanji);
                    return (
                      <li key={item.kanji}>
                        <label
                          className="flex cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1.5 transition hover:bg-black/5 dark:hover:bg-white/5"
                          title={formatKanjiGlosses(item)}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleChar(item.kanji)}
                            className="size-3.5 shrink-0 rounded border-black/30 accent-black dark:border-white/40 dark:accent-white"
                          />
                          <span className="text-lg font-semibold leading-none">{item.kanji}</span>
                          <span className="hidden min-w-0 flex-1 truncate text-[11px] leading-tight text-black/60 md:inline dark:text-white/60">
                            {item.primaryMeaning}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
                {filteredKanji.length === 0 && (
                  <p className="px-2 py-8 text-center text-sm text-black/50 dark:text-white/50">
                    No kanji match your filter.
                  </p>
                )}
              </div>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
