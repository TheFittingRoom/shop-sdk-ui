import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    // dist/build are outputs; src/api/gen is tygo-generated (intentional `any`).
    ignores: ['dist', 'build', 'node_modules', 'src/api/gen'],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended, react.configs.flat.recommended],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        // Type-aware linting (needed for no-floating-promises).
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      // --- React ---
      'react/react-in-jsx-scope': 'off', // new JSX transform — React import not needed
      'react/prop-types': 'off', // props are typed with TypeScript
      // Emotion's `css` prop is not a standard DOM attribute.
      'react/no-unknown-property': ['error', { ignore: ['css'] }],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // --- TypeScript strictness ---
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // --- General ---
      eqeqeq: ['error', 'always', { null: 'ignore' }], // === except `== null`
      'no-console': 'warn',
    },
  },
  {
    // The logger is the one place raw console access is intentional.
    files: ['src/lib/logger.ts'],
    rules: { 'no-console': 'off' },
  },
  prettier,
)
