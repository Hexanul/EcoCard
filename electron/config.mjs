import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const pathsFile = path.join(projectRoot, 'echoReport.paths.json');

const defaults = {
  ffmpegPath:
    process.env.ECHOREPORT_FFMPEG ??
    'C:\\Users\\Calin\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-9.0-full_build\\bin\\ffmpeg.exe',
  whisperCliPath:
    process.env.ECHOREPORT_WHISPER_CLI ??
    'C:\\Calin\\Whisper\\whisper.cpp\\build\\bin\\Release\\whisper-cli.exe',
  modelPath:
    process.env.ECHOREPORT_MODEL ??
    'C:\\EchoReport\\models\\ggml-large-v3-turbo.bin',
  tempDir: process.env.ECHOREPORT_TEMP_DIR ?? '',
};

function loadUserPaths() {
  if (!existsSync(pathsFile)) {
    return {};
  }

  try {
    const raw = readFileSync(pathsFile, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    console.error('[Echo Report] Failed to read echoReport.paths.json:', error);
    return {};
  }
}

export const pathsConfig = {
  ...defaults,
  ...loadUserPaths(),
};

export const whisperRuntimeConfig = {
  model: 'large-v3-turbo',
  language: 'ro',
  modelFileName: 'ggml-large-v3-turbo.bin',
};

export function getPipelineStatus() {
  return {
    ffmpegFound: existsSync(pathsConfig.ffmpegPath),
    whisperCliFound: existsSync(pathsConfig.whisperCliPath),
    modelFound: existsSync(pathsConfig.modelPath),
    ffmpegPath: pathsConfig.ffmpegPath,
    whisperCliPath: pathsConfig.whisperCliPath,
    modelPath: pathsConfig.modelPath,
    model: whisperRuntimeConfig.model,
    language: whisperRuntimeConfig.language,
  };
}
