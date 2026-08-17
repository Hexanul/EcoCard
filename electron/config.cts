import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { PipelineStatus } from './shared.cjs';

const projectRoot = path.resolve(__dirname, '..');
const localPathsFile = path.join(projectRoot, 'echoReport.paths.json');
type UserPaths = Partial<{ ffmpegPath: string; whisperCliPath: string; modelPath: string; tempDir: string }>;

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
const localAppDirectory = path.join(projectRoot, 'app');
export const runtimePaths = {
  ffmpegPath: process.env.ECHOREPORT_FFMPEG ?? configured.ffmpegPath ?? path.join(localAppDirectory, 'bin', 'ffmpeg.exe'),
  whisperCliPath: process.env.ECHOREPORT_WHISPER_CLI ?? configured.whisperCliPath ?? path.join(localAppDirectory, 'bin', 'whisper-cli.exe'),
  modelPath: process.env.ECHOREPORT_MODEL ?? configured.modelPath ?? path.join(localAppDirectory, 'models', 'ggml-large-v3-turbo.bin'),
  tempDir: process.env.ECHOREPORT_TEMP_DIR ?? configured.tempDir ?? '',
} as const;

export function pipelineStatus(): PipelineStatus {
  return {
    ffmpegFound: existsSync(runtimePaths.ffmpegPath),
    whisperCliFound: existsSync(runtimePaths.whisperCliPath),
    modelFound: existsSync(runtimePaths.modelPath),
    model: 'large-v3-turbo', language: 'ro',
  };
}
