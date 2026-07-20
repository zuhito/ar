// @ts-check
// Tests for HTML pre-generated with xsltproc (see global-setup.js), as opposed
// to editor.spec.js which covers the in-browser on-demand transform.
const { test, expect } = require('@playwright/test');
const { PNG } = require('pngjs');

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

const { installNetCache } = require('./net-cache.js');

test.describe('xsltproc-generated pages', () => {
  test.beforeEach(async ({ context }) => installNetCache(context));

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
    const hitbox = page.locator('a-entity.clickable[fdar-fit-parent]');
    await expect(hitbox).toBeAttached();
    await expect(hitbox).toHaveAttribute('navigate-on-click', 'url: https://nodered.jp');
    // Interaction area is the spec's semi-transparent pulsing surface
    // (defaults resolved in the component, so the attribute may be empty)
    await expect(hitbox).toHaveAttribute('fdar-area', /.*/);
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

  test('viewer displays its picture immediately, not after the first refresh', async ({ page }) => {
    // refresh="50": without the immediate load the texture would take 50s
    await page.goto('/static-html/viewer_local.html');
    const start = Date.now();
    await expect.poll(() => page.evaluate(() => {
      const img = /** @type {any} */ (document.querySelector('a-image'));
      if (!img || !img.getObject3D) return false;
      const mesh = img.getObject3D('mesh');
      return !!(mesh && mesh.material && mesh.material.map);
    }), { timeout: 15_000 }).toBe(true);
    expect(Date.now() - start).toBeLessThan(10_000);

    // Pixel proof: the red test image is actually on screen
    await page.evaluate(() => { document.body.style.background = '#000'; });
    await page.waitForTimeout(300);
    const shot = PNG.sync.read(await page.screenshot());
    let reddish = 0;
    for (let i = 0; i < shot.width * shot.height * 4; i += 4) {
      if (shot.data[i] > 180 && shot.data[i + 1] < 100 && shot.data[i + 2] < 100) reddish++;
    }
    expect(reddish).toBeGreaterThan(500);
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

    // Effective visibility of the a-text (visible flag anywhere up the chain
    // hides it — per spec, view/show act on directly contained elements)
    const isVisible = (label) => page.evaluate((value) => {
      const texts = Array.from(document.querySelectorAll('a-text'));
      const el = /** @type {any} */ (texts.find((t) => t.getAttribute('value') === value));
      if (!el) return 'missing';
      let o = el.object3D;
      while (o) { if (o.visible === false) return false; o = o.parent; }
      return true;
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

  test('marker-free toggle actually renders marker content on screen', async ({ page }) => {
    test.slow(); // waits on the AR.js CDN, which is slow under parallel load
    await page.goto('/static-html/marker_free.html');
    const toggle = page.locator('#marker-free-toggle');
    await expect(toggle).toBeVisible();
    // Toggle sits top-left (websocket status dot holds the top-right)
    const box = await toggle.boundingBox();
    const viewport = page.viewportSize();
    if (!box || !viewport) throw new Error('no toggle bounding box');
    expect(box.y).toBeLessThan(80);
    expect(box.x + box.width).toBeLessThan(viewport.width / 2);

    await expect.poll(() => page.evaluate(() => {
      const m = /** @type {any} */ (document.querySelector('a-marker'));
      return !!(m && m.object3D);
    }), { timeout: 30_000 }).toBe(true);

    // Blank out the camera video so screenshots only show rendered 3D content
    await page.evaluate(() => {
      document.querySelectorAll('video').forEach((v) => { v.style.display = 'none'; });
      document.body.style.background = '#000';
    });
    await page.waitForTimeout(300);
    const before = PNG.sync.read(await page.screenshot());

    await page.locator('.mf-slider').click();
    // Marker children are reparented onto the stage and normalised
    await expect.poll(() => page.evaluate(() => {
      const stage = /** @type {any} */ (document.getElementById('mf-stage'));
      return stage && stage.object3D ? stage.object3D.children.length : 0;
    })).toBeGreaterThan(0);
    await page.waitForTimeout(500);
    const after = PNG.sync.read(await page.screenshot());

    // Pixel proof: turning the toggle on must change what is on screen
    const changed = diffRatio(before, after);
    expect(changed).toBeGreaterThan(0.002);

    // Toggling off puts the content back under the marker
    await page.locator('.mf-slider').click();
    await expect.poll(() => page.evaluate(() => {
      const stage = /** @type {any} */ (document.getElementById('mf-stage'));
      const marker = /** @type {any} */ (document.querySelector('a-marker'));
      return stage.object3D.children.length === 0 && marker.object3D.children.length > 0;
    })).toBe(true);

    // Non-marker scenes must not show the toggle
    await page.goto('/static-html/text.html');
    await expect(page.locator('#marker-free-toggle')).toHaveCount(0);
  });

  test('progress bar exists, clears after boot, and is reference-counted', async ({ page }) => {
    await page.goto('/static-html/marker_free.html');
    // The bar markup is present and starts active for the scene boot
    await expect(page.locator('#fdar-progress')).toBeAttached();
    // Once the scene has loaded the boot hold is released
    await expect.poll(() => page.evaluate(() => {
      const s = /** @type {any} */ (document.querySelector('a-scene'));
      return !!(s && s.hasLoaded);
    }), { timeout: 30_000 }).toBe(true);
    await expect(page.locator('#fdar-progress')).not.toHaveClass(/active/, { timeout: 15_000 });

    // Reference-counted: two starts need two stops before the bar hides again
    const states = await page.evaluate(() => {
      const bar = /** @type {any} */ (document.getElementById('fdar-progress'));
      const f = /** @type {any} */ (window).fdarProgress;
      const seq = [];
      f(true); seq.push(bar.classList.contains('active'));   // true
      f(true); seq.push(bar.classList.contains('active'));   // true
      f(false); seq.push(bar.classList.contains('active'));  // still true (1 outstanding)
      f(false); seq.push(bar.classList.contains('active'));  // false
      return seq;
    });
    expect(states).toEqual([true, true, true, false]);
  });

  test('marker-free view moves with mouse drag and arrow keys', async ({ page }) => {
    test.slow();
    await page.goto('/static-html/marker_free.html');
    await expect.poll(() => page.evaluate(() => {
      const s = /** @type {any} */ (document.querySelector('a-scene'));
      return !!(s && s.hasLoaded);
    }), { timeout: 30_000 }).toBe(true);
    await page.evaluate(() => { document.body.style.background = '#000';
      document.querySelectorAll('video').forEach((v) => { v.style.display = 'none'; }); });

    await page.locator('.mf-slider').click();
    await expect.poll(() => page.evaluate(() => {
      const stage = /** @type {any} */ (document.getElementById('mf-stage'));
      return stage && stage.object3D ? stage.object3D.children.length : 0;
    })).toBeGreaterThan(0);
    await page.waitForTimeout(600);
    const before = PNG.sync.read(await page.screenshot());

    // Mouse drag pans the content (keeps it on screen, does not orbit away)
    await page.mouse.move(640, 360);
    await page.mouse.down();
    await page.mouse.move(480, 470, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    const nav1 = await page.evaluate(() => /** @type {any} */ (window)._mfNav);
    expect(nav1.panX).toBeLessThan(0);
    expect(nav1.panY).toBeLessThan(0);
    const afterDrag = PNG.sync.read(await page.screenshot());
    expect(diffRatio(before, afterDrag), 'drag moves the content').toBeGreaterThan(0.002);

    // Arrow keys pan too (handled on window, no focus needed)
    for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
    for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(200);
    const nav2 = await page.evaluate(() => /** @type {any} */ (window)._mfNav);
    expect(nav2.panX).toBeGreaterThan(nav1.panX);
    expect(nav2.panY).toBeGreaterThan(nav1.panY);

    // Toggling off resets navigation and ignores further input
    await page.locator('.mf-slider').click();
    await page.waitForTimeout(300);
    const navOff = await page.evaluate(() => /** @type {any} */ (window)._mfNav);
    expect(navOff).toEqual({ panX: 0, panY: 0, dist: 0 });
    for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
    const navFixed = await page.evaluate(() => /** @type {any} */ (window)._mfNav);
    expect(navFixed.panX, 'keys do nothing when marker-free is off').toBe(0);
  });

  test('FDAR spec features render (HUD, visibility, instruments, bindings)', async ({ page }) => {
    test.slow();
    await page.goto('/static-html/spec_features.html');
    await expect(page).toHaveTitle('Spec Features');

    // viewdisplay/viewswitch HUD with the initial view name
    await expect(page.locator('#view-hud')).toBeVisible();
    await expect(page.locator('#view-name')).toHaveText('main');

    await expect(page.locator('a-scene')).toBeAttached();
    await expect.poll(() => page.evaluate(() => {
      const n = /** @type {any} */ (document.querySelector('[fdar-visibility]'));
      return !!(n && n.object3D);
    }), { timeout: 30_000 }).toBe(true);

    const effectiveVisible = (label) => page.evaluate((value) => {
      const el = /** @type {any} */ (Array.from(document.querySelectorAll('a-text'))
        .find((t) => t.getAttribute('value') === value));
      if (!el) return 'missing';
      let o = el.object3D;
      while (o) { if (o.visible === false) return false; o = o.parent; }
      return true;
    }, label);

    // Literal show="false" and collapse="true" (strict spec semantics)
    await expect.poll(() => effectiveVisible('statically hidden')).toBe(false);
    await expect.poll(() => effectiveVisible('collapsed subtree')).toBe(false);

    // Transform bindings: @anim: shorthand and single-keyframe ANIMATION
    await expect(page.locator('[fdar-bind]')).toHaveCount(2);
    await expect(page.locator('[fdar-bind]').first()).toHaveAttribute('fdar-bind', /tx: bound_tx:2/);
    await expect(page.locator('[fdar-bind]').last()).toHaveAttribute('fdar-bind', /ty: bound_ty/);

    // Instruments and effect markup
    await expect(page.locator('[fdar-counter]')).toBeAttached();
    await expect.poll(() => page.evaluate(() => {
      const c = document.querySelector('[fdar-counter]');
      const texts = c ? Array.from(c.querySelectorAll('a-text')).map((t) => t.getAttribute('value')) : [];
      return texts.join('|');
    })).toContain('012');
    await expect(page.locator('[fdar-vumeter]')).toBeAttached();
    await expect(page.locator('a-cone')).toHaveCount(2);
    await expect(page.locator('[fdar-touch]')).toHaveAttribute('fdar-touch', /rotate: true/);
    await expect(page.locator('#fdar-virtual-vt1')).toBeAttached();

    // TEXT backrgba builds a sized background plane once the font loads
    await expect.poll(() => page.evaluate(() =>
      document.querySelectorAll('a-plane.fdar-text-bg').length
    ), { timeout: 30_000 }).toBeGreaterThan(0);

    // viewswitch: stepping views updates the HUD
    await page.locator('#view-next').click();
    await expect(page.locator('#view-name')).toHaveText('alt');
  });

  test('AR marker scene has marker and model markup', async ({ page }) => {
    // DOM-structure assertions only: the AR.js webcam pipeline needs real
    // camera input, which the fake media stream stands in for
    await page.goto('/static-html/model_ar.html');
    const scene = page.locator('a-scene');
    await expect(scene).toBeAttached();
    await expect(scene).toHaveAttribute('embedded', 'embedded');
    await expect(scene).toHaveAttribute('arjs', /sourceType: webcam/);

    // Test scenes use the printable AR.js built-in marker, not a .patt file
    const marker = page.locator('a-marker');
    await expect(marker).toHaveAttribute('preset', 'hiro');
    await expect(marker).not.toHaveAttribute('url', /.*/);
    await expect(page.locator('a-entity[gltf-model]')).toHaveAttribute('gltf-model',
      'https://festodidacticsw.azurewebsites.net/ar/cp-cloud_om/obj/arrow_blue.glb');
  });

  test('hiro marker: the 2x2 menu fits inside the black square', async ({ page }) => {
    await page.goto('/static-html/marker_menu.html');
    await expect(page.locator('a-marker[preset="hiro"]')).toBeAttached();
    await expect(page.locator('a-marker [navigate-on-click]')).toHaveCount(4);
    await expect(page.locator('a-scene canvas')).toBeAttached({ timeout: 30_000 });

    // World-space bounds of the marker's children, in marker units (the hiro
    // black square spans ±0.5 around the marker origin on X and Z).
    const box = await page.evaluate(() => {
      const marker = /** @type {any} */ (document.querySelector('a-marker'));
      const THREE = /** @type {any} */ (window).AFRAME.THREE;
      const b = new THREE.Box3().setFromObject(marker.object3D);
      return { minX: b.min.x, maxX: b.max.x, minZ: b.min.z, maxZ: b.max.z, empty: b.isEmpty() };
    });
    expect(box.empty).toBe(false);
    for (const v of [box.minX, box.maxX, box.minZ, box.maxZ]) {
      expect(Math.abs(v)).toBeLessThanOrEqual(0.5);
    }
  });

  test('marker cursor raycasts stay aligned when AR.js overrides the projection', async ({ page }) => {
    // Regression for the click-offset bug: AR.js rewrites camera.projectionMatrix
    // every frame but never refreshes projectionMatrixInverse, so THREE's
    // unproject read a stale inverse and hover/click landed beside the target.
    // The fix refreshes the inverse at raycast time.
    await page.goto('/static-html/marker_click.html');
    await expect(page.locator('a-scene')).toBeAttached();
    await expect(page.locator('.clickable')).toBeAttached({ timeout: 20_000 });
    await expect
      .poll(() => page.evaluate(() => !!(document.querySelector('a-scene')?.camera), {}), { timeout: 20_000 })
      .toBe(true);

    const r = await page.evaluate(() => {
      const THREE = /** @type {any} */ (window).AFRAME.THREE;
      const cam = /** @type {any} */ (document.querySelector('a-scene')).camera;
      // Simulate AR.js: overwrite the projection, leaving the inverse stale
      cam.projectionMatrix.elements[0] *= 1.7;
      cam.projectionMatrix.elements[5] *= 1.7;
      const stale = cam.projectionMatrixInverse.elements.slice();
      const rc = new THREE.Raycaster();
      rc.setFromCamera(new THREE.Vector2(0.3, -0.2), cam); // goes through the patched path
      const after = cam.projectionMatrixInverse.elements.slice();
      const expected = cam.projectionMatrix.clone().invert().elements;
      return {
        patched: /** @type {any} */ (window)._fdarRaycastPatched === true,
        refreshed: after.some((v, i) => Math.abs(v - stale[i]) > 1e-9),
        matches: after.every((v, i) => Math.abs(v - expected[i]) < 1e-9),
      };
    });
    expect(r.patched, 'raycaster patch installed').toBe(true);
    expect(r.refreshed, 'inverse refreshed after projection change').toBe(true);
    expect(r.matches, 'inverse matches the live projection').toBe(true);
  });
});
