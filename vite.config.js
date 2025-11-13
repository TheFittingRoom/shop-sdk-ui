import { resolve } from 'path'
import { defineConfig } from 'vite'

import pkg from './package.json'

const banner = `/*!
 * thefittingroom v${pkg.version} (${new Date().toISOString()})
 * Copyright 2022-present, TheFittingRoom, Inc. All rights reserved.
 */`

export default defineConfig(({ mode }) => ({
  server: {
    port: 5173,
    host: true,
    cors: true,
    mimeTypes: {
      'application/javascript': ['js'],
      'text/javascript': ['js'],
      'module': ['js'],
    },
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization',
      'Content-Type': 'application/javascript; charset=utf-8',
    },
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'TheFittingRoom',
      formats: ['es'], // ESM module format
      fileName: 'index',
    },
    sourcemap: mode !== 'production',
    minify: mode === 'production' ? 'esbuild' : false,
    rollupOptions: {
      external: [], // Keep all dependencies bundled for library use
      output: {
        banner,
      },
    },
  },
  css: {
    devSourcemap: true,
  },
}))
