// @ts-check
// Live verification against https://festodidacticsw.azurewebsites.net/ :
// every published XML is downloaded fresh (Node-side fetch — the server sends
// no CORS headers), transformed with xsltproc, booted in the browser and
// checked for correctly displayed objects (pixel-diff via the marker-free
// toggle for marker scenes).
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { PNG } = require('pngjs');

const BASE = 'https://festodidacticsw.azurewebsites.net/ar/';
const CP_STATIONS = ['CP-AM-CAM-V2_01', 'CP-AM-CAM_01', 'CP-AM-DRILL_01', 'CP-AM-iDRILL_01',
  'CP-AM-iPICK_01', 'CP-AM-LABEL-V2_01', 'CP-AM-LABEL-V3_01', 'CP-AM-LABEL_01', 'CP-AM-MAG_01',
  'CP-AM-MEASURE-V2_01', 'CP-AM-MEASURE_01', 'CP-AM-MPRESS-V2_01', 'CP-AM-MPRESS_01',
  'CP-AM-OUT_01', 'CP-AM-OVEN_01', 'CP-AM-PRESS_01', 'CP-AM-TURNOVER_01'];

/** name -> { url, kind: 'scene' | 'catalog' } */
const TARGETS = {};
TARGETS['mps400_MPS400'] = { url: BASE + 'MPS400/MPS400.xml', kind: 'catalog' };
TARGETS['mps400_Sorting_01'] = { url: BASE + 'MPS400/Sorting_01.xml', kind: 'scene' };
TARGETS['mps_en_index'] = { url: BASE + 'mps/MPS%20[EN]/index.xml', kind: 'scene' };
TARGETS['cp-cloud_om_index'] = { url: BASE + 'cp-cloud_om/index.xml', kind: 'catalog' };
for (const s of CP_STATIONS) {
  TARGETS['cp-cloud_om_' + s] = { url: BASE + 'cp-cloud_om/' + s + '.xml', kind: 'scene' };
  TARGETS['cp-cloud_nm_' + s] = { url: BASE + 'cp-cloud_nm/' + s + '.xml', kind: 'scene' };
}
TARGETS['cp-cloud_nm_CP-AM-DISPENSE_01'] = { url: BASE + 'cp-cloud_nm/CP-AM-DISPENSE_01.xml', kind: 'scene' };

const OUT_DIR = path.resolve(__dirname, '..', 'static-live');

async function download(url, retries = 3) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      const r = await fetch(url, { redirect: 'follow' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.text();
    } catch (e) {
      lastErr = e;
      await new Promise((res) => setTimeout(res, 2000));
    }
  }
  throw new Error(`${url}: ${lastErr}`);
}

test.describe('festodidacticsw.azurewebsites.net live XMLs', () => {
  test.describe.configure({ mode: 'serial' });

  test('all published XMLs download, parse and transform', async () => {
    test.slow();
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const failures = [];
    for (const [name, target] of Object.entries(TARGETS)) {
      try {
        const xml = await download(target.url);
        if (!/<(AUGMENTATION|COMPILATION|DIRECTORY|PACK)[\s>]/.test(xml)) {
          throw new Error('response is not an FDAR document');
        }
        const xmlPath = path.join(OUT_DIR, name + '.xml');
        fs.writeFileSync(xmlPath, xml);
        let html = execFileSync('xsltproc',
          [path.resolve(__dirname, '..', 'aframe.xsl'), xmlPath],
          { maxBuffer: 64 * 1024 * 1024 }).toString();
        html = html
          .replace('https://aframe.io/releases/1.7.1/aframe.min.js', '/vendor/aframe.min.js')
          .replace('https://raw.githack.com/AR-js-org/AR.js/master/aframe/build/aframe-ar.js', '/vendor/aframe-ar.js');
        fs.writeFileSync(path.join(OUT_DIR, name + '.html'), html);
      } catch (e) {
        failures.push(`${name}: ${e.message}`);
      }
    }
    expect(failures, failures.join('\n')).toEqual([]);
    expect(fs.readdirSync(OUT_DIR).filter((f) => f.endsWith('.html')).length)
      .toBe(Object.keys(TARGETS).length);
  });

  test('every live XML renders its objects in the browser', async ({ page }) => {
    test.slow();
    test.setTimeout(15 * 60_000);
    const failures = [];

    for (const [name, target] of Object.entries(TARGETS)) {
      const htmlPath = path.join(OUT_DIR, name + '.html');
      if (!fs.existsSync(htmlPath)) { failures.push(`${name}: not generated`); continue; }
      try {
        await page.goto('/static-live/' + name + '.html', { waitUntil: 'domcontentloaded' });
        if (target.kind === 'catalog') {
          await expect(page.locator('a.entry').first()).toBeVisible({ timeout: 20_000 });
          continue;
        }
        await expect(page.locator('a-scene')).toBeAttached({ timeout: 20_000 });
        // The scene must initialize (components running, entities populated)
        await expect.poll(() => page.evaluate(() => {
          const s = /** @type {any} */ (document.querySelector('a-scene'));
          return !!(s && s.object3D) && document.querySelectorAll('a-entity, a-text, a-image, a-video').length;
        }), { timeout: 30_000 }).toBeGreaterThan(3);

        const toggle = await page.locator('#marker-free-toggle').count();
        if (toggle) {
          // Pixel proof through the marker-free toggle: the scene's objects
          // must actually appear on screen when forced visible
          await page.evaluate(() => {
            document.querySelectorAll('video').forEach((v) => { v.style.display = 'none'; });
            document.body.style.background = '#000';
          });
          await page.waitForTimeout(400);
          const before = PNG.sync.read(await page.screenshot());
          await page.locator('.mf-slider').click();
          await page.waitForTimeout(900);
          const after = PNG.sync.read(await page.screenshot());
          const changed = diffRatio(before, after);
          if (changed < 0.002) throw new Error(`no visible objects after marker-free toggle (diff ${(changed * 100).toFixed(3)}%)`);
        }
      } catch (e) {
        failures.push(`${name}: ${String(e.message).split('\n')[0]}`);
      }
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });
});

/** Fraction of pixels that differ noticeably between two same-size PNGs. */
function diffRatio(a, b) {
  if (a.width !== b.width || a.height !== b.height) return 1;
  let diff = 0;
  const total = a.width * a.height;
  for (let i = 0; i < total * 4; i += 4) {
    if (Math.abs(a.data[i] - b.data[i]) > 24 ||
        Math.abs(a.data[i + 1] - b.data[i + 1]) > 24 ||
        Math.abs(a.data[i + 2] - b.data[i + 2]) > 24) diff++;
  }
  return diff / total;
}
