import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', 'data/', '*.config.ts'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    // Phase 1 DI hardening: the menuRouter global is gone (MenuRouter comes
    // from createAppContainer). Ban the module path so it cannot come back.
    files: ['src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/menu/menuRuntime*'],
              message: 'menuRuntime global was removed — inject MenuRouter via createAppContainer instead.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/modules/*/domain/**/*.ts', 'src/shared/kernel/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'discord.js',
              message: 'domain/kernel must not depend on discord.js — keep it in presentation.',
            },
            {
              name: 'drizzle-orm',
              message: 'domain/kernel must not depend on drizzle-orm — keep it in infrastructure.',
            },
          ],
          patterns: [
            {
              group: ['**/db/*'],
              allowTypeImports: true,
              message: 'domain/kernel must not import src/db — depend on ports instead.',
            },
          ],
        },
      ],
    },
  },
  {
    // Discord adapter layer: the only shared scope allowed to touch discord.js.
    files: ['src/shared/discord/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'drizzle-orm',
              message: 'shared/discord must not depend on drizzle-orm — keep it in infrastructure.',
            },
          ],
          patterns: [
            {
              group: ['**/db/*'],
              message: 'shared/discord must not import src/db — depend on ports instead.',
            },
          ],
        },
      ],
    },
  },
  {
    // Support scopes (ui/utils/config): discord.js allowed for builders and
    // webhook delivery; no drizzle or runtime db access (type-only db ok).
    files: ['src/shared/ui/**/*.ts', 'src/shared/utils/**/*.ts', 'src/shared/config/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'drizzle-orm',
              message: 'shared support code must not depend on drizzle-orm — keep it in modules/*/infrastructure.',
            },
          ],
          patterns: [
            {
              group: ['**/db/*'],
              allowTypeImports: true,
              message: 'shared support code must not access src/db at runtime.',
            },
          ],
        },
      ],
    },
  },
  {
    // Cross-module progress wiring: may use db defaults like the container.
    files: ['src/shared/progress/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'discord.js',
              message: 'shared/progress must not depend on discord.js — keep it in presentation.',
            },
            {
              name: 'drizzle-orm',
              message: 'shared/progress must not depend on drizzle-orm — keep it in modules/*/infrastructure.',
            },
          ],
        },
      ],
    },
  },
  {
    // Presentation stays thin: no direct SQL from module presentation layers.
    files: ['src/modules/*/presentation/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'drizzle-orm',
              message: 'presentation must not query drizzle directly — call an application use-case.',
            },
          ],
          patterns: [
            { group: ['**/db/client*'], message: 'presentation must not import db client — call an application use-case.' },
            { group: ['**/db/schema*'], message: 'presentation must not import db schema — call an application use-case.' },
          ],
        },
      ],
    },
  },
);
