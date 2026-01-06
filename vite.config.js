import { execSync } from 'node:child_process'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'
import packageJson from './package.json'

const BUILD_COMMIT_HASH = execSync('git rev-parse --short HEAD').toString().trim()

export default defineConfig(() => {
  return {
    build: {
      lib: {
        entry: resolve('src/index.tsx'),
        fileName: 'index',
        formats: ['es'],
      },
      minify: false,
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
      'process.env.BUILD_VERSION': JSON.stringify(packageJson.version),
      'process.env.BUILD_COMMIT_HASH': JSON.stringify(BUILD_COMMIT_HASH),
      'process.env.BUILD_DATE': JSON.stringify(new Date().toISOString()),
    },
    plugins: [
      react({
        jsxImportSource: '@emotion/react',
        babel: {
          plugins: ['@emotion/babel-plugin'],
        },
      }),
      svgr(),
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
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
})
