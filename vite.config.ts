import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves project sites under /<repo>/, so the production build
// needs that base. Dev stays at '/'.
const REPO = 'installation_screen_multitool'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  base: command === 'build' ? `/${REPO}/` : '/',
  plugins: [react()],
}))
