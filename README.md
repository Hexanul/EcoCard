# Raport Eco desktop

Raport Eco is a local Electron + React + TypeScript application. The React UI records audio in the renderer, while only the Electron main process runs local Windows executables. No transcription request, patient audio, or telemetry is sent to the internet.

## Runtime files

Place the untracked runtime files in this project layout:

```
app/
  bin/
    ffmpeg.exe
    whisper-cli.exe
    # all *.dll files distributed alongside whisper-cli.exe
  models/
    ggml-large-v3-turbo.bin
```

Those files are excluded from Git. For a different development location, copy `echoReport.paths.example.json` to the ignored `echoReport.paths.json` and set absolute paths there. The `ECHOREPORT_FFMPEG`, `ECHOREPORT_WHISPER_CLI`, `ECHOREPORT_MODEL`, and `ECHOREPORT_TEMP_DIR` environment variables override that file.

## Commands

```
npm run dev       # compiles Electron, starts Vite, and opens the native window
npm run build     # TypeScript checks, Electron compilation, and React production build
npm run package:installer  # creates a client-ready Windows installer in release/
npm run package:portable  # creates a client-ready Windows portable .exe in release/
npm run lint
```

## Client handoff

Run `npm.cmd run package:portable` on Windows. The generated `release/Raport-Eco-Portable.exe` can be copied to the client's laptop and started directly; no Node.js, npm, or installation step is required. The packaged app includes the local `app/bin` and `app/models` runtime files. If using `release/win-unpacked` instead, copy the entire folder, not only its `.exe` file.

`npm run electron:start` opens the compiled React application from `dist/`.

To run a real end-to-end local test after placing all runtime files, set `ECHOREPORT_TEST_AUDIO` to a non-patient audio fixture and run:

```
npm run build
npm run test:pipeline
```

## Security and audio flow

The BrowserWindow enables `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, and `webSecurity: true`. The preload bridge exposes only `getPipelineStatus()`, `transcribeAudio(audioBytes, mimeType)`, and `exportPdf(suggestedName)`. It does not expose Node.js, `process`, `require`, filesystem access, a shell, `child_process`, or a generic command API.

`exportPdf()` triggers the `echo-report:export-pdf` IPC channel; the main process waits for the rendered `#printable-report`, opens the native Windows Save As dialog, and generates the selected file with `webContents.printToPDF()` using A4 portrait settings. Nothing is sent to a printer and no report data leaves the machine. The "Previzualizare raport" button opens a read-only preview of the current report state; "Exportă PDF" saves that same rendered report (print CSS: `@page { size: A4 portrait; margin: 12mm; }`, app UI hidden via `.no-print`).

```
React MediaRecorder (WebM/Opus)
  -> preload IPC: transcribeAudio
  -> Electron main process
  -> ffmpeg.exe: WAV / PCM signed 16-bit / mono / 16000 Hz
  -> whisper-cli.exe: local large-v3-turbo, Romanian
  -> preload IPC result
  -> editable React textarea
```

The main process writes one recording into a `%TEMP%/echoreport-*` session directory, removes that directory in `finally`, and does not archive audio. It uses fixed executable/model paths from trusted local configuration and fixed command arguments:

```
whisper-cli.exe -m <modelPath> -f <wavPath> -l ro -nt -otxt -of <outputPrefix>
```

Those options were verified with the installed `whisper-cli.exe --help`. The handler returns structured safe error codes for missing dependencies, invalid audio, conversion/process failures, permissions/storage problems, and timeouts; raw stacks remain in the main-process log only.
