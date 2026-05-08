# Run Kanji Smash on your iPad (personal device)

You have two realistic paths. **USB does not expose `http://localhost` from your Mac to Safari on the iPad** — use Wi‑Fi for the quick web path, or install an **iOS build** over USB with Xcode / Tauri.

## Option A — Fastest: Safari on the same Wi‑Fi as your Mac (no App Store)

Good for trying the Smash UI right away on an older iPad.

1. On the Mac, from the repo:
   ```bash
   cd smashnext
   npm install
   npm run dev
   ```
2. Find your Mac’s LAN IP: **System Settings → Network → Wi‑Fi → Details**, or run `ipconfig getifaddr en0` (often `192.168.x.x`).
3. On the **iPad**, join the **same Wi‑Fi** as the Mac.
4. Open **Safari** and go to:
   ```text
   http://YOUR_MAC_IP:3000/smash
   ```
   (Use `http`, not `https`.)

5. Optional: **Share → Add to Home Screen** for a full-screen shortcut.

Firewall: if it doesn’t load, allow incoming connections for Node / Terminal in **System Settings → Network → Firewall**.

---

## Option B — Install a development build over USB (Xcode + Tauri iOS)

Use this when you want a real app icon on the device (still **development** signing; fine for personal use).

### Prerequisites on the Mac

- **Xcode** (you have this).
- **Apple ID** signed into Xcode (**Xcode → Settings → Accounts**). You **do not** need the paid Apple Developer Program ($99/year) for a **personal device**. A **free Apple ID** gives you a **Personal Team** in Xcode, which is enough to install dev builds on **your own** iPhone/iPad. Those builds typically **expire after about 7 days**; run / install again from Xcode or `tauri ios dev` to refresh (normal for free provisioning).
- **Rust** + **Cargo** (`rustup`).
- **CocoaPods** (needed for Tauri iOS):
  ```bash
  brew install cocoapods
  ```
  If `pod` still isn’t found, see [CocoaPods install](https://cocoapods.org/).

### iPad

- **Trust** this computer when you plug in USB.
- **Developer Mode** (if your iPad OS offers it): **Settings → Privacy & Security → Developer Mode** → On → restart if asked.
- Very old iPads may be limited by **minimum iOS** required by WebKit / Tauri; if a build fails for deployment target, we can lower it in the generated Xcode project after `ios init` completes.

### Code signing / team

Tauri needs your **development team**:

1. In Xcode, create any dummy iOS project once, pick **Team: Your Name (Personal Team)** so Xcode creates certificates.
2. Note your **Team ID** (10-character string): Xcode → Settings → Accounts → your team → **Team ID**.

Then either:

- Export before running Tauri:
  ```bash
  export APPLE_DEVELOPMENT_TEAM=YOUR_TEAM_ID
  ```

- Or add to `src-tauri/tauri.conf.json` under `bundle` → `iOS` → `developmentTeam` (see [Tauri iOS](https://v2.tauri.app/develop/)).

### One-time: initialize the iOS project

From `smashtauri`:

```bash
cd smashtauri
npm install
CI=1 npx tauri ios init --ci
```

If `ios init` fails on CocoaPods, install `cocoapods` (above) and run again.

### Run on the plugged-in iPad

1. Unlock the iPad and keep it connected over **USB**.
2. From `smashtauri`:
   ```bash
   export APPLE_DEVELOPMENT_TEAM=YOUR_TEAM_ID
   npx tauri ios dev
   ```
   Pick your **physical device** when the CLI / Xcode asks.

That builds the Rust iOS targets, embeds the same static frontend as desktop (`npm run build:tauri` in `smashnext`), and installs the dev app on the iPad.

### Troubleshooting

- **No signing certificates**: Open Xcode once and sign in; create a trivial iOS app and run it on the iPad to refresh certs.
- **Device not listed**: **Window → Devices and Simulators** in Xcode; trust the computer on the iPad.
- **`tauri ios init` failed**: Ensure **cocoapods** (`pod --version`), **xcodegen** (`brew install xcodegen`), and Rust iOS targets installed (the CLI usually runs `rustup target add` for you).

---

## Summary

| Goal                         | Approach                                      |
|-----------------------------|-----------------------------------------------|
| Try Smash in Safari quickly | Same Wi‑Fi → `http://MAC_IP:3000/smash`       |
| App on home screen (dev)    | `brew install cocoapods` → `tauri ios init` → `tauri ios dev` + team ID |
