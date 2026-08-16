# Electron process code

`main.ts` creates the secure native window and owns fixed IPC handlers. `preload.ts` contains the narrow renderer bridge. `transcription.ts` owns temporary files and fixed FFmpeg/whisper.cpp process invocations. See the root README for setup and commands.
