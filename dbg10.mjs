import { chromium } from '@playwright/test';
const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.goto('http://localhost:8321/static-live/cp-cloud_om_CP-AM-DRILL_01.html');
await page.waitForTimeout(8000);
await page.locator('.mf-slider').click();
await page.waitForTimeout(1000);
const dump = await page.evaluate(() => {
  const out = [];
  document.querySelector('a-scene').object3D.traverse((o) => {
    if (!o.isMesh) return;
    let p = o, vis = true;
    while (p) { if (p.visible === false) { vis = false; break; } p = p.parent; }
    if (!vis) return;
    const m = o.material;
    out.push({
      geo: o.geometry.type,
      matType: m.type,
      color: m.color && m.color.getHexString(),
      hasMap: !!m.map,
      mapImg: m.map ? (m.map.image ? (m.map.image.tagName + ' ' + (m.map.image.naturalWidth ?? m.map.image.width) + 'x' + (m.map.image.naturalHeight ?? m.map.image.height) + ' complete:' + m.map.image.complete) : 'NO-IMAGE') : null,
      el: o.el ? o.el.tagName : null,
    });
  });
  return out;
});
console.log(JSON.stringify(dump, null, 1));
await browser.close();
