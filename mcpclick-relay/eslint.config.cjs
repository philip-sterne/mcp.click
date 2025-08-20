const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const prettierPlugin = require('eslint-plugin-prettier');
const prettierConfig = require('eslint-config-prettier');

module.exports = [
  // Global ignores
  {
    ignores: ['dist/', 'node_modules/'],
  },

  // Base configs
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Prettier config must be last
  prettierConfig,

  // Custom configuration for Prettier rule
  {
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      'prettier/prettier': 'error',
    },
  },
];
