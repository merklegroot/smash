import { NextResponse } from "next/server";

const commonKanji = [
  { kanji: "日", meaning: "day, sun" },
  { kanji: "一", meaning: "one" },
  { kanji: "国", meaning: "country" },
  { kanji: "人", meaning: "person" },
  { kanji: "年", meaning: "year" },
  { kanji: "大", meaning: "big, large" },
  { kanji: "十", meaning: "ten" },
  { kanji: "二", meaning: "two" },
  { kanji: "本", meaning: "book, origin" },
  { kanji: "中", meaning: "middle, inside" },
];

export function GET() {
  return NextResponse.json({ kanji: commonKanji });
}
