# WaveConvert — desktop build

This folder turns the WaveConvert web app into a portable Windows app using
Electron. I can't compile the actual `.exe` from here (this sandbox has no
network access and no Windows toolchain), so the last step needs to run on
your own machine — it's two commands.

## What's in here

- `index.html` — the app itself, now with 8 export formats: WAV, MP3, FLAC,
  OGG Vorbis, Opus, AIFF, M4A/AAC, and ALAC.
- `main.js` — a small Electron shell that just opens `index.html` in a window.
- `package.json` — build config (uses `electron-builder`'s `portable` target,
  which produces a single self-contained `.exe` — no installer, no admin
  rights, just double-click and run).

## Build it (on Windows, or macOS/Linux with Wine installed)

```bash
npm install
npm run dist
```

That downloads Electron once, then writes
`dist/WaveConvert-Portable.exe` — copy that one file anywhere and run it.

## How the codecs work

- **WAV** and **MP3** are encoded locally in JavaScript (native WAV writer +
  the bundled `lamejs` library) — fully offline, no internet needed.
- **FLAC, OGG Vorbis, Opus, AIFF, M4A/AAC, ALAC** are encoded with
  `ffmpeg.wasm` (a real FFmpeg build compiled to WebAssembly). The app loads
  it from a CDN (unpkg.com) the *first* time you export one of these formats
  — about 25MB, one-time, then the browser/Electron cache keeps it. This
  means the very first export of a non-WAV/MP3 format needs an internet
  connection; after that it works offline until the cache is cleared.
  - If you want the app to be **100% offline from the first run**, download
    these two files yourself and place them next to `index.html` in an
    `ffmpeg/` folder, then change `FFMPEG_JS_URL` and `FFMPEG_CORE_URL` near
    the top of the `<script>` block in `index.html` to point at the local
    files instead of the unpkg URLs:
    - `@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js`
    - `@ffmpeg/core-st@0.11.1/dist/ffmpeg-core.js` (and its matching
      `ffmpeg-core.wasm`)
  - This uses the **single-threaded** ffmpeg core specifically because it
    doesn't need special cross-origin-isolation headers, so it works from a
    plain file or inside Electron with zero extra config.

## Icon (optional)

No app icon is bundled. Add a `build/icon.ico` (256×256) and put
`"icon": "build/icon.ico"` back into the `win` block of `package.json` (and
into the `BrowserWindow` options in `main.js`) if you want a custom one.

## Notes

- `npm run dist` needs Node.js installed (18+ is fine) — https://nodejs.org
- Building a Windows `.exe` from macOS/Linux requires Wine; building on an
  actual Windows machine avoids that entirely.
- If corporate/antivirus software flags unsigned portable exes, that's
  normal for unsigned Electron builds — code-signing requires a paid
  certificate and is a separate step (`electron-builder` supports it via
  `win.certificateFile` if you get one).
