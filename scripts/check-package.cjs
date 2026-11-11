// electron-builder afterPack hook. Fails the build when:
// - a packaged folder contains a standalone FFmpeg tool. The 2026-09-05 build
//   shipped a GPLv3 ffmpeg.exe from app/bin; audio is now converted by
//   Chromium in the renderer, so no build may ever include one again.
//   Electron's own ffmpeg.dll (Chromium's LGPL media library) is allowed.
// - THIRD_PARTY_NOTICES.txt is missing, or a file shipped in resources/app
//   (whisper binaries, models) is not named in it: every third-party component
//   must ship with its licence text (legal/THIRD_PARTY_NOTICES.txt).
const { existsSync, readFileSync, readdirSync } = require('node:fs');
const path = require('node:path');

const FORBIDDEN = /^(?:ffmpeg|ffprobe|ffplay)\.exe$/i;
const NOTICES_FILE = 'THIRD_PARTY_NOTICES.txt';

function listFiles(directory) {
  const found = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...listFiles(entryPath));
    else found.push(entryPath);
  }
  return found;
}

function findForbidden(directory) {
  return listFiles(directory).filter((file) => FORBIDDEN.test(path.basename(file)));
}

/** Files under resources/app whose name does not appear in the notices text. */
function findUnlistedComponents(appOutDir, noticesText) {
  const resourcesApp = path.join(appOutDir, 'resources', 'app');
  if (!existsSync(resourcesApp)) return [];
  const listed = noticesText.toLowerCase();
  return listFiles(resourcesApp).filter((file) => !listed.includes(path.basename(file).toLowerCase()));
}

exports.findForbidden = findForbidden;
exports.findUnlistedComponents = findUnlistedComponents;

exports.default = async function checkPackage(context) {
  const { appOutDir } = context;
  const forbidden = findForbidden(appOutDir);
  if (forbidden.length > 0) {
    throw new Error(`Packaged app contains forbidden FFmpeg binaries (GPL, unused):\n${forbidden.join('\n')}`);
  }

  const noticesPath = path.join(appOutDir, NOTICES_FILE);
  if (!existsSync(noticesPath)) {
    throw new Error(`Packaged app is missing ${NOTICES_FILE} (see extraFiles in electron-builder.yml).`);
  }
  const unlisted = findUnlistedComponents(appOutDir, readFileSync(noticesPath, 'utf8'));
  if (unlisted.length > 0) {
    throw new Error(
      `Packaged files not listed in legal/${NOTICES_FILE} (add the component and its licence, `
      + `or exclude the file in electron-builder.yml):\n${unlisted.join('\n')}`,
    );
  }
};
