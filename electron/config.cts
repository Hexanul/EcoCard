import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import type { PipelineStatus } from './shared.cjs';

const projectRoot = path.resolve(__dirname, '..');
// `app` is undefined when this module runs under plain Node.js
// (scripts/test-pipeline.mjs), which always uses the project layout.
const isPackaged = (app as typeof app | undefined)?.isPackaged === true;
const runtimeRoot = isPackaged ? process.resourcesPath : projectRoot;
// The ECHOREPORT_* variables are for development only: a packaged app runs
// whisper only from its own folder or from echoReport.paths.json in its
// resources folder, never from a path another program put in the environment.
const fromEnvironment = (name: string): string | undefined => (isPackaged ? undefined : process.env[name]);
const localPathsFile = path.join(runtimeRoot, 'echoReport.paths.json');
type UserPaths = Partial<{ whisperCliPath: string; modelPath: string; vadModelPath: string; tempDir: string }>;

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
  whisperCliPath: fromEnvironment('ECHOREPORT_WHISPER_CLI') ?? configured.whisperCliPath ?? path.join(localAppDirectory, 'bin', 'whisper-cli.exe'),
  modelPath: fromEnvironment('ECHOREPORT_MODEL') ?? configured.modelPath ?? path.join(localAppDirectory, 'models', 'ggml-large-v3-turbo.bin'),
  // Silero voice-activity model; optional, whisper runs without VAD if it is missing.
  vadModelPath: fromEnvironment('ECHOREPORT_VAD_MODEL') ?? configured.vadModelPath ?? path.join(localAppDirectory, 'models', 'ggml-silero-v5.1.2.bin'),
  tempDir: fromEnvironment('ECHOREPORT_TEMP_DIR') ?? configured.tempDir ?? '',
} as const;

export function pipelineStatus(): PipelineStatus {
  return {
    whisperCliFound: existsSync(runtimePaths.whisperCliPath),
    modelFound: existsSync(runtimePaths.modelPath),
    // ggml-large-v3-turbo.bin -> large-v3-turbo
    model: path.basename(runtimePaths.modelPath, '.bin').replace(/^ggml-/, ''),
  };
}
