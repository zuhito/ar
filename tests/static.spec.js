// @ts-check
// Tests for HTML pre-generated with xsltproc (see global-setup.js), as opposed
// to editor.spec.js which covers the in-browser on-demand transform.
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

test.describe('xsltproc-generated pages', () => {
  test('text scene boots A-Frame and shows the text', async ({ page }) => {
    await page.goto('/static-html/text.html');
    await expect(page).toHaveTitle('AR App');
    const scene = page.locator('a-scene');
    await expect(scene).toBeAttached();
    await expect(scene).toHaveAttribute('background', 'color: #333333');

    const text = page.locator('a-text');
    await expect(text).toHaveAttribute('value', 'Hello World');
    await expect(text).toHaveAttribute('fdar-color', /rgba: 00ff0088/);
    await expect(text).toHaveAttribute('scale', '50 50 50');
    // NODE tz=100 becomes position z=-100 on the wrapping entity
    await expect(page.locator('a-camera > a-entity').first()).toHaveAttribute('position', '0 0 -100');

    // A-Frame actually initializes (WebGL canvas appears) — proves the
    // xsltproc output is browser-consumable, not just well-formed
    await expect(page.locator('a-scene canvas')).toBeAttached({ timeout: 30_000 });
  });

  test('link scene renders a clickable hitbox around the text', async ({ page }) => {
    await page.goto('/static-html/link.html');
    const hitbox = page.locator('a-plane.clickable');
    await expect(hitbox).toBeAttached();
    await expect(hitbox).toHaveAttribute('navigate-on-click', 'url: https://nodered.jp');
    await expect(hitbox).toHaveAttribute('hover-outline', /type: rect/);
    // Clickable scenes get mouse cursor + raycaster wiring on the scene
    const scene = page.locator('a-scene');
    await expect(scene).toHaveAttribute('cursor', 'rayOrigin: mouse');
    await expect(scene).toHaveAttribute('raycaster', 'objects: .clickable');
  });

  test('signal scene renders a colored sphere', async ({ page }) => {
    await page.goto('/static-html/signal.html');
    const sphere = page.locator('a-sphere');
    await expect(sphere).toBeAttached();
    await expect(sphere).toHaveAttribute('color', '#f00');
    await expect(sphere).toHaveAttribute('radius', '0.5');
    await expect(sphere).toHaveAttribute('ws-signal', /on: true/);
  });

  test('viewer scene renders an image with auto-refresh', async ({ page }) => {
    await page.goto('/static-html/viewer.html');
    const img = page.locator('a-image');
    await expect(img).toBeAttached();
    await expect(img).toHaveAttribute('src', 'https://picsum.photos/200');
    await expect(img).toHaveAttribute('image-refresher', /interval: 5/);
  });

  test('view system: nodes toggle with the active view and variables', async ({ page }) => {
    await page.goto('/static-html/views.html');
    await expect(page.locator('a-scene canvas')).toBeAttached({ timeout: 30_000 });

    // Object3D visibility of the entity wrapping the a-text with the given value
    const isVisible = (label) => page.evaluate((value) => {
      const texts = Array.from(document.querySelectorAll('a-text'));
      const el = texts.find((t) => t.getAttribute('value') === value);
      if (!el) return 'missing';
      let node = el.closest('[fdar-visibility]');
      if (!node) return 'no-visibility-node';
      return /** @type {any} */ (node).object3D.visible;
    }, label);

    // Initial view is the first viewlist entry
    expect(await page.evaluate(() => /** @type {any} */ (window).fdarCurrentView)).toBe('v_main');
    await expect.poll(() => isVisible('Main view')).toBe(true);
    await expect.poll(() => isVisible('Detail view')).toBe(false);
    // show="@anim:flag_on" (predefined true) keeps the node visible in both views
    await expect.poll(() => isVisible('Always both views')).toBe(true);
    // show="@anim:flag_off" (predefined false) hides the node
    await expect.poll(() => isVisible('Hidden by flag')).toBe(false);

    // Switching views flips the per-view nodes
    await page.evaluate(() => /** @type {any} */ (window).fdarSetView('v_detail'));
    await expect.poll(() => isVisible('Detail view')).toBe(true);
    await expect.poll(() => isVisible('Main view')).toBe(false);
    await expect.poll(() => isVisible('Always both views')).toBe(true);

    // TEXT with no label attribute falls back to METADATA/label
    await expect(page.locator('a-text[value="From metadata"]')).toBeAttached();
    // SWITCH custom payloads reach the component config
    await expect(page.locator('[fdar-switch]')).toHaveAttribute('fdar-switch', /onvalue: GO; offvalue: STOP;/);

    // MODEL file="cube" renders as a box; MATERIAL type="mask" makes it an
    // occluder (depth-only: colorWrite disabled on the mesh material)
    const mask = page.locator('[fdar-mask]');
    await expect(mask).toHaveAttribute('geometry', /primitive: box/);
    await expect.poll(() => page.evaluate(() => {
      const el = /** @type {any} */ (document.querySelector('[fdar-mask]'));
      let result = null;
      el.object3D.traverse((o) => { if (o.isMesh && o.material) result = o.material.colorWrite; });
      return result;
    })).toBe(false);
    // Tinted plain cube gets its color from fdar-color
    await expect(page.locator('a-entity[geometry*="box"][fdar-color]')).toHaveAttribute('fdar-color', 'tint: #D50000');
  });

  test('compilation renders a menu and entries open their scenes', async ({ page }) => {
    await page.goto('/static-html/compilation.html');
    await expect(page).toHaveTitle('Test Compilation');
    await expect(page.locator('h1')).toHaveText('Test Compilation');
    // METADATA/desc resolves through the fallback language (CDATA content)
    await expect(page.locator('.desc')).toHaveText('Pick a scene.');
    await expect(page.locator('a.entry')).toHaveCount(2);
    await expect(page.locator('a.entry').first()).toHaveAttribute('href', 'text.html');
    // Clicking an entry navigates to the pre-generated scene page
    await page.locator('a.entry').first().click();
    await page.waitForURL(/text\.html$/);
    await expect(page.locator('a-scene')).toBeAttached();
    await expect(page.locator('a-text')).toHaveAttribute('value', 'Hello World');
  });

  test('every Festo sample scene transforms into a scene or catalog page', () => {
    // global-setup already fails on xsltproc errors; here we check each
    // generated page carries the expected top-level structure
    const outDir = path.resolve(__dirname, '..', 'static-html', 'festo');
    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
    const pages = walk(outDir).filter((f) => f.endsWith('.html'));
    expect(pages.length).toBe(40);
    for (const file of pages) {
      const html = fs.readFileSync(file, 'utf8');
      expect(html, file).toContain('<!DOCTYPE html>');
      const isScene = html.includes('<a-scene');
      const isCatalog = html.includes('class="entry"');
      expect(isScene || isCatalog, `${file} is neither a scene nor a catalog`).toBe(true);
    }
  });

  test('Festo Sorting_01 renders its marker scene and view system', async ({ page }) => {
    await page.goto('/static-html/festo/mps400/Sorting_01.html');
    await expect(page.locator('a-scene')).toBeAttached();
    await expect(page.locator('a-marker')).toBeAttached();
    expect(await page.evaluate(() => /** @type {any} */ (window).fdarCurrentView)).toBe('sorting_home');
    expect(await page.locator('[fdar-visibility]').count()).toBeGreaterThan(400);
  });

  test('AR marker scene has marker and model markup', async ({ page }) => {
    // DOM-structure assertions only: the AR.js webcam pipeline needs real
    // camera input, which the fake media stream stands in for
    await page.goto('/static-html/model_ar.html');
    const scene = page.locator('a-scene');
    await expect(scene).toBeAttached();
    await expect(scene).toHaveAttribute('embedded', 'embedded');
    await expect(scene).toHaveAttribute('arjs', /sourceType: webcam/);

    const marker = page.locator('a-marker');
    await expect(marker).toHaveAttribute('type', 'pattern');
    await expect(marker).toHaveAttribute('url', 'marker/CP-AM-DRILL.patt');
    await expect(page.locator('a-entity[gltf-model]')).toHaveAttribute('gltf-model', 'obj/arrow_blue.glb');
  });
});
