import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves project sites under /<repo>/, so a production build for
// Pages needs that base. Netlify (and dev) serve from the root, so use '/'
// there. Netlify sets NETLIFY=true during its builds.
const REPO = 'interactive-installation-multitool'
const isNetlify = process.env.NETLIFY === 'true'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  base: command === 'build' && !isNetlify ? `/${REPO}/` : '/',
  plugins: [react()],
}))
