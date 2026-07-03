/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Dedupe React so every importer resolves the single hoisted copy. The root
  // `overrides` pin react/react-dom to 19.x across the monorepo, so there is
  // one instance — this guards against any transitive dep re-introducing a
  // second one under Vitest.
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
})
