import { defineConfig } from 'tsdown'

/** Host-only package: the branch pill lives in @deepseek-ai/dsh-client-ui-git-branch. */
export default defineConfig({
  entry: ['lib/types/index.js'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: false,
})
