import type { KanjiLevelId } from "./types";

/** Prefer N5 when present in both decks (merged API order matches this). */
export function resolveKanjiJlptLevel(
  kanji: string,
  n5Chars: ReadonlySet<string>,
  n4Chars: ReadonlySet<string>,
): KanjiLevelId | null {
  if (n5Chars.has(kanji)) {
    return "n5";
  }
  if (n4Chars.has(kanji)) {
    return "n4";
  }
  return null;
}

const JLPT_DISPLAY: Record<KanjiLevelId, string> = {
  n5: "N5",
  n4: "N4",
};

export function formatKanjiJlptHeading(level: KanjiLevelId | null): string {
  return level ? `JLPT ${JLPT_DISPLAY[level]}` : "JLPT —";
}
