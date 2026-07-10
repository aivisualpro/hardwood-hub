import antfu from '@antfu/eslint-config'
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(antfu(
  {
    // ── Global ignores ──────────────────────────────────────────────────────
    ignores: [
      'scratch*.{js,mjs,ts,cjs}',
      'test_*.{js,mjs,ts,cjs}',
      'test-*.{js,ts}',
      'inspect*.{js,ts,cjs}',
      'check_*.{js,ts}',
      'find_*.ts',
      'query_*.js',
      'simulate_*.{js,ts}',
      'migrate-*.{js,ts}',
      'scripts/',
      'public/sw.js',
      'server/scripts/',
    ],

    rules: {
      'style/no-trailing-spaces': ['error', { ignoreComments: true }],
      'style/max-statements-per-line': ['error', { max: 3 }],
      // Vue script setup: composables/helpers often declared after first use
      'ts/no-use-before-define': 'off',
      // Keep kebab-case custom event names (existing convention throughout app)
      'vue/custom-event-name-casing': 'off',
      // Node globals (process, Buffer) are fine in server code and Nuxt config
      'node/prefer-global/process': 'off',
      'node/prefer-global/buffer': 'off',
      // @ts-ignore is sometimes necessary for third-party type gaps
      'ts/ban-ts-comment': 'off',
      // Regex literals vs RegExp constructor — stylistic, not a bug
      'prefer-regex-literals': 'off',
      // Vue reactivity: unused destructured vars from composables are common
      // (e.g. const { loading, setLoading } = useX() — only setLoading used)
      'unused-imports/no-unused-vars': ['warn', {
        vars: 'all',
        varsIgnorePattern: '^_',
        args: 'after-used',
        argsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],
      'vue/no-unused-vars': 'warn',
      // ts/no-unused-expressions — common in Vue event handler chains
      'ts/no-unused-expressions': 'warn',
      // isNaN → Number.isNaN — good practice, already fixed in server code
      'unicorn/prefer-number-properties': ['warn', { checkNaN: true }],
    },
  },
  {
    files: ['**/*.md'],
    rules: { 'style/no-trailing-spaces': 'off' },
  },
  // Server utilities and plugins may use console.* intentionally
  {
    files: ['server/**/*.ts', 'app/utils/logger.ts', 'app/plugins/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
))
