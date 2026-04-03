import type { Reading } from "@/lib/kanji/types";

export function formatReadings(readings: Reading[]) {
  return readings.map((reading) => `${reading.kana} (${reading.romaji})`).join(", ");
}
