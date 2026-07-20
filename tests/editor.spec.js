// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const { PNG } = require('pngjs');

const { installNetCache } = require('./net-cache.js');

const SHOT_DIR = 'test-screenshots';
fs.mkdirSync(SHOT_DIR, { recursive: true });

// Everything internet-sourced is fetched on demand by the browser; the
// net-cache route makes those fetches deterministic and fast in CI. The CORS
// proxy is pointed at the static server so scene assets arrive same-origin.
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => { window.FDAR_CORS_PROXY = 'http://localhost:8321/proxy?url='; });
  await installNetCache(context);
});

/** Count pixels matching a predicate. */
function countPixels(png, match) {
  let n = 0;
  for (let i = 0; i < png.width * png.height * 4; i += 4) {
    if (match(png.data[i], png.data[i + 1], png.data[i + 2])) n++;
  }
  return n;
}

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

/** Editor value, whether Monaco loaded or the textarea fallback is active. */
function getEditorValue(page) {
  return page.evaluate(() => {
    const w = /** @type {any} */ (window);
    if (w._monacoEditor) return w._monacoEditor.getValue();
    const ta = /** @type {HTMLTextAreaElement} */ (document.getElementById('fallback-editor'));
    return ta.value;
  });
}

/** Set the XML source, triggering the same input pipeline as typing. */
function setEditorValue(page, value) {
  return page.evaluate((v) => {
    const w = /** @type {any} */ (window);
    if (w._monacoEditor) {
      w._monacoEditor.setValue(v);
    } else {
      const ta = /** @type {HTMLTextAreaElement} */ (document.getElementById('fallback-editor'));
      ta.value = v;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, value);
}

/** Generated HTML of the last successful transform. */
function getGeneratedHtml(page) {
  return page.evaluate(() => /** @type {any} */ (window)._popupCode || '');
}

async function openApp(page) {
  // 'load' would wait for the Monaco CDN, which can be very slow
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  // Tabs render once Monaco (or its textarea fallback) has initialized
  await expect(page.locator('#xml-tab-bar .dtab')).toHaveCount(13);
  await expect.poll(() => getEditorValue(page)).toContain('<AUGMENTATION>');
}

/** Wait until the XML -> HTML transform has produced output. */
async function waitForTransform(page) {
  await expect.poll(() => getGeneratedHtml(page), { timeout: 20_000 }).toContain('<a-scene');
}

test.describe('startup', () => {
  test('loads with default tabs and panes', async ({ page }) => {
    await openApp(page);
    await expect(page).toHaveTitle('AR App Live Editor');
    await expect(page.locator('#xml-tab-bar .dtab.active')).toHaveText(/text/);
    await expect(page.locator('#preview-tab-bar .dtab')).toHaveCount(3);
    // aframe.xsl was fetched, so the drop overlay must stay hidden
    await expect(page.locator('#xsl-drop-overlay')).not.toHaveClass(/show/);
  });

  test('active tab content is shown in the editor', async ({ page }) => {
    await openApp(page);
    const value = await getEditorValue(page);
    expect(value).toContain('<TEXT label="Hello World"');
  });
});

test.describe('transform pipeline', () => {
  test('generates A-Frame HTML from the XML scene', async ({ page }) => {
    await openApp(page);
    await waitForTransform(page);
    const html = await getGeneratedHtml(page);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<a-scene');
    expect(html).toContain('<a-text');
    expect(html).toContain('Hello World');
    expect(html).toContain('<base href=');
  });

  test('AR marker scene generates a-marker markup', async ({ page }) => {
    await openApp(page);
    await page.locator('#xml-tab-bar .dtab', { hasText: 'model_ar' }).locator('.dtab-label').click();
    await expect.poll(() => getEditorValue(page)).toContain('<TARGETBASE');
    await expect.poll(() => getGeneratedHtml(page), { timeout: 20_000 }).toContain('<a-marker');
    const html = await getGeneratedHtml(page);
    // Relative url= attributes are rewritten to absolute against the page base
    expect(html).toMatch(/url="[^"]*marker\/CP-AM-DRILL\.patt"/);
    // The Azure-hosted model is routed through the CORS proxy on demand
    expect(html).toMatch(/gltf-model="[^"]*proxy\?url=[^"]*arrow_blue\.glb"/);
  });

  test('preview iframe contains the generated scene', async ({ page }) => {
    await openApp(page);
    await waitForTransform(page);
    const frame = page.frameLocator('#preview-iframe');
    await expect(frame.locator('a-scene')).toBeAttached();
    await expect(frame.locator('a-text')).toBeAttached();
  });

  test('invalid XML shows an error page in the preview', async ({ page }) => {
    await openApp(page);
    await waitForTransform(page);
    await setEditorValue(page, '<AUGMENTATION><broken</AUGMENTATION>');
    const frame = page.frameLocator('#preview-iframe');
    await expect(frame.locator('.box')).toContainText('XML Error');
  });
});

test.describe('xml tabs', () => {
  test('clicking a tab switches editor content and persists the choice', async ({ page }) => {
    await openApp(page);
    await page.locator('#xml-tab-bar .dtab', { hasText: 'viewer' }).first().locator('.dtab-label').click();
    await expect(page.locator('#xml-tab-bar .dtab.active')).toHaveText(/viewer/);
    await expect.poll(() => getEditorValue(page)).toContain('<VIEWER');
    const active = await page.evaluate(() => localStorage.getItem('fdar_editor_active_tab'));
    expect(active).toBe('viewer');
  });

  test('arrow keys move between tabs', async ({ page }) => {
    await openApp(page);
    await page.locator('#xml-tab-bar .dtab.active').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#xml-tab-bar .dtab.active')).toHaveAttribute('data-id', 'helloworldar');
    await expect.poll(() => getEditorValue(page)).toContain('<TARGETBASE');
  });

  test('the + button adds a tab and close removes it', async ({ page }) => {
    await openApp(page);
    await page.locator('#xml-add-btn').click();
    await expect(page.locator('#xml-tab-bar .dtab')).toHaveCount(14);
    const added = page.locator('#xml-tab-bar .dtab.active');
    await expect(added).toHaveText(/untitled/);
    await expect.poll(() => getEditorValue(page)).toContain('<AUGMENTATION>');
    await added.locator('.dtab-close').click();
    await expect(page.locator('#xml-tab-bar .dtab')).toHaveCount(13);
  });

  test('double click renames a tab', async ({ page }) => {
    await openApp(page);
    await page.locator('#xml-tab-bar .dtab.active .dtab-label').dblclick();
    const input = page.locator('#xml-tab-bar .rename-input');
    await expect(input).toBeVisible();
    await input.fill('renamed_tab');
    await input.press('Enter');
    await expect(page.locator('#xml-tab-bar .dtab.active')).toHaveText(/renamed_tab/);
    const stored = await page.evaluate(() => localStorage.getItem('fdar_editor_tabs') || '');
    expect(stored).toContain('renamed_tab');
  });

  test('edits are persisted to localStorage per tab', async ({ page }) => {
    await openApp(page);
    await setEditorValue(page, '<AUGMENTATION>\n  <CAMERA>\n    <NODE tz="100">\n      <TEXT label="Edited!" />\n    </NODE>\n  </CAMERA>\n</AUGMENTATION>');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('fdar_editor_tabs') || '')).toContain('Edited!');
  });
});

test.describe('preview tabs', () => {
  test('HTML Code tab reveals the code view and save button', async ({ page }) => {
    await openApp(page);
    await waitForTransform(page);
    await page.locator('#preview-tab-bar .dtab', { hasText: 'HTML Code' }).locator('.dtab-label').click();
    await expect(page.locator('#html-code-wrap')).toBeVisible();
    await expect(page.locator('#btn-save-html')).toBeVisible();
    await expect(page.locator('#preview-iframe')).toBeHidden();
    // Switching back restores the iframe
    await page.locator('#preview-tab-bar .dtab', { hasText: 'AR Preview' }).locator('.dtab-label').click();
    await expect(page.locator('#preview-iframe')).toBeVisible();
    await expect(page.locator('#html-code-wrap')).toBeHidden();
  });
});

test.describe('preview state', () => {
  test('marker-free toggle survives editing the XML', async ({ page }) => {
    test.slow(); // AR preview pulls AR.js from a CDN
    await openApp(page);
    // Switch to a marker scene so the preview shows the toggle
    await page.locator('#xml-tab-bar .dtab', { hasText: 'model_ar' }).locator('.dtab-label').click();
    await expect.poll(() => getEditorValue(page)).toContain('<TARGETBASE');
    const frame = page.frameLocator('#preview-iframe');
    await expect(frame.locator('#mf-checkbox')).toBeAttached({ timeout: 30_000 });
    await frame.locator('.mf-slider').click();
    await expect(frame.locator('#mf-checkbox')).toBeChecked();

    // Editing the XML reloads the preview; the toggle must stay on
    await setEditorValue(page, (await getEditorValue(page)).replace('sxyz="0.1"', 'sxyz="0.2"'));
    await expect.poll(() => getGeneratedHtml(page), { timeout: 20_000 }).toContain('scale="0.2 0.2 0.2"');
    await expect(frame.locator('#mf-checkbox')).toBeChecked({ timeout: 30_000 });
    // ...and actually re-applies (marker content moved onto the stage)
    await expect.poll(() => page.evaluate(() => {
      const iframe = /** @type {HTMLIFrameElement} */ (document.getElementById('preview-iframe'));
      const doc = iframe.contentDocument;
      const stage = doc && /** @type {any} */ (doc.getElementById('mf-stage'));
      return stage && stage.object3D ? stage.object3D.children.length : 0;
    }), { timeout: 30_000 }).toBeGreaterThan(0);
  });
});

test.describe('Azure sample via the URL dialog (fetched on demand)', () => {
  test('CP-AM-CAM-V2_01 shows textured menu icons and clicking one switches views', async ({ page }) => {
    test.slow();
    test.setTimeout(180_000);
    await openApp(page);
    await page.locator('#btn-open-xml').click();
    await page.locator('#od-url-input')
      .fill('https://festodidacticsw.azurewebsites.net/ar/cp-cloud_om/CP-AM-CAM-V2_01.xml');
    await page.locator('#od-url-load').click();
    await expect(page.locator('#xml-tab-bar .dtab.active')).toHaveText(/CP-AM-CAM-V2_01/, { timeout: 30_000 });

    const frame = page.frameLocator('#preview-iframe');
    await expect(frame.locator('#mf-checkbox')).toBeAttached({ timeout: 60_000 });
    await frame.locator('.mf-slider').click();

    const inIframe = (fn) => page.evaluate((srcFn) => {
      const iframe = /** @type {HTMLIFrameElement} */ (document.getElementById('preview-iframe'));
      const win = /** @type {any} */ (iframe.contentWindow);
      return new Function('window', 'document', `return (${srcFn})()`)(win, win.document);
    }, fn.toString());

    // The menu icons must be real textures (fetched on demand
    // of the Azure assets), not white fallbacks
    await expect.poll(() => inIframe(() => {
      let textured = 0;
      const scene = /** @type {any} */ (document.querySelector('a-scene'));
      if (!scene || !scene.object3D) return 0;
      scene.object3D.traverse((o) => {
        if (!o.isMesh || !o.material || !o.material.map) return;
        const img = o.material.map.image;
        if (img && ((img.naturalWidth || 0) > 0 || (img.videoWidth || 0) > 0 || (img.width || 0) > 0)) textured++;
      });
      return textured;
    }), { timeout: 60_000, intervals: [1000] }).toBeGreaterThanOrEqual(4);

    const box = await page.locator('#preview-iframe').boundingBox();
    if (!box) throw new Error('no preview box');
    await page.waitForTimeout(2000);
    const beforeShot = await page.screenshot({ clip: box, path: `${SHOT_DIR}/cam-v2-icons.png` });
    const beforePng = PNG.sync.read(beforeShot);
    // Festo blue (#0091DC-ish) must be on screen — the icons are visible
    // The icon panels must actually be on screen: count bright panel pixels
    // and dark glyph pixels outside the toggle UI corner
    let bright = 0, glyph = 0;
    for (let y = 0; y < beforePng.height; y++) {
      for (let x = 0; x < beforePng.width; x++) {
        if (x < 260 && y < 60) continue;
        const i = (y * beforePng.width + x) * 4;
        const [r, g, b] = [beforePng.data[i], beforePng.data[i + 1], beforePng.data[i + 2]];
        if (r > 180 && g > 180 && b > 180) bright++;
        else if (r < 40 && g < 40 && b < 40) glyph++;
      }
    }
    expect(bright, 'icon panels visible').toBeGreaterThan(5000);
    expect(glyph, 'icon glyphs visible').toBeGreaterThan(1000);

    // Click the top-left menu icon like a user would: locate the bright
    // icon panels in the screenshot and click the centre of the first one
    // (projection math is unreliable because AR.js reshapes the camera)
    const viewBefore = await inIframe(() => /** @type {any} */ (window).fdarCurrentView);
    // Sample bright (panel) pixels and let the page's own raycaster tell us
    // which screen point actually hits a @view: menu link, then click there.
    let switched = false;
    for (let attempt = 0; attempt < 4 && !switched; attempt++) {
      const shot = PNG.sync.read(await page.screenshot({ clip: box }));
      const candidates = [];
      for (let y = 0; y < shot.height && candidates.length < 400; y += 12) {
        for (let x = 0; x < shot.width && candidates.length < 400; x += 12) {
          const i = (y * shot.width + x) * 4;
          if (shot.data[i] > 200 && shot.data[i + 1] > 200 && shot.data[i + 2] > 200) {
            candidates.push({ x, y });
          }
        }
      }
      expect(candidates.length, 'bright menu pixels present').toBeGreaterThan(0);
      const spot = await page.evaluate((points) => {
        const win = /** @type {any} */ (/** @type {HTMLIFrameElement} */ (document.getElementById('preview-iframe')).contentWindow);
        const doc = win.document;
        const scene = doc.querySelector('a-scene');
        if (!scene || !scene.canvas) return null;
        const rect = scene.canvas.getBoundingClientRect();
        const clickables = Array.from(doc.querySelectorAll('.clickable')).filter((el) => el.object3D && !win.fdarHiddenChain(el));
        const objs = clickables.map((el) => el.object3D);
        const ray = new win.THREE.Raycaster();
        for (const p of points) {
          const ndc = new win.THREE.Vector2(((p.x - rect.left) / rect.width) * 2 - 1, -(((p.y - rect.top) / rect.height) * 2 - 1));
          ray.setFromCamera(ndc, scene.camera);
          const hits = ray.intersectObjects(objs, true);
          if (!hits.length) continue;
          let node = hits[0].object;
          while (node) {
            const el = node.el;
            if (el && el.classList && el.classList.contains('clickable')) {
              const data = el.getAttribute('navigate-on-click');
              const url = typeof data === 'string' ? data : (data && data.url) || '';
              if (url.indexOf('@view:') === 0) return p;
              break;
            }
            node = node.parent;
          }
        }
        return null;
      }, candidates);
      if (!spot) { await page.waitForTimeout(1500); continue; }
      console.log(`[cam-v2] attempt ${attempt}: clicking (${spot.x},${spot.y})`);
      await page.mouse.click(box.x + spot.x, box.y + spot.y);
      try {
        await expect.poll(() => inIframe(() => /** @type {any} */ (window).fdarCurrentView),
          { timeout: 6_000 }).not.toBe(viewBefore);
        switched = true;
      } catch (e) { /* moved between shot and click; retry */ }
    }
    expect(switched, 'clicking a menu icon must switch the view').toBe(true);
    await page.waitForTimeout(2500);
    const afterShot = await page.screenshot({ clip: box, path: `${SHOT_DIR}/cam-v2-after-click.png` });
    expect(diffRatio(beforePng, PNG.sync.read(afterShot))).toBeGreaterThan(0.01);
  });
});

test.describe('catalog preview', () => {
  test('MPS400 catalog entries open as editor tabs when clicked', async ({ page }) => {
    test.slow();
    await openApp(page);
    await page.locator('#btn-open-xml').click();
    await page.locator('#od-url-input')
      .fill('https://festodidacticsw.azurewebsites.net/ar/MPS400/MPS400.xml');
    await page.locator('#od-url-load').click();
    await expect(page.locator('#xml-tab-bar .dtab.active')).toHaveText(/MPS400/, { timeout: 30_000 });

    // The preview renders the catalog menu
    const frame = page.frameLocator('#preview-iframe');
    await expect(frame.locator('a.entry').first()).toBeVisible({ timeout: 30_000 });
    await expect(frame.locator('a.entry')).toHaveCount(4);

    // Clicking an entry opens it as a new tab (fetched on demand)
    await frame.locator('a.entry', { hasText: 'Sorting_01' }).click();
    await expect(page.locator('#xml-tab-bar .dtab.active')).toHaveText(/Sorting_01/, { timeout: 60_000 });
    await expect.poll(() => getEditorValue(page)).toContain('<TARGETBASE');
    await expect.poll(() => getGeneratedHtml(page), { timeout: 30_000 }).toContain('<a-marker');
  });
});

test.describe('preview stability', () => {
  test('marker-free display size is unchanged after editing the XML', async ({ page }) => {
    test.slow();
    await openApp(page);
    await page.locator('#xml-tab-bar .dtab', { hasText: 'text_ar' }).locator('.dtab-label').click();
    await expect.poll(() => getEditorValue(page)).toContain('<TARGETBASE');
    const frame = page.frameLocator('#preview-iframe');
    await expect(frame.locator('#mf-checkbox')).toBeAttached({ timeout: 30_000 });
    await frame.locator('.mf-slider').click();

    const stageScale = () => page.evaluate(() => {
      const iframe = /** @type {HTMLIFrameElement} */ (document.getElementById('preview-iframe'));
      const doc = iframe && iframe.contentDocument;
      const marker = doc && /** @type {any} */ (doc.querySelector('a-marker'));
      if (!marker || !marker._mfGroup) return null;
      return marker._mfGroup.children[0].scale.x;
    });
    await expect.poll(stageScale, { timeout: 30_000 }).not.toBeNull();
    // Let the post-load re-fit settle (text glyphs arrive asynchronously)
    await page.waitForTimeout(1500);
    const before = await stageScale();

    // A colour-only edit reloads the preview without changing geometry
    await setEditorValue(page, (await getEditorValue(page))
      .replace('<TEXT label="Hello World" />', '<TEXT label="Hello World" rgba="ff0000ff" />'));
    await expect.poll(() => getGeneratedHtml(page), { timeout: 20_000 }).toContain('rgba: ff0000ff');
    await expect(frame.locator('#mf-checkbox')).toBeChecked({ timeout: 30_000 });
    await expect.poll(stageScale, { timeout: 30_000 }).not.toBeNull();
    await page.waitForTimeout(1500);
    const after = await stageScale();

    expect(before).not.toBeNull();
    expect(Math.abs(/** @type {number} */(after) - /** @type {number} */(before)))
      .toBeLessThan(/** @type {number} */(before) * 0.02);
  });
});

test.describe('open dialog', () => {
  test('Open shows a dialog with file drop zone, URL input and QR scan', async ({ page }) => {
    await openApp(page);
    await page.locator('#btn-open-xml').click();
    const dialog = page.locator('#open-dialog');
    await expect(dialog).toBeVisible();
    await expect(page.locator('#od-drop-zone')).toBeVisible();
    await expect(page.locator('#od-url-input')).toBeVisible();
    await expect(page.locator('#od-qr-btn')).toBeVisible();
    // URL field doubles as a pulldown of Azure sample scenes (datalist),
    // while still accepting free-form input
    await expect(page.locator('#od-url-input')).toHaveAttribute('list', 'od-url-samples');
    const optionCount = await page.locator('#od-url-samples option').count();
    expect(optionCount).toBeGreaterThanOrEqual(40);
    const values = await page.locator('#od-url-samples option').evaluateAll(
      (opts) => opts.map((o) => /** @type {HTMLOptionElement} */ (o).value));
    expect(values).toContain('https://festodidacticsw.azurewebsites.net/ar/MPS400/Sorting_01.xml');
    expect(values.every((v) => /^https:\/\//.test(v))).toBe(true);
    // Escape closes it
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('clicking the drop zone opens the OS file picker', async ({ page }) => {
    await openApp(page);
    await page.locator('#btn-open-xml').click();
    const chooserPromise = page.waitForEvent('filechooser');
    await page.locator('#od-drop-zone').click();
    const chooser = await chooserPromise;
    expect(chooser.isMultiple()).toBe(false);
  });

  test('dropping an XML file onto the drop zone opens it as a tab', async ({ page }) => {
    await openApp(page);
    await page.locator('#btn-open-xml').click();
    // Synthesize a drag & drop with a DataTransfer carrying an XML file
    await page.evaluate(() => {
      const dt = new DataTransfer();
      dt.items.add(new File(
        ['<AUGMENTATION>\n  <CAMERA>\n    <NODE tz="100">\n      <TEXT label="dropped!" />\n    </NODE>\n  </CAMERA>\n</AUGMENTATION>'],
        'dropped_scene.xml', { type: 'text/xml' }));
      const zone = /** @type {HTMLElement} */ (document.getElementById('od-drop-zone'));
      zone.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer: dt }));
      zone.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dt }));
    });
    await expect(page.locator('#open-dialog')).toBeHidden();
    await expect(page.locator('#xml-tab-bar .dtab.active')).toHaveText(/dropped_scene/);
    await expect.poll(() => getEditorValue(page)).toContain('dropped!');
  });

  test('loading an XML from a URL adds a tab and transforms it', async ({ page }) => {
    await openApp(page);
    await page.locator('#btn-open-xml').click();
    await page.locator('#od-url-input').fill('http://localhost:8321/static-html/link.xml');
    await page.locator('#od-url-load').click();
    await expect(page.locator('#open-dialog')).toBeHidden();
    await expect(page.locator('#xml-tab-bar .dtab.active')).toHaveText(/link/);
    await expect.poll(() => getEditorValue(page)).toContain('nodered.jp');
    await expect.poll(() => getGeneratedHtml(page), { timeout: 20_000 }).toContain('navigate-on-click');
  });

  test('a failing URL shows an error and keeps the dialog open', async ({ page }) => {
    await openApp(page);
    await page.locator('#btn-open-xml').click();
    await page.locator('#od-url-input').fill('http://localhost:8321/does-not-exist.xml');
    await page.locator('#od-url-load').click();
    await expect(page.locator('#od-error')).toContainText('Failed to load', { timeout: 20_000 });
    await expect(page.locator('#open-dialog')).toBeVisible();
  });

  test('QR scan flow loads the decoded URL', async ({ page }) => {
    // Stub BarcodeDetector to decode a known URL from the fake camera stream
    await page.addInitScript(() => {
      // @ts-ignore
      window.BarcodeDetector = class {
        static getSupportedFormats() { return Promise.resolve(['qr_code']); }
        detect() {
          return Promise.resolve([{ rawValue: 'http://localhost:8321/static-html/signal.xml' }]);
        }
      };
    });
    await openApp(page);
    await page.locator('#btn-open-xml').click();
    await page.locator('#od-qr-btn').click();
    await expect(page.locator('#xml-tab-bar .dtab.active')).toHaveText(/signal/, { timeout: 20_000 });
    await expect.poll(() => getEditorValue(page)).toContain('<SIGNAL');
    // Camera must be released after a successful scan
    expect(await page.evaluate(() => {
      const v = /** @type {HTMLVideoElement} */ (document.getElementById('od-qr-video'));
      return v.srcObject === null;
    })).toBe(true);
  });
});

test.describe('file operations', () => {
  test('Save XML downloads the active tab as .xml', async ({ page }) => {
    await openApp(page);
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#btn-save-xml').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('text.xml');
  });

  test('Save HTML downloads the generated scene', async ({ page }) => {
    await openApp(page);
    await waitForTransform(page);
    await page.locator('#preview-tab-bar .dtab', { hasText: 'HTML Code' }).locator('.dtab-label').click();
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#btn-save-html').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('scene.htm');
  });
});
