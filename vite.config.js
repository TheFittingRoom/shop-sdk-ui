import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig(({ mode, command }) => {
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
        watch: {
          usePolling: true,
        }
      },
    }
  } else { // build mode
    if (mode === 'production') {
      return {
        build: {
          lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            name: 'TheFittingRoom',
            fileName: 'index',
          },
          minify: 'esbuild',
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
      }
    } else {
      return {
        build: {
          minify: false,
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
      }
    }
  }
})
