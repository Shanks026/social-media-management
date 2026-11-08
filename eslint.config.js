import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import prettier from 'eslint-config-prettier'

export default [
  { ignores: ['dist'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // Core no-unused-vars can't see JSX: without this, <Icon /> doesn't
      // count as a use of Icon. It marks JSX identifiers as used, so the
      // rule below needs no capital-letter exemption.
      'react/jsx-uses-vars': 'error',
      // The other half: a component used in JSX but never imported.
      'react/jsx-no-undef': 'error',
      'no-unused-vars': [
        'error',
        {
          varsIgnorePattern: '^_',
          argsIgnorePattern: '^_',
          // `const { id, ...rest } = values` is the idiom for omitting keys.
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  prettier,
]
