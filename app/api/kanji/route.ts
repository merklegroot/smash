import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

type KanjiItem = {
  kanji: string;
  meaning: string;
  onReading: { kana: string; romaji: string }[];
  kunReading: { kana: string; romaji: string }[];
  commonWords: {
    word: string;
    readingKana: string;
    readingRomaji: string;
    meaning: string;
  }[];
};

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "data", "kanji.json");
    const fileContent = await readFile(filePath, "utf-8");
    const kanjiData = JSON.parse(fileContent) as KanjiItem[];
    const kanji = kanjiData.map((item) => ({
      kanji: item.kanji,
      meaning: item.meaning,
      onReading: item.onReading,
      kunReading: item.kunReading,
      commonWords: item.commonWords,
    }));

    return NextResponse.json({ kanji });
  } catch {
    return NextResponse.json(
      { error: "Failed to read kanji data." },
      { status: 500 },
    );
  }
}
