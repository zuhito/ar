// @ts-check
// AR regression guard for the real published scenes.
//
// The other suite (marker-ar.spec.js) feeds each marker to a synthetic
// one-node scene and reveals the augmentation with the marker-free preview.
// This suite instead loads the ACTUAL scene HTML that GitHub Pages serves
// (ar-scenes/MPRESSV2.html) with the marker fed as the webcam, and asserts the
// two things that have silently regressed before:
//
//   1. AR.js loads and DETECTS the marker (the whole library once stopped
//      loading because it was pinned to an uncached raw.githack.com/master
//      URL — the page went blank with no video and no detection).
//   2. The augmentation actually lands ON the marker in AR mode — in front of
//      the camera and inside the frustum — not stuck at the camera origin or
//      clipped (an a-camera left at A-Frame's default 1.6 eye-height once put
//      the whole menu off-screen even though detection was fine).
//
// Marker presence is logged to the console each poll ("marker present: cf=…"),
// so a failing run shows exactly whether detection or placement broke.
const { test, expect, chromium } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { buildY4m } = require('./make-fake-cam.js');

const ROOT = path.resolve(__dirname, '..');
const CAM_DIR = path.join(__dirname, 'fake-cam');

// Scene HTML under ar-scenes/ paired with the marker image that unlocks it.
const CASES = [
  { scene: 'ar-scenes/MPRESSV2.html', marker: 'marker/CP-AM-MPRESS-V2_01.png', name: 'MPRESS-V2' },
];

test.describe('AR scene renders on its marker', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 });

  test.beforeAll(() => { fs.mkdirSync(CAM_DIR, { recursive: true }); });

  for (const c of CASES) {
    test(`${c.name}: detected and drawn on the marker`, async ({ baseURL }) => {
      const y4m = path.join(CAM_DIR, c.name + '.render.y4m');
      buildY4m(path.join(ROOT, c.marker), y4m, { target: 380 });
      const browser = await chromium.launch({
        args: [
          '--use-fake-ui-for-media-stream',
          '--use-fake-device-for-media-stream',
          '--use-file-for-fake-video-capture=' + y4m,
          '--enable-unsafe-swiftshader',
          '--no-sandbox',
        ],
      });
      try {
        const page = await browser.newPage();
        page.on('console', (m) => { if (/marker present|AR-RENDER/.test(m.text())) console.log('  [page]', m.text()); });
        await page.goto(`${baseURL}/${c.scene}`, { waitUntil: 'domcontentloaded' });

        // (1) AR.js must load and the marker be detected from the fed frames.
        await expect.poll(() => page.evaluate(() => {
          const m = document.querySelector('a-marker');
          if (!m || !m.components || !m.components['arjs-anchor']) return 0;
          try {
            const arc = m.components['arjs-anchor']._arAnchor.controls.context.arController;
            let cf = 0; const n = arc.getMarkerNum();
            for (let i = 0; i < n; i++) { const mk = arc.getMarker(i); if (mk && mk.cf > cf) cf = mk.cf; }
            console.log('marker present: ' + (n > 0) + ' cf=' + cf.toFixed(3));
            return cf;
          } catch (e) { return 0; }
        }), { timeout: 40_000, message: `${c.name}: AR.js never loaded or marker never detected` }).toBeGreaterThan(0.5);

        // (2) A visible augmentation mesh must land on the marker: in front of
        // the camera (view-space z < 0) and inside the frustum (|ndc| <= 1).
        await expect.poll(() => page.evaluate(() => {
          const sc = document.querySelector('a-scene');
          const m = document.querySelector('a-marker');
          if (!sc || !sc.camera || !m || !m.object3D.visible) return false;
          sc.object3D.updateMatrixWorld(true);
          const cam = sc.camera;
          let ok = false;
          m.object3D.traverse((o) => {
            if (ok || !o.isMesh || !o.visible) return;
            if (o.material && o.material.colorWrite === false) return; // occluder
            let p = o, vis = true;
            while (p) { if (!p.visible) { vis = false; break; } p = p.parent; }
            if (!vis) return;
            const pw = new THREE.Vector3(); o.getWorldPosition(pw);
            const camZ = cam.worldToLocal(pw.clone()).z;
            const ndc = pw.clone().project(cam);
            // In front of the camera and within the screen rectangle. ndc.z is
            // NOT a useful clip test here: AR.js's projection uses a near plane
            // of ~0.0001, so depth non-linearity pins any real-distance point to
            // ndc.z ≈ 1 (never actually clipped — camZ<0 already means visible).
            if (camZ < 0 && Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1) ok = true;
          });
          console.log('AR-RENDER on-marker placement ok=' + ok);
          return ok;
        }), { timeout: 15_000, message: `${c.name}: augmentation not rendered on the marker (off-screen/clipped)` }).toBe(true);
      } finally {
        await browser.close();
      }
    });
  }
});
