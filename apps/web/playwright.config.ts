import { defineConfig, devices } from "@playwright/test";

// Use a dedicated port for e2e so it doesn't collide with any
// concurrently-running dev servers (web defaults to 3000).
const E2E_PORT = process.env.E2E_PORT ? Number(process.env.E2E_PORT) : 3002;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: true,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `next dev --port ${E2E_PORT}`,
    url: `http://localhost:${E2E_PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
