import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Content-Security-Policy for the packaged app only: the Vite dev server
// injects inline scripts (React Refresh) that a strict policy would block.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ')

function contentSecurityPolicy(): Plugin {
  return {
    name: 'echo-report-csp',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY },
        injectTo: 'head-prepend',
      },
    ],
  }
}

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

// https://vite.dev/config/
export default defineConfig({
  // Relative asset paths so the production build also loads from file://
  // inside the packaged Electron window (loadFile of dist/index.html).
  base: './',
  plugins: [react(), contentSecurityPolicy()],
  // Shown in the About dialog so a doctor can tell which build they run.
  define: { __APP_VERSION__: JSON.stringify(version) },
})
