import { defineConfig } from 'eslint/config'
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

// defineConfig() is ESLint core's successor to the deprecated tseslint.config()
// helper. Using it directly removes the @typescript-eslint/no-deprecated warning
// that fires on tseslint.config() in typescript-eslint ≥ 8.x.
export default defineConfig([
  {
    ignores: ['dist', 'node_modules', '.claude/worktrees/**'],
  },
  {
    // react-hooks v7 ships its own flat config; extending it replaces the
    // manual plugins+rules registration (whose plugin object no longer
    // satisfies ESLint 10's Plugin type).
    extends: [
      js.configs.recommended,
      ...tseslint.configs.strictTypeChecked,
      reactHooks.configs.flat.recommended,
    ],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-refresh': reactRefresh,
    },
    rules: {
      // Warn when exporting non-components from .tsx files (HMR requirement)
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // `any` is forbidden — use `unknown` and narrow with Zod or type guards
      '@typescript-eslint/no-explicit-any': 'error',
      // Consistent type-only imports signal to bundlers what to tree-shake
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      // Prefer `unknown` over `any` in catch clauses
      '@typescript-eslint/use-unknown-in-catch-callback-variable': 'error',
      // Floating promises in event handlers or useEffect are a common bug source
      '@typescript-eslint/no-floating-promises': 'error',
      // Allow unused function parameters prefixed with _ (convention for intentionally
      // unused params, e.g. required lifecycle method signatures like getDerivedStateFromError).
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
])
