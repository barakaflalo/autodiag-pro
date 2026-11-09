import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// base './' = relative paths, works at autodiag-pro.pages.dev and under any folder
export default defineConfig({ plugins: [react()], base: './', build: { rollupOptions: { output: { assetFileNames: a => /\.mjs$/.test(a.name||'') ? 'assets/[name]-[hash].js' : 'assets/[name]-[hash][extname]' } },
    outDir: 'dist', emptyOutDir: true } })
