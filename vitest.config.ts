import { resolve } from 'path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src'),
      '@shared': resolve('src/shared')
    }
  },
  test: {
    // Default environment is 'node' (for main-process tests); renderer test
    // files opt into jsdom individually via a `// @vitest-environment jsdom` comment.
    environment: 'node',
    setupFiles: ['./src/renderer/src/test-setup.ts'],
    exclude: ['node_modules', 'dist', 'out']
  }
})
