import { chromium } from '@playwright/test';
const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
for (const url of ['static-html/marker_free.html', 'static-live/cp-cloud_om_CP-AM-DRILL_01.html']) {
  await page.goto('http://localhost:8321/' + url);
  await page.waitForTimeout(4000);
  const info = await page.evaluate(() => {
    const scene = document.querySelector('a-scene');
    const canvas = scene.canvas;
    const sr = scene.getBoundingClientRect();
    const cr = canvas.getBoundingClientRect();
    return {
      sceneRect: [sr.x, sr.y, sr.width, sr.height].map(Math.round),
      canvasRect: [cr.x, cr.y, cr.width, cr.height].map(Math.round),
      canvasZ: getComputedStyle(canvas).zIndex,
      canvasPos: getComputedStyle(canvas).position,
      videoCount: document.querySelectorAll('video').length,
    };
  });
  console.log(url, JSON.stringify(info));
}
await browser.close();
