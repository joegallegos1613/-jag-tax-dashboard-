// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'url'

// Detect if the build is running on Vercel (they set VERCEL=1)
const isVercel = process.env.VERCEL === '1'

// Base path:
// - On GitHub Pages → "/-jag-tax-dashboard-/"
// - On Vercel → "/"
export default defineConfig({
  base: isVercel ? '/' : '/-jag-tax-dashboard-/',
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
