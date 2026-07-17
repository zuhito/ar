import { chromium } from '@playwright/test';
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.goto('http://localhost:8321/static-html/viewer_local.html');
await page.waitForTimeout(2500);
await page.evaluate(() => { document.body.style.background = '#000'; });
await page.screenshot({ path: '/tmp/viewer_now.png' });
await browser.close();
