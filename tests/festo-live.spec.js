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
const { installNetCache } = require('./net-cache.js');

const BASE = 'https://festodidacticsw.azurewebsites.net/ar/';
const CP_STATIONS = ['CP-AM-CAM-V2_01', 'CP-AM-CAM_01', 'CP-AM-DRILL_01', 'CP-AM-iDRILL_01',
  'CP-AM-iPICK_01', 'CP-AM-LABEL-V2_01', 'CP-AM-LABEL-V3_01', 'CP-AM-LABEL_01', 'CP-AM-MAG_01',
  'CP-AM-MEASURE-V2_01', 'CP-AM-MEASURE_01', 'CP-AM-MPRESS-V2_01', 'CP-AM-MPRESS_01',
  'CP-AM-OUT_01', 'CP-AM-OVEN_01', 'CP-AM-PRESS_01', 'CP-AM-TURNOVER_01'];

/** name -> { url, kind: 'scene' | 'catalog' } */
const TARGETS = {};
TARGETS['mps400_MPS400'] = { url: BASE + 'MPS400/MPS400.xml', kind: 'catalog' };
TARGETS['mps400_Sorting_01'] = { url: BASE + 'MPS400/Sorting_01.xml', kind: 'scene' };
TARGETS['mps400_Distribution_Pro_01'] = { url: BASE + 'MPS400/Distribution_Pro_01.xml', kind: 'scene' };
TARGETS['mps400_Joining_01'] = { url: BASE + 'MPS400/Joining_01.xml', kind: 'scene' };
TARGETS['mps400_Measuring_Pro_01'] = { url: BASE + 'MPS400/Measuring_Pro_01.xml', kind: 'scene' };
TARGETS['mps_en_index'] = { url: BASE + 'mps/MPS%20[EN]/index.xml', kind: 'scene' };
TARGETS['cp-cloud_om_index'] = { url: BASE + 'cp-cloud_om/index.xml', kind: 'catalog' };
for (const s of CP_STATIONS) {
  TARGETS['cp-cloud_om_' + s] = { url: BASE + 'cp-cloud_om/' + s + '.xml', kind: 'scene' };
  TARGETS['cp-cloud_nm_' + s] = { url: BASE + 'cp-cloud_nm/' + s + '.xml', kind: 'scene' };
}
TARGETS['cp-cloud_nm_CP-AM-DISPENSE_01'] = { url: BASE + 'cp-cloud_nm/CP-AM-DISPENSE_01.xml', kind: 'scene' };

const OUT_DIR = path.resolve(__dirname, '..', 'static-live');

/** Scene name -> the remote folder its relative asset paths resolve against. */
function remoteBaseOf(name) {
  if (name.startsWith('cp-cloud_nm_')) return BASE + 'cp-cloud_nm/';
  if (name.startsWith('cp-cloud_om_')) return BASE + 'cp-cloud_om/';
  if (name.startsWith('mps400_')) return BASE + 'MPS400/';
  if (name.startsWith('mps_en_')) return BASE + 'mps/MPS%20[EN]/';
  return null;
}

/**
 * The published scenes reference their textures with relative paths
 * (images/…, obj/…, models/…) that resolve against the original Festo host.
 * Route them through the static server's same-origin /proxy so the browser
 * fetches the real artwork on demand without CORS or interception overhead.
 */
function rewriteAssetPaths(html, name) {
  const base = remoteBaseOf(name);
  if (!base) return html;
  const prox = (rel) => '/proxy?url=' + encodeURIComponent(base + rel);
  return html
    .replace(/url\(((?:images|obj|models)\/[^)]+)\)/g, (m, rel) => `url(${prox(rel)})`)
    .replace(/(src|href)="((?:images|obj|models)\/[^"]+)"/g, (m, attr, rel) => `${attr}="${prox(rel)}"`);
}

/**
 * Wait until every textured material in the scene has a decoded image, so a
 * screenshot captures the loaded artwork rather than blank placeholders.
 */
async function waitTexturesLoaded(page, timeout = 20_000) {
  await page.waitForLoadState('networkidle', { timeout }).catch(() => {});
  await page.waitForFunction(() => {
    const scene = /** @type {any} */ (document.querySelector('a-scene'));
    if (!scene || !scene.object3D) return false;
    let withMap = 0;
    let ready = 0;
    scene.object3D.traverse((o) => {
      const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      for (const m of mats) {
        if (m && m.map) {
          withMap++;
          const img = m.map.image;
          if (img && (img.width || img.videoWidth || img.complete)) ready++;
        }
      }
    });
    return withMap > 0 && ready === withMap;
  }, { timeout }).catch(() => {});
}

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

/**
 * Click every menu item on the scene's home view and capture what each one
 * shows. The operation-panel icons are @view: links, so clicking one fires the
 * same 'click' event the marker-free cursor emits and switches the scene view.
 * External-link icons (window.open) are skipped. Returns one result per menu
 * item: { view, switched, changed }.
 */
async function captureMenuViews(page, name, shotDir) {
  const info = await page.evaluate(() => {
    // A-Frame's getAttribute returns the parsed component object, so read .url
    const urlOf = (el) => {
      const d = el.getAttribute('navigate-on-click');
      return (typeof d === 'string' ? d : (d && d.url)) || '';
    };
    const views = (window.fdarViewList || []).slice();
    const home = window.fdarCurrentView;
    const targets = [];
    document.querySelectorAll('[navigate-on-click]').forEach((el) => {
      const m = urlOf(el).match(/@view:([A-Za-z0-9_-]+)/);
      // Only items reachable (not hidden) from the current home view
      const hidden = window.fdarHiddenChain && window.fdarHiddenChain(el);
      if (m && !hidden && m[1] !== home) targets.push(m[1]);
    });
    return { views, home, targets: [...new Set(targets)] };
  });
  if (!info.views || info.views.length < 2 || !info.targets.length) return [];

  const results = [];
  for (const view of info.targets) {
    // Return to the home view so its menu is on screen and clickable again
    await page.evaluate((h) => window.fdarSetView && window.fdarSetView(h), info.home);
    await page.waitForTimeout(250);
    const before = PNG.sync.read(await page.screenshot());
    const clicked = await page.evaluate((v) => {
      const urlOf = (el) => {
        const d = el.getAttribute('navigate-on-click');
        return (typeof d === 'string' ? d : (d && d.url)) || '';
      };
      const el = Array.prototype.slice.call(document.querySelectorAll('[navigate-on-click]'))
        .find((e) => urlOf(e).indexOf('@view:' + v) !== -1);
      if (!el) return false;
      el.emit('click');
      return true;
    }, view);
    await waitTexturesLoaded(page, 10_000);
    // Re-fit the marker-free stage to the newly revealed view so the captured
    // content is centred instead of clinging to the viewport edges.
    await page.evaluate(() => { if (window._mfFitAll) window._mfFitAll(); });
    await page.waitForTimeout(500);
    const current = await page.evaluate(() => window.fdarCurrentView);
    const afterBuf = await page.screenshot({ path: path.join(shotDir, `${name}__${view}.png`) });
    results.push({ view, clicked, switched: current === view, changed: diffRatio(before, PNG.sync.read(afterBuf)) });
  }
  // Leave the scene back on its home view
  await page.evaluate((h) => window.fdarSetView && window.fdarSetView(h), info.home).catch(() => {});
  return results;
}

test.describe('festodidacticsw.azurewebsites.net live XMLs', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ context }) => installNetCache(context));

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
          ['--stringparam', 'assetbase', '', path.resolve(__dirname, '..', 'aframe.xsl'), xmlPath],
          { maxBuffer: 64 * 1024 * 1024 }).toString();
        html = rewriteAssetPaths(html, name);
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
    test.setTimeout(20 * 60_000);
    const failures = [];
    // One screenshot per Azure XML, collected into the CI artifact so every
    // published scene has visible proof it rendered.
    const shotDir = path.resolve(__dirname, '..', 'test-screenshots', 'live');
    fs.mkdirSync(shotDir, { recursive: true });

    for (const [name, target] of Object.entries(TARGETS)) {
      const htmlPath = path.join(OUT_DIR, name + '.html');
      if (!fs.existsSync(htmlPath)) { failures.push(`${name}: not generated`); continue; }
      const shot = path.join(shotDir, name + '.png');
      try {
        await page.goto('/static-live/' + name + '.html', { waitUntil: 'domcontentloaded' });
        if (target.kind === 'catalog') {
          await expect(page.locator('a.entry').first()).toBeVisible({ timeout: 20_000 });
          await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
          await page.screenshot({ path: shot });
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
          // The marker-free choice persists per origin and auto-restores, so
          // force a known OFF state before measuring the toggle's effect
          if (await page.locator('#mf-checkbox').isChecked()) {
            await page.locator('.mf-slider').click();
            await expect(page.locator('#mf-checkbox')).not.toBeChecked();
          }
          await page.waitForTimeout(400);
          const before = PNG.sync.read(await page.screenshot());
          await page.locator('.mf-slider').click();
          // The click must actually engage the mode — an animated camera feed
          // used to fake the pixel diff when it didn't
          await expect(page.locator('#mf-checkbox')).toBeChecked();
          await page.waitForTimeout(900);
          // Let the mirrored textures finish decoding so the shot shows the
          // real icons, not blank placeholders.
          await waitTexturesLoaded(page);
          const afterBuf = await page.screenshot({ path: shot });
          const after = PNG.sync.read(afterBuf);
          const changed = diffRatio(before, after);
          if (changed < 0.002) throw new Error(`no visible objects after marker-free toggle (diff ${(changed * 100).toFixed(3)}%)`);
        } else {
          await waitTexturesLoaded(page);
          await page.screenshot({ path: shot });
        }
      } catch (e) {
        // Capture whatever is on screen even on failure, for diagnosis
        await page.screenshot({ path: shot }).catch(() => {});
        failures.push(`${name}: ${String(e.message).split('\n')[0]}`);
      }
    }
    expect(failures, failures.join('\n')).toEqual([]);
    // Every scene left its base screenshot behind
    for (const name of Object.keys(TARGETS)) {
      expect(fs.existsSync(path.join(shotDir, name + '.png')), `missing screenshot for ${name}`).toBe(true);
    }
  });

  test('clicking each menu item switches views and is captured', async ({ page }) => {
    test.slow();
    test.setTimeout(20 * 60_000);
    const shotDir = path.resolve(__dirname, '..', 'test-screenshots', 'live', 'menu');
    fs.mkdirSync(shotDir, { recursive: true });
    const failures = [];
    let captured = 0;
    let scenesWithMenu = 0;

    for (const [name, target] of Object.entries(TARGETS)) {
      if (target.kind === 'catalog') continue;
      const htmlPath = path.join(OUT_DIR, name + '.html');
      if (!fs.existsSync(htmlPath)) continue;
      try {
        await page.goto('/static-live/' + name + '.html', { waitUntil: 'domcontentloaded' });
        await expect(page.locator('a-scene')).toBeAttached({ timeout: 20_000 });
        const toggle = await page.locator('#marker-free-toggle').count();
        if (!toggle) continue;
        // Reveal the objects, then step through the home-view menu
        await page.evaluate(() => {
          document.querySelectorAll('video').forEach((v) => { v.style.display = 'none'; });
          document.body.style.background = '#000';
        });
        if (!(await page.locator('#mf-checkbox').isChecked())) {
          await page.locator('.mf-slider').click();
        }
        await expect(page.locator('#mf-checkbox')).toBeChecked();
        await page.waitForTimeout(900);
        await waitTexturesLoaded(page);

        const results = await captureMenuViews(page, name, shotDir);
        if (!results.length) continue;
        scenesWithMenu++;
        for (const r of results) {
          captured++;
          if (!r.switched) failures.push(`${name}: menu '${r.view}' click did not switch the view`);
        }
      } catch (e) {
        failures.push(`${name}: ${String(e.message).split('\n')[0]}`);
      }
    }

    // At least the CP operation-panel scenes must expose a working menu
    expect(scenesWithMenu, 'no scene exposed a clickable @view: menu').toBeGreaterThan(0);
    expect(failures, failures.join('\n')).toEqual([]);
    // Each captured menu item left a screenshot behind
    const shots = fs.readdirSync(shotDir).filter((f) => f.endsWith('.png'));
    expect(shots.length).toBe(captured);
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
