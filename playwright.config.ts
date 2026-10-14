import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure', ...devices['Desktop Chrome'] },
  webServer: { command: process.env.FLOW_TEST_PREVIEW ? 'npm run preview' : 'npm run dev', url: 'http://localhost:4173', reuseExistingServer: false },
})
