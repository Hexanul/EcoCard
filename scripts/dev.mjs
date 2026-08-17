import { spawn } from 'node:child_process';
import http from 'node:http';

const port = 5173;
let vite;
let electron;

function stop(child) {
  if (child && !child.killed) child.kill();
}

function shutdown(exitCode = 0) {
  stop(electron);
  stop(vite);
  process.exit(exitCode);
}

function waitForVite() {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 30_000;
    const attempt = () => {
      const request = http.get(`http://127.0.0.1:${port}`, (response) => {
        response.resume();
        resolve();
      });
      request.once('error', () => {
        if (Date.now() >= deadline) reject(new Error('Vite did not start within 30 seconds.'));
        else setTimeout(attempt, 250);
      });
      request.setTimeout(1000, () => request.destroy());
    };
    attempt();
  });
}

const useWindowsCommandShell = process.platform === 'win32';

vite = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'dev:vite', '--', '--host', '127.0.0.1', '--port', String(port)], {
  stdio: 'inherit',
  shell: useWindowsCommandShell,
});
vite.once('exit', (code) => shutdown(code ?? 1));

try {
  await waitForVite();
  const electronEnvironment = { ...process.env, ECHOREPORT_DEV_SERVER_URL: `http://127.0.0.1:${port}` };
  // Some IDE-integrated terminals set this for their own Electron tooling.
  // It makes electron.exe behave like plain Node.js, so never inherit it.
  delete electronEnvironment.ELECTRON_RUN_AS_NODE;
  electron = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['electron', '.'], {
    stdio: 'inherit',
    env: electronEnvironment,
    shell: useWindowsCommandShell,
  });
  electron.once('exit', (code) => shutdown(code ?? 0));
} catch (error) {
  console.error('[Echo Report]', error instanceof Error ? error.message : error);
  shutdown(1);
}

process.on('SIGINT', () => shutdown());
process.on('SIGTERM', () => shutdown());
