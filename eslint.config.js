import eslintConfigPrettier from 'eslint-config-prettier';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import typescriptEslint from 'typescript-eslint';

export default typescriptEslint.config(
  // Global ignores
  {
    ignores: ['node_modules/', 'dist/', 'coverage/', '*.config.*', '.husky/'],
  },

  // Base recommended config
  ...typescriptEslint.configs.recommended,

  // TypeScript rules
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      '@typescript-eslint/array-type': ['error', { default: 'array-simple' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-member-accessibility': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
    },
  },

  // Import sorting
  {
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      'simple-import-sort/imports': [
        'error',
        {
          groups: [
            // Node.js builtins
            ['^node:'],
            // Third-party packages
            ['^@?\\w'],
            // Internal absolute imports (@/...)
            ['^@/'],
            // Relative imports (../, ./)
            ['^\\.\\./', '^\\./'],
            // Side-effect imports
            ['^\\u0000'],
          ],
        },
      ],
      'simple-import-sort/exports': 'error',
    },
  },

  // Prettier integration — disables ESLint rules that conflict with Prettier
  eslintConfigPrettier
);
