import { chromium } from '@playwright/test';
const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.goto('http://localhost:8321/static-live/cp-cloud_om_CP-AM-DRILL_01.html');
await page.waitForTimeout(5000);
const info = await page.evaluate(() => {
  const scene = document.querySelector('a-scene');
  const canvas = scene.canvas;
  const sr = scene.getBoundingClientRect();
  const cr = canvas.getBoundingClientRect();
  return {
    sceneRect: [sr.x, sr.y, sr.width, sr.height].map(Math.round),
    canvasRect: [cr.x, cr.y, cr.width, cr.height].map(Math.round),
    sceneStyleAttr: scene.getAttribute('style'),
    canvasStyleAttr: canvas.getAttribute('style'),
    sceneComputedH: getComputedStyle(scene).height,
    bodyH: getComputedStyle(document.body).height,
    htmlH: getComputedStyle(document.documentElement).height,
  };
});
console.log(JSON.stringify(info, null, 1));
await browser.close();
