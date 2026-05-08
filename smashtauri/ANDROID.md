# Android build (Tauri v2)

This project uses **Tauri v2 mobile**. Android support requires the Android SDK **Command-line Tools** (the piece currently missing on this machine).

## One-time prerequisites (macOS)

- Install **Android Studio**
- In Android Studio, open **Settings → Appearance & Behavior → System Settings → Android SDK → SDK Tools**
- Check and install:
  - **Android SDK Command-line Tools (latest)**
  - **Android SDK Platform-Tools**
  - **Android SDK Build-Tools**

After installing, you should have a folder like:

`~/Library/Android/sdk/cmdline-tools/latest/bin`

Tauri will auto-detect the SDK at `~/Library/Android/sdk`. If you keep it elsewhere, set:

```bash
export ANDROID_HOME="/path/to/Android/sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
```

Also ensure Java is available (Android Studio’s embedded JBR is fine, or a system JDK).

## Generate the Android project (first time only)

From `smashtauri/`:

```bash
npm install
npm run android:init
```

This creates `src-tauri/gen/android/` (Gradle project).

## Development

```bash
npm run android:dev
```

## Release build

```bash
npm run android:build
```

## Troubleshooting

- If you see “Skipping Android Studio command line tools installation…”, it means `cmdline-tools/latest` is missing.
- If Gradle can’t find the SDK, verify `ANDROID_HOME` and that `platform-tools/` exists.
