import { chromium } from '@playwright/test';
const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.goto('http://localhost:8321/static-live/cp-cloud_om_CP-AM-DRILL_01.html');
await page.waitForTimeout(6000);
await page.locator('.mf-slider').click();
await page.waitForTimeout(1500);
await page.screenshot({ path: '/tmp/cp_toggle4.png' });
await browser.close();
