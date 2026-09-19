import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // `tests/e2e/*.spec.ts` là Playwright — vitest nuốt nhầm sẽ làm cả bộ test
    // đỏ với "no tests" (đúng lỗi đang có). Giới hạn rõ phạm vi của từng bộ:
    //   vitest  → src/**/*.test.ts      (hàm thuần, chạy không cần DB)
    //   playwright → tests/e2e/*.spec.ts (`pnpm test:e2e`)
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules/**', '.next/**', 'tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: ['node_modules/', '.next/', 'tests/', '*.config.*'],
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
