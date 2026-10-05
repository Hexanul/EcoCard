// Electron entry point used by scripts/whisper-wav.mjs (dev tools only, never
// packaged): converts audio files to whisper's WAV format with the app's own
// renderer converter (dist-audio/whisperWav.js, compiled from
// src/audio/whisperWav.ts) running in a hidden, sandboxed window, so the
// dictation tools hear exactly what the app sends to whisper.
//
//   electron scripts/whisper-wav-harness.cjs <module.js> <input> <output.wav> [<input> <output.wav> ...]
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const [modulePath, ...pairs] = process.argv.slice(2);

async function convertAll() {
  const window = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  await window.loadURL('about:blank');
  const moduleSource = fs.readFileSync(modulePath, 'utf8');
  await window.webContents.executeJavaScript(`(async () => {
    const url = URL.createObjectURL(new Blob([${JSON.stringify(moduleSource)}], { type: 'text/javascript' }));
    window.whisperWav = await import(url);
  })()`);
  for (let i = 0; i < pairs.length; i += 2) {
    const encoded = fs.readFileSync(pairs[i]).toString('base64');
    // Page errors (e.g. a DOMException from decodeAudioData) do not survive
    // executeJavaScript's rejection, so the message is returned as data.
    const result = await window.webContents.executeJavaScript(`(async () => {
      try {
        const binary = atob(${JSON.stringify(encoded)});
        const bytes = new Uint8Array(binary.length);
        for (let k = 0; k < binary.length; k += 1) bytes[k] = binary.charCodeAt(k);
        return { wav: await window.whisperWav.convertToWhisperWav(bytes.buffer) };
      } catch (error) {
        return { error: String((error && error.message) || error) };
      }
    })()`);
    if (result.error) throw new Error(`${path.basename(pairs[i])}: ${result.error}`);
    fs.writeFileSync(pairs[i + 1], Buffer.from(result.wav));
  }
}

app.whenReady()
  .then(convertAll)
  .then(() => app.exit(0))
  .catch((error) => {
    console.error(`whisper-wav-harness: ${error instanceof Error ? error.message : String(error)}`);
    app.exit(1);
  });
