import { resolve } from 'path'
import { defineConfig } from 'vite'

import pkg from './package.json'

const banner = `/*!
 * thefittingroom v${pkg.version} (${new Date().toISOString()})
 * Copyright 2022-present, TheFittingRoom, Inc. All rights reserved.
 */`

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'TheFittingRoom',
      formats: ['es'],
      fileName: 'index',
    },
    sourcemap: true,
    rollupOptions: {
      output: {
        banner,
      },
    },
  },
})
