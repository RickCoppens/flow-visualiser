import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { test, expect } from '@playwright/test'

const execute = promisify(execFile)
test('development en preview weigeren een bezette vaste poort', async () => {
  for (const args of [[], ['preview']]) {
    await expect(execute(process.execPath, ['node_modules\\vite\\bin\\vite.js', ...args], { timeout: 15000 }))
      .rejects.toThrow('Port 4173 is already in use')
  }
})
