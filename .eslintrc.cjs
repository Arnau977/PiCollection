module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
    '@electron-toolkit/eslint-config-ts/recommended',
    '@electron-toolkit/eslint-config-prettier'
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: ['./tsconfig.json', './tsconfig.node.json', './tsconfig.web.json']
  },
  plugins: ['react-refresh'],
  settings: {
    react: { version: 'detect' }
  },
  rules: {
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    'no-use-before-define': 0,
    // The base rule can't parse TS-only constructs (e.g. a callback param name
    // in an interface's function-type signature) and false-positives on them;
    // the TS-aware rule below handles JS and TS correctly, so this stays off.
    'no-unused-vars': 0,
    'react/prop-types': 1,
    'no-debugger': 1,
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
    ]
  },
  overrides: [
    {
      // Kysely migrations use `Kysely<any>` by convention (schema shape isn't known ahead of migration).
      files: ['src/main/database/migrations/*.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off'
      }
    },
    {
      // Test helper/render-wrapper functions don't need explicit return types.
      files: ['**/*.test.ts', '**/*.test.tsx'],
      rules: {
        '@typescript-eslint/explicit-function-return-type': 'off'
      }
    }
  ]
}
