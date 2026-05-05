import type { KanjiItem, Reading } from "@/lib/kanji/types";

export function formatReadings(readings: Reading[]) {
  return readings.map((reading) => `${reading.kana} (${reading.romaji})`).join(", ");
}

/** One-line display of primary and optional other gloss. */
export function formatKanjiGlosses(item: KanjiItem): string {
  const o = item.otherMeaning?.trim();
  if (o) {
    return `${item.primaryMeaning} · ${o}`;
  }
  return item.primaryMeaning;
}

/** All kanji-level gloss text for search, filters, and tooltips. */
export function kanjiGlossSearchText(item: KanjiItem): string {
  return [item.primaryMeaning, item.otherMeaning]
    .filter((s): s is string => Boolean(s?.trim()))
    .join(" ");
}
