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
    // '.claude' excludes nested git worktrees (e.g. .claude/worktrees/*), which are
    // full separate checkouts with their own node_modules and would otherwise get
    // test-discovered too, causing duplicate-React/module-instance failures.
    exclude: ['node_modules', 'dist', 'out', '.claude']
  }
})
