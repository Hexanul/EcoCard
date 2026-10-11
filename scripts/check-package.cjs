// electron-builder afterPack hook: fails the build if a packaged folder
// contains a standalone FFmpeg tool. The 2026-09-05 build shipped a GPLv3
// ffmpeg.exe from app/bin; audio is now converted by Chromium in the renderer,
// so no build may ever include one again. Electron's own ffmpeg.dll (Chromium's
// LGPL media library) is expected and allowed.
const { readdirSync } = require('node:fs');
const path = require('node:path');

const FORBIDDEN = /^(?:ffmpeg|ffprobe|ffplay)\.exe$/i;

function findForbidden(directory) {
  const found = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...findForbidden(entryPath));
    else if (FORBIDDEN.test(entry.name)) found.push(entryPath);
  }
  return found;
}

exports.findForbidden = findForbidden;

exports.default = async function checkPackage(context) {
  const found = findForbidden(context.appOutDir);
  if (found.length > 0) {
    throw new Error(`Packaged app contains forbidden FFmpeg binaries (GPL, unused):\n${found.join('\n')}`);
  }
};
