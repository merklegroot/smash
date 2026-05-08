/**
 * Writes `public/kanji-data.json` with the same shape as GET /api/kanji
 * so static export (Tauri production bundle) can load kanji without a server.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dataDir = path.join(root, "data");
const outPath = path.join(root, "public", "kanji-data.json");

function mergeKanjiPools(primary, secondary) {
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

const [n5Raw, n4Raw] = await Promise.all([
  readFile(path.join(dataDir, "n5.json"), "utf-8"),
  readFile(path.join(dataDir, "n4.json"), "utf-8"),
]);
const n5 = JSON.parse(n5Raw);
const n4 = JSON.parse(n4Raw);
const kanji = mergeKanjiPools(n5, n4);

await writeFile(outPath, JSON.stringify({ kanji, n5, n4 }), "utf-8");
console.log(`Wrote ${outPath}`);
