import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => ({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/*.test.ts']
        }
      },
      {
        test: {
          name: 'live',
          include: ['tests/live/*.test.ts'],
          // Credentials for the real cloud come from .env (see .env.example)
          env: loadEnv(mode, process.cwd(), 'DAICHI_'),
          testTimeout: 30_000
        }
      }
    ]
  }
}))
