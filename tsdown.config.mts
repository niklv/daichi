import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['./src/index.ts'],
  format: ['esm', 'cjs'],
  platform: 'node',
  target: 'es2022',
  dts: true,
  // keep tsup's layout: index.js (cjs), index.mjs, index.d.ts, index.d.mts
  fixedExtension: false,
  clean: true
})
