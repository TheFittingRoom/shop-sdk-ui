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
      // --- StandardJS-style best practices (non-formatting) ---
      'no-var': 'error',
      'prefer-const': 'error',
      'no-new-wrappers': 'error',
      'no-new-func': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-throw-literal': 'error',
      'no-return-assign': ['error', 'always'],
      'no-self-compare': 'error',
      'no-sequences': 'error',
      'no-unneeded-ternary': 'error',
      'no-useless-rename': 'error',
      'no-useless-computed-key': 'error',
      'prefer-promise-reject-errors': 'error',
    },
  },
  {
    // The logger is the one place raw console access is intentional.
    files: ['src/lib/logger.ts'],
    rules: { 'no-console': 'off' },
  },
  prettier,
  {
    // eslint-config-prettier turns `curly` off wholesale; re-enable it here,
    // after prettier. `curly: 'all'` doesn't conflict with Prettier —
    // Prettier formats braces but never adds or removes them.
    files: ['src/**/*.{ts,tsx}'],
    rules: { curly: ['error', 'all'] },
  },
)
