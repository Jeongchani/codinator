// @ts-check

import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';

export default defineConfig(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.turbo/**',
      '**/.expo/**',
      '**/.next/**',
      '**/android/**',
      '**/ios/**',
      '**/.venv/**',
      '**/__pycache__/**',
      'apps/ai/**',
      'storage/**',
    ],
  },

  js.configs.recommended,
  tseslint.configs.recommended,

  // TypeScript 공통
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },

  // Node 환경 파일
  {
    files: [
    'eslint.config.mjs',
    '**/*.{config.js,config.cjs,config.mjs,config.ts}',
    'apps/api/**/*.{js,cjs,mjs,ts}',
    'packages/contracts/**/*.{js,cjs,mjs,ts}',
  ],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  // React(Web/Mobile) 공통
  {
    files: ['apps/web/**/*.{ts,tsx}', 'apps/mobile/**/*.{ts,tsx}'],
    ...reactPlugin.configs.flat.recommended,
    languageOptions: {
      ...reactPlugin.configs.flat.recommended.languageOptions,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      ...reactPlugin.configs.flat.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
    },
  },

  // React 17+ JSX runtime
  {
    files: ['apps/web/**/*.{ts,tsx}', 'apps/mobile/**/*.{ts,tsx}'],
    ...reactPlugin.configs.flat['jsx-runtime'],
  },

  // React Hooks
  {
    files: ['apps/web/**/*.{ts,tsx}', 'apps/mobile/**/*.{ts,tsx}'],
    ...reactHooks.configs.flat.recommended,
  },

  // 브라우저 전역은 web만
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },

  // Prettier와 충돌하는 formatting rule 비활성화
  prettierConfig,
);