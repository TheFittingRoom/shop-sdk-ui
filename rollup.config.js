import { defineConfig } from 'rollup';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import postcss from 'rollup-plugin-postcss';

import { defineConfig } from 'rollup'
import dotenv from 'rollup-plugin-dotenv'
import postcss from 'rollup-plugin-postcss'

import pkg from './package.json' with { type: 'json' }

const banner = `/*!
* thefittingroom v${pkg.version} (${new Date().toISOString()})
* Copyright 2022-present, TheFittingRoom, Inc. All rights reserved.
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
    postcss({
      minimize: true,
      extract: false,
    }),
    nodeResolve(),
    typescript({
      sourceMap: true,
      inlineSources: true,
      tsconfig: './tsconfig.json',
      outDir: './dist/esm',
      declaration: false,
    }),
  ],
})
