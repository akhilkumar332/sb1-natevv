import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': 'off',
      'react-hooks/exhaustive-deps': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'prefer-const': 'off',
      'no-restricted-syntax': [
        'warn',
        {
          selector: "CallExpression[callee.name='collection'][arguments.0.name='db'][arguments.1.type='Literal'][arguments.1.value=/^[A-Za-z][A-Za-z0-9_]*$/]",
          message: 'Use COLLECTIONS constants from src/constants/firestore.ts instead of raw Firestore collection literals.',
        },
        {
          selector: "CallExpression[callee.name='doc'][arguments.0.name='db'][arguments.1.type='Literal'][arguments.1.value=/^[A-Za-z][A-Za-z0-9_]*$/]",
          message: 'Use COLLECTIONS constants from src/constants/firestore.ts instead of raw Firestore collection literals.',
        },
        {
          selector: "Literal[value='/donor/login'], Literal[value='/ngo/login'], Literal[value='/bloodbank/login'], Literal[value='/admin/login'], Literal[value='/donor/dashboard'], Literal[value='/ngo/dashboard'], Literal[value='/bloodbank/dashboard'], Literal[value='/admin/dashboard']",
          message: 'Use centralized route constants from src/constants/routes.ts.',
        },
      ],
    },
  },
  {
    files: ['src/constants/routes.ts'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  }
);
