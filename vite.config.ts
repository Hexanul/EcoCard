import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Relative asset paths so the production build also loads from file://
  // inside the packaged Electron window (loadFile of dist/index.html).
  base: './',
  plugins: [react()],
})
