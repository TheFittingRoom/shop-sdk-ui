import { resolve } from 'path'
import { defineConfig } from 'vite'

const server = {
  port: 5173,
  host: true,
  cors: true,
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization',
  },
}

const lib = {
  lib: {
    entry: resolve('src/index.ts'),
    name: 'TheFittingRoom',
    fileName: 'index',
  },
  minify: false,
}

export default defineConfig(({ mode, command }) => {
  if (command === 'serve') {
    return {
      server: {
        ...server,
        watch: { usePolling: true },
      },
    }
  }

  if (mode === 'production' || process.env.CI) {
    return { build: lib, server }
  }

  return { build: { minify: false }, server }
})
