import { chromium } from '@playwright/test';
import fs from 'node:fs';
const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.goto('http://localhost:8321/static-live/cp-cloud_om_CP-AM-DRILL_01.html');
await page.waitForTimeout(5000);
await page.locator('.mf-slider').click();
await page.waitForTimeout(1200);
const dataUrl = await page.evaluate(() => {
  const scene = document.querySelector('a-scene');
  const comp = scene.components.screenshot;
  if (!comp) return 'NO-SCREENSHOT-COMPONENT';
  try {
    const canvas = comp.getCanvas('perspective');
    return canvas.toDataURL('image/png');
  } catch (e) { return 'ERR: ' + e.message; }
});
if (dataUrl.startsWith('data:')) {
  fs.writeFileSync('/tmp/aframe_view.png', Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log('aframe screenshot saved');
} else console.log(dataUrl);
const draws = await page.evaluate(() => {
  const scene = document.querySelector('a-scene');
  const out = [];
  scene.object3D.traverse((o) => {
    if (o.isMesh) {
      let p = o, vis = true;
      while (p) { if (p.visible === false) { vis = false; break; } p = p.parent; }
      if (vis) out.push((o.geometry && o.geometry.type) + '@' + (o.material && o.material.color ? o.material.color.getHexString() : '?'));
    }
  });
  return out;
});
console.log('visible meshes:', JSON.stringify(draws));
await browser.close();
