import { chromium } from '@playwright/test';
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[browser]', m.text().slice(0, 160)); });
await page.goto('http://localhost:8321/viewer_repro.html');
const t0 = Date.now();
let mapAt = null;
for (let i = 0; i < 40; i++) {
  const hasMap = await page.evaluate(() => {
    const img = document.querySelector('a-image');
    if (!img || !img.getObject3D) return false;
    const mesh = img.getObject3D('mesh');
    return !!(mesh && mesh.material && mesh.material.map);
  });
  if (hasMap) { mapAt = Date.now() - t0; break; }
  await page.waitForTimeout(250);
}
console.log('texture map appeared after:', mapAt === null ? 'NEVER (10s)' : mapAt + 'ms');
await page.screenshot({ path: '/tmp/viewer_repro.png' });
await browser.close();
