// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: '.',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  globalSetup: './global-setup.js',
  use: {
    baseURL: 'http://localhost:8321',
    trace: 'on-first-retry',
    launchOptions: {
      // Fake webcam for AR scenes; software WebGL for headless A-Frame
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--enable-unsafe-swiftshader',
      ],
    },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  // Serve the repository root as a static site (same layout GitHub Pages serves)
  webServer: {
    command: 'node static-server.js',
    port: 8321,
    reuseExistingServer: !process.env.CI,
  },
});
