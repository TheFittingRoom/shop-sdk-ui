import { nodeResolve } from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'

import dotenv from 'rollup-plugin-dotenv'
import styles from 'rollup-plugin-styles'
import { terser } from 'rollup-plugin-terser'

import pkg from './package.json'

const banner = `/*!
* thefittingroom v${pkg.version} (${new Date().toISOString()})
* Copyright 2022-present, TheFittingRoom, Inc. All rights reserved.
*/`

export default {
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
    styles({
      minimize: true,
    }),
    nodeResolve(),
    typescript(),
  ],
}
