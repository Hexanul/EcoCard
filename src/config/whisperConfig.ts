/**
 * Local Whisper configuration for offline Romanian speech recognition.
 *
 * Binary and model paths are configured for the Electron main process only
 * (see echoReport.paths.json / echoReport.paths.example.json).
 *
 * Future / current Electron architecture:
 *   React renderer
 *         ↓ IPC (fixed channels, no shell access from UI)
 *   Electron main process
 *         ↓ ffmpeg.exe
 *   WAV PCM 16-bit / 16 kHz / mono
 *         ↓ whisper-cli.exe
 *   large-v3-turbo (local model file)
 *         ↓
 *   Romanian transcript
 *         ↓ IPC
 *   React renderer
 *
 * No network requests. No automatic model download.
 */
export const whisperConfig = {
  model: 'large-v3-turbo',
  modelFileName: 'ggml-large-v3-turbo.bin',
  language: 'ro',
} as const;

/**
 * Default expected locations on Windows (overridden by echoReport.paths.json).
 * These are documentation defaults — the renderer does not read these paths.
 */
export const defaultWindowsPaths = {
  ffmpegPath: 'C:\\EchoReport\\bin\\ffmpeg.exe',
  whisperCliPath: 'C:\\EchoReport\\bin\\whisper-cli.exe',
  modelPath: 'C:\\EchoReport\\models\\ggml-large-v3-turbo.bin',
} as const;
