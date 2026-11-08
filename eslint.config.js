import js from '@eslint/js'
import globals from 'globals'
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
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      'no-unused-vars': [
        'error',
        {
          varsIgnorePattern: '^[A-Z_]',
          // Core no-unused-vars doesn't count <Icon /> as a use of Icon, so a
          // component prop renamed for JSX ({ icon: Icon }) reads as unused.
          // Temporary: #93 adds JSX-aware checking and removes this.
          argsIgnorePattern: '^[A-Z]',
          // `const { id, ...rest } = values` is the idiom for omitting keys.
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  prettier,
]
