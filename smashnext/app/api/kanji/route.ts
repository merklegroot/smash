import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { KanjiItem } from "@/lib/kanji/types";

function mergeKanjiPools(primary: KanjiItem[], secondary: KanjiItem[]): KanjiItem[] {
  const seen = new Set(primary.map((item) => item.kanji));
  const merged = [...primary];
  for (const item of secondary) {
    if (!seen.has(item.kanji)) {
      seen.add(item.kanji);
      merged.push(item);
    }
  }
  return merged;
}

export async function GET() {
  try {
    const dataDir = path.join(process.cwd(), "data");
    const [n5Raw, n4Raw] = await Promise.all([
      readFile(path.join(dataDir, "n5.json"), "utf-8"),
      readFile(path.join(dataDir, "n4.json"), "utf-8"),
    ]);
    const n5 = JSON.parse(n5Raw) as KanjiItem[];
    const n4 = JSON.parse(n4Raw) as KanjiItem[];
    const kanji = mergeKanjiPools(n5, n4);
    return NextResponse.json({ kanji, n5, n4 });
  } catch {
    return NextResponse.json(
      { error: "Failed to read kanji data." },
      { status: 500 },
    );
  }
}
