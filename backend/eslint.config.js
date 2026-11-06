const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  { ignores: ['node_modules/**'] },
  { files: ['**/*.mjs'], languageOptions: { sourceType: 'module' } },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: { ...globals.node }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_|^next$', caughtErrors: 'none' }]
    }
  },
  {
    files: ['**/*.test.js', 'tests/**/*.js'],
    languageOptions: { sourceType: 'module', globals: { ...globals.node, ...globals.vitest } }
  }
];
