# Electron process code

`main.cts` creates the secure native window and owns fixed IPC handlers. `preload.cts` contains the narrow renderer bridge. `transcription.cts` owns temporary files and fixed FFmpeg/whisper.cpp process invocations. They compile to CommonJS (`.cjs`) because Electron's main and sandboxed preload processes require that runtime format here. See the root README for setup and commands.
