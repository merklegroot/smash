# Kanji Smash (Tauri)

Desktop wrapper around the Next.js Smash UI in [`../smashnext`](../smashnext).

## Requirements

- **macOS** (first-class target for now)
- [Rust](https://rustup.rs/) stable
- Node.js 20+

## Development

From this folder:

```bash
npm install
npm run dev
```

This starts the Next.js dev server (`../smashnext`) and opens a native window at `/smash`.

## Production build (macOS `.dmg`)

```bash
npm install
npm run build
```

Artifacts appear under `src-tauri/target/release/bundle/`.

The build runs `npm run build:tauri` in `smashnext`, which performs a **static export** and writes `public/kanji-data.json` so the app works without a Node server.

## iPad / iOS (personal device)

See **[IOS_DEVICE.md](./IOS_DEVICE.md)** — Wi‑Fi Safari shortcut vs USB + Xcode + `tauri ios dev`.

## Android

See **[ANDROID.md](./ANDROID.md)**.

## Future platforms

Bundle targets are currently **macOS `.dmg` only** (`src-tauri/tauri.conf.json`). To extend to Android, iOS, Windows, Linux, and Steam Deck, update `bundle.targets` and add the corresponding toolchains per [Tauri platform docs](https://v2.tauri.app/start/).
