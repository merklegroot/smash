import type { TrainingSet } from "./types";

/**
 * Seeded when localStorage has no training sets yet (`smash-training-sets` missing).
 *
 * Themed after a common N5 study breakdown. Each set only includes characters that
 * exist in `data/n5.json` (this app’s N5 list). Omitted: body parts, 分/週/店/駅/道,
 * several nature/adjective/school characters not in the deck, and the “look-alike”
 * set (not enough of those kanji in data). Meanings in the source list are for study
 * reference; the app stores kanji only.
 */
export const DEFAULT_TRAINING_SETS: TrainingSet[] = [
  {
    id: "a1000001-0000-4000-8000-000000000001",
    name: "Numbers & yen",
    kanjiChars: ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "百", "千", "万", "円"],
    createdAt: "2026-02-01T10:00:00.000Z",
  },
  {
    id: "a1000001-0000-4000-8000-000000000002",
    name: "Time & calendar",
    kanjiChars: ["日", "月", "年", "時", "間", "午", "前", "後", "今", "先", "来", "半", "毎", "何"],
    createdAt: "2026-02-01T10:00:01.000Z",
  },
  {
    id: "a1000001-0000-4000-8000-000000000003",
    name: "People & family",
    kanjiChars: ["人", "男", "女", "子", "母", "父", "友"],
    createdAt: "2026-02-01T10:00:02.000Z",
  },
  {
    id: "a1000001-0000-4000-8000-000000000004",
    name: "Directions & places",
    kanjiChars: ["上", "下", "中", "外", "左", "右", "前", "後", "東", "西", "南", "北", "国"],
    createdAt: "2026-02-01T10:00:03.000Z",
  },
  {
    id: "a1000001-0000-4000-8000-000000000005",
    name: "Nature & elements",
    kanjiChars: ["山", "川", "木", "火", "水", "土", "金", "雨", "天"],
    createdAt: "2026-02-01T10:00:04.000Z",
  },
  {
    id: "a1000001-0000-4000-8000-000000000006",
    name: "Size & color",
    kanjiChars: ["大", "小", "高", "長", "白"],
    createdAt: "2026-02-01T10:00:05.000Z",
  },
  {
    id: "a1000001-0000-4000-8000-000000000007",
    name: "Common actions",
    kanjiChars: ["見", "聞", "食", "行", "来", "出", "入", "休"],
    createdAt: "2026-02-01T10:00:06.000Z",
  },
  {
    id: "a1000001-0000-4000-8000-000000000008",
    name: "School & language",
    kanjiChars: ["学", "校", "生", "本", "語"],
    createdAt: "2026-02-01T10:00:07.000Z",
  },
  {
    id: "a1000001-0000-4000-8000-000000000009",
    name: "Core sampler",
    kanjiChars: [
      "一",
      "二",
      "三",
      "四",
      "五",
      "六",
      "七",
      "八",
      "九",
      "十",
      "日",
      "月",
      "年",
      "時",
      "人",
      "上",
      "下",
      "山",
      "小",
    ],
    createdAt: "2026-02-01T10:00:08.000Z",
  },
];
