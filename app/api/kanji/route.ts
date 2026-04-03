import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

type KanjiItem = {
  kanji: string;
  meaning: string;
};

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "data", "kanji.json");
    const fileContent = await readFile(filePath, "utf-8");
    const kanji = JSON.parse(fileContent) as KanjiItem[];

    return NextResponse.json({ kanji });
  } catch {
    return NextResponse.json(
      { error: "Failed to read kanji data." },
      { status: 500 },
    );
  }
}
