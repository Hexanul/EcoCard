# Electron + Whisper local pipeline

This milestone adds a minimal Electron shell so FFmpeg and whisper-cli.exe can run
locally on Windows. The React renderer never executes shell commands.

## Prerequisites

1. **FFmpeg** — install locally and set path in `echoReport.paths.json`
2. **whisper-cli.exe** — build or install whisper.cpp for Windows
3. **Model** — place `ggml-large-v3-turbo.bin` locally (no automatic download)

Copy the example config:

```powershell
copy echoReport.paths.example.json echoReport.paths.json
```

Edit `echoReport.paths.json` with your local paths.

## Development

Terminal 1 — Vite dev server:

```powershell
npm run dev
```

Terminal 2 — Electron shell:

```powershell
npm run electron:dev
```

## Offline pipeline

```
Microphone → MediaRecorder (WebM/Opus)
    → Electron IPC
    → ffmpeg.exe → WAV PCM 16-bit / 16 kHz / mono
    → whisper-cli.exe -m ggml-large-v3-turbo.bin -f recording.wav -l ro -nt -otxt -of transcript
    → transcript.txt (temporary, deleted after read)
    → React textarea (editable)
```

Temporary files are created under `%TEMP%/echoreport-*` and deleted after each run.
No patient audio archive is kept.

## whisper-cli command

Verified against the local whisper.cpp build:

```
whisper-cli.exe -m <modelPath> -f <wavPath> -l ro -nt -otxt -of <outputPrefix>
```

Paths come only from `echoReport.paths.json` / environment variables in the main process.
