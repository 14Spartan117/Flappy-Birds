// ESLint flat config. eslint-plugin-html lints the inline <script> blocks in the HTML
// pages too, which is where most of the game code lives (index.html).
const js = require('@eslint/js');
const globals = require('globals');
const html = require('eslint-plugin-html');

module.exports = [
  { ignores: ['node_modules/**', 'test-results/**'] },
  js.configs.recommended,
  {
    rules: {
      // `catch (e) {}` is used deliberately to ignore storage failures.
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-unused-vars': ['error', { caughtErrors: 'none' }]
    }
  },
  {
    // Browser code: the game modules and the pages' inline scripts.
    files: ['**/*.html', 'src/**/*.js'],
    plugins: { html },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      // `module` is only touched behind a `typeof module` check, for Node tests.
      globals: { ...globals.browser, module: 'readonly' }
    }
  },
  {
    // Node code: tests and this config. The e2e tests also pass functions to the
    // browser (page.evaluate), so browser globals are allowed there.
    files: ['tests/**/*.js', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node }
    }
  },
  {
    files: ['tests/e2e/**/*.js'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser }
    }
  }
];
