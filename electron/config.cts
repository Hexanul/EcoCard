import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import type { PipelineStatus } from './shared.cjs';

const projectRoot = path.resolve(__dirname, '..');
// `app` is undefined when this module runs under plain Node.js
// (scripts/test-pipeline.mjs), which always uses the project layout.
const runtimeRoot = (app as typeof app | undefined)?.isPackaged ? process.resourcesPath : projectRoot;
const localPathsFile = path.join(runtimeRoot, 'echoReport.paths.json');
type UserPaths = Partial<{ ffmpegPath: string; whisperCliPath: string; modelPath: string; vadModelPath: string; tempDir: string }>;

function readLocalPaths(): UserPaths {
  if (!existsSync(localPathsFile)) return {};
  try {
    const parsed: unknown = JSON.parse(readFileSync(localPathsFile, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed as UserPaths : {};
  } catch {
    return {};
  }
}

const configured = readLocalPaths();
const localAppDirectory = path.join(runtimeRoot, 'app');
export const runtimePaths = {
  ffmpegPath: process.env.ECHOREPORT_FFMPEG ?? configured.ffmpegPath ?? path.join(localAppDirectory, 'bin', 'ffmpeg.exe'),
  whisperCliPath: process.env.ECHOREPORT_WHISPER_CLI ?? configured.whisperCliPath ?? path.join(localAppDirectory, 'bin', 'whisper-cli.exe'),
  modelPath: process.env.ECHOREPORT_MODEL ?? configured.modelPath ?? path.join(localAppDirectory, 'models', 'ggml-large-v3-turbo.bin'),
  // Silero voice-activity model; optional, whisper runs without VAD if it is missing.
  vadModelPath: process.env.ECHOREPORT_VAD_MODEL ?? configured.vadModelPath ?? path.join(localAppDirectory, 'models', 'ggml-silero-v5.1.2.bin'),
  tempDir: process.env.ECHOREPORT_TEMP_DIR ?? configured.tempDir ?? '',
} as const;

export function pipelineStatus(): PipelineStatus {
  return {
    ffmpegFound: existsSync(runtimePaths.ffmpegPath),
    whisperCliFound: existsSync(runtimePaths.whisperCliPath),
    modelFound: existsSync(runtimePaths.modelPath),
    // ggml-large-v3-turbo.bin -> large-v3-turbo
    model: path.basename(runtimePaths.modelPath, '.bin').replace(/^ggml-/, ''), language: 'ro',
  };
}
