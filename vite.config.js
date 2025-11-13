import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig(({ mode, command }) => {
  // For dev server, we don't want the library build configuration interfering
  if (command === 'serve') { // dev mode
    return {
      server: {
        port: 5173,
        host: true,
        cors: true,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
          'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization',
        },
      },
      css: {
        devSourcemap: true,
      },
    }
  } else { // build mode
    return {
      build: {
        lib: {
          entry: resolve(__dirname, 'src/index.ts'),
          name: 'TheFittingRoom',
          fileName: 'index',
        },
        sourcemap: mode !== 'production',
        minify: mode === 'production' ? 'esbuild' : false,
      },
      server: {
        port: 5173,
        host: true,
        cors: true,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
          'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization',
        },
      },
      css: {
        devSourcemap: true,
      },
    }
  }
})
