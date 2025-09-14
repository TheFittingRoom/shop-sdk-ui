import alias from '@rollup/plugin-alias'
import commonjs from '@rollup/plugin-commonjs'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import terser from '@rollup/plugin-terser'

import path from 'path'
import { defineConfig } from 'rollup'
import dotenv from 'rollup-plugin-dotenv'
import esbuild from 'rollup-plugin-esbuild'
import postcss from 'rollup-plugin-postcss'
import { fileURLToPath } from 'url'

import pkg from './package.json' with { type: 'json' }

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const banner = `/*!
* thefittingroom v${pkg.version} (${new Date().toISOString()})
* Copyright 2025-present, TheFittingRoom, Inc. All rights reserved.
*/`

export default defineConfig({
  input: 'src/index.ts',
  output: [
    {
      file: `dist/esm/index.js`,
      format: 'esm',
      sourcemap: true,
      banner,
    },
    {
      file: `dist/esm/index.min.js`,
      format: 'esm',
      sourcemap: true,
      banner,
      plugins: [terser()],
    },
  ],
  plugins: [
    dotenv(),
    alias({
      entries: [
        { find: '@components', replacement: path.resolve(__dirname, 'src/components') },
        { find: '@atoms', replacement: path.resolve(__dirname, 'src/components/atoms') },
        { find: '@molecules', replacement: path.resolve(__dirname, 'src/components/molecules') },
        { find: '@contexts', replacement: path.resolve(__dirname, 'src/contexts') },
        { find: '@hooks', replacement: path.resolve(__dirname, 'src/hooks') },
        { find: '@state', replacement: path.resolve(__dirname, 'src/state') },
        { find: '@locale', replacement: path.resolve(__dirname, 'src/components/locale') },
        { find: '@types', replacement: path.resolve(__dirname, 'src/types') },
      ],
    }),
    esbuild({
      include: /\.[jt]sx?$/,
      exclude: /node_modules/,
      target: 'es2017',
      jsx: 'transform',
      jsxFactory: 'jsx',
      jsxFragment: 'Fragment',
      sourceMap: true,
      tsconfig: './tsconfig.json',
    }),
    commonjs(),
    postcss({
      minimize: true,
      extract: false,
    }),
    nodeResolve({
      extensions: ['.js', '.jsx', '.ts', '.tsx'],
    }),
  ],
})
