import { resolve } from 'path'
import { defineConfig } from 'vite'

import pkg from './package.json'

const banner = `/*!
 * thefittingroom v${pkg.version} (${new Date().toISOString()})
 * Copyright 2022-present, TheFittingRoom, Inc. All rights reserved.
 */`

export default defineConfig(({ mode }) => ({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'TheFittingRoom',
      formats: ['es'],
      fileName: 'index',
    },
    sourcemap: false,
    minify: mode === 'production' ? 'esbuild' : false,
    rollupOptions: {
      output: {
        banner,
      },
    },
  },
  css: {
    devSourcemap: true,
  },
}))
