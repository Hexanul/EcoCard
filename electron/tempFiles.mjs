import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathsConfig } from './config.mjs';

/**
 * Creates a temporary working directory for one recording pipeline run.
 * Patient audio is NOT archived — the directory is deleted after processing.
 */
export async function createTempSessionDir() {
  const baseDir = pathsConfig.tempDir || os.tmpdir();
  const sessionDir = await mkdtemp(path.join(baseDir, 'echoreport-'));
  return sessionDir;
}

export async function cleanupTempSessionDir(sessionDir) {
  if (!sessionDir) {
    return;
  }

  try {
    await rm(sessionDir, { recursive: true, force: true });
  } catch (error) {
    console.error('[Echo Report] Failed to delete temp session dir:', sessionDir, error);
  }
}
