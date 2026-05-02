"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { KanjiApiResponse, KanjiItem } from "@/lib/kanji/types";
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
        k.meaning.toLowerCase().includes(q),
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

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8">
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
        <div className="flex flex-col gap-10">
          <form
            onSubmit={handleCreate}
            className="rounded-2xl border border-black/10 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5"
          >
            <h2 className="mb-4 text-lg font-semibold">New training set</h2>
            <div className="flex flex-col gap-4">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-black/80 dark:text-white/80">
                  Name
                </span>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Week 3 review"
                  className="w-full max-w-md rounded-xl border border-black/15 bg-white px-3 py-2 text-sm outline-none ring-black/20 transition placeholder:text-black/40 focus:ring-2 dark:border-white/15 dark:bg-black/40 dark:placeholder:text-white/40 dark:focus:ring-white/30"
                />
              </label>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-black/80 dark:text-white/80">
                    Kanji in this set ({selectedChars.size} selected)
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={selectAllFiltered}
                      className="rounded-lg border border-black/15 px-3 py-1.5 text-xs font-medium transition hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
                    >
                      Select all in filter
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
                  placeholder="Filter by kanji or meaning..."
                  className="w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm outline-none ring-black/20 transition placeholder:text-black/40 focus:ring-2 dark:border-white/15 dark:bg-black/40 dark:placeholder:text-white/40 dark:focus:ring-white/30"
                />
                <div className="max-h-64 overflow-y-auto rounded-xl border border-black/10 bg-black/[0.02] p-2 dark:border-white/10 dark:bg-white/[0.02]">
                  <ul className="grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-4">
                    {filteredKanji.map((item) => {
                      const checked = selectedChars.has(item.kanji);
                      return (
                        <li key={item.kanji}>
                          <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 transition hover:bg-black/5 dark:hover:bg-white/5">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleChar(item.kanji)}
                              className="size-4 shrink-0 rounded border-black/30 accent-black dark:border-white/40 dark:accent-white"
                            />
                            <span className="text-xl font-semibold">{item.kanji}</span>
                            <span className="min-w-0 flex-1 truncate text-xs text-black/65 dark:text-white/65">
                              {item.meaning}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                  {filteredKanji.length === 0 && (
                    <p className="px-2 py-6 text-center text-sm text-black/50 dark:text-white/50">
                      No kanji match your filter.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={!newName.trim() || selectedChars.size === 0}
                  className="rounded-xl bg-black px-4 py-2.5 text-sm font-medium text-white transition enabled:hover:bg-black/85 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-black dark:enabled:hover:bg-white/90"
                >
                  Create training set
                </button>
              </div>
            </div>
          </form>

          <div>
            <h2 className="mb-3 text-lg font-semibold">Your training sets</h2>
            {sets.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-black/15 px-4 py-10 text-center text-sm text-black/55 dark:border-white/20 dark:text-white/55">
                No training sets yet. Create one above.
              </p>
            ) : (
              <ul className="space-y-3">
                {sets.map((set) => (
                  <li
                    key={set.id}
                    className="flex flex-col gap-3 rounded-2xl border border-black/10 bg-white/70 p-4 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between dark:border-white/10 dark:bg-white/5"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="font-semibold">{set.name}</p>
                      <p className="text-sm text-black/60 dark:text-white/60">
                        {set.kanjiChars.length} kanji
                      </p>
                      <p className="break-all text-lg leading-relaxed tracking-wide">
                        {set.kanjiChars.join(" ")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(set.id)}
                      className="shrink-0 self-start rounded-lg border border-red-500/35 px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/15 sm:self-center"
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
