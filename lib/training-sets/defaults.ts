import type { TrainingSet } from "./types";

/** Seeded when localStorage has no training sets yet (`smash-training-sets` missing). */
export const DEFAULT_TRAINING_SETS: TrainingSet[] = [
  {
    id: "b2c3d4e5-f6a7-4890-bcde-f10203040506",
    name: "Numbers 1–10",
    kanjiChars: ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"],
    createdAt: "2026-01-01T12:00:00.000Z",
  },
  {
    id: "c3d4e5f6-a7b8-4901-cdef-102030405061",
    name: "Sun → Saturn row",
    kanjiChars: ["日", "月", "火", "水", "木", "金", "土"],
    createdAt: "2026-01-01T12:00:00.000Z",
  },
  {
    id: "d4e5f6a7-b8c9-4012-def0-203040506172",
    name: "Starter mix",
    kanjiChars: ["人", "大", "小", "国", "日", "本", "学", "校", "見", "行", "休"],
    createdAt: "2026-01-01T12:00:00.000Z",
  },
];
