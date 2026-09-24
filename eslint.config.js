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
    },
  },
  {
    files: ['src/domain/**/*.ts', 'src/shared/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          // Type-only db contracts (Transaction/Executor) are how ports stay
          // decoupled; runtime db access is still banned (matches architecture.test.ts).
          paths: [
            {
              name: 'discord.js',
              message: 'domain/shared-kernel must not depend on discord.js — keep it in presentation.',
            },
            {
              name: 'drizzle-orm',
              message: 'domain/shared-kernel must not depend on drizzle-orm — keep it in infrastructure.',
            },
          ],
          patterns: [
            {
              group: ['**/db/*'],
              allowTypeImports: true,
              message: 'domain/shared-kernel must not import src/db — depend on ports instead.',
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
    // Presentation stays thin: no direct SQL from commands/menu/render.
    files: ['src/commands/**/*.ts', 'src/menu/**/*.ts', 'src/render/**/*.ts'],
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
