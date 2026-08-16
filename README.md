# Echo Report desktop

Echo Report is a local Electron + React + TypeScript application. The React UI records audio in the renderer, while only the Electron main process runs local Windows executables. No transcription request, patient audio, or telemetry is sent to the internet.

## Runtime files

Place the untracked runtime files in this project layout:

```
app/
  bin/
    ffmpeg.exe
    whisper-cli.exe
  models/
    ggml-large-v3-turbo.bin
```

Those files are excluded from Git. For a different development location, copy `echoReport.paths.example.json` to the ignored `echoReport.paths.json` and set absolute paths there. The `ECHOREPORT_FFMPEG`, `ECHOREPORT_WHISPER_CLI`, `ECHOREPORT_MODEL`, and `ECHOREPORT_TEMP_DIR` environment variables override that file.

## Commands

```
npm run dev       # compiles Electron, starts Vite, and opens the native window
npm run build     # TypeScript checks, Electron compilation, and React production build
npm run lint
```

`npm run electron:start` opens the compiled React application from `dist/`.

To run a real end-to-end local test after placing all runtime files, set `ECHOREPORT_TEST_AUDIO` to a non-patient audio fixture and run:

```
npm run build
npm run test:pipeline
```

## Security and audio flow

The BrowserWindow enables `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, and `webSecurity: true`. The preload bridge exposes only `getPipelineStatus()` and `transcribeAudio(audioBytes, mimeType)`. It does not expose Node.js, `process`, `require`, filesystem access, a shell, `child_process`, or a generic command API.

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
