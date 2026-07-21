// @ts-check
// Real marker-based AR verification.
//
// Every printable Vuforia/AR.js marker in marker/ is turned into a fake webcam
// clip (make-fake-cam.js) and fed to Chromium via
// --use-file-for-fake-video-capture. A hand-authored FDAR scene anchors a
// clearly visible augmentation to that marker; the page is the exact
// aframe.xsl output that GitHub Pages serves. AR.js/artoolkit must detect the
// marker from the fed frames — the same pipeline a phone camera drives — and
// each detected result is screenshotted into test-screenshots/marker-ar/ for
// the CI artifact.
//
// Marker patterns are referenced by an absolute /marker/<name>.patt URL so they
// resolve from any served page (a relative marker/… path would resolve against
// the scene's own folder and miss the real file).
const { test, expect, chromium } = require('@playwright/test');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { buildY4m } = require('./make-fake-cam.js');

const ROOT = path.resolve(__dirname, '..');
const MARKER_DIR = path.join(ROOT, 'marker');
const SCENE_DIR = path.join(ROOT, 'static-html');
const CAM_DIR = path.join(__dirname, 'fake-cam');
const SHOT_DIR = path.join(ROOT, 'test-screenshots', 'marker-ar');

/** Every marker that ships both a pattern file and a printable image. */
function markers() {
  return fs.readdirSync(MARKER_DIR)
    .filter((f) => f.endsWith('.patt'))
    .map((f) => f.slice(0, -5))
    .map((name) => {
      const png = path.join(MARKER_DIR, name + '.png');
      const jpg = path.join(MARKER_DIR, name + '.jpg');
      const img = fs.existsSync(png) ? png : (fs.existsSync(jpg) ? jpg : null);
      return img ? { name, img } : null;
    })
    .filter(Boolean);
}

/**
 * An FDAR augmentation anchored to the marker. The pattern URL is absolute so it
 * resolves from the served scene folder to the real marker/ pattern (a relative
 * marker/… path would 404 to the server's never-matching placeholder pattern
 * and drop confidence to zero).
 */
function sceneXml(name) {
  return `<AUGMENTATION>
  <TARGETBASE file="CP-System">
    <TARGET marker="/marker/${name}">
      <NODE tz="0.5" sxyz="3">
        <TEXT label="${name}" />
      </NODE>
    </TARGET>
  </TARGETBASE>
</AUGMENTATION>`;
}

const LIST = markers();

test.describe('marker-based AR rendering', () => {
  // One Chromium at a time: each marker needs its own fake-camera file, and
  // serial keeps the headless GPU/memory footprint small on CI.
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(() => {
    fs.mkdirSync(CAM_DIR, { recursive: true });
    fs.mkdirSync(SCENE_DIR, { recursive: true });
    fs.mkdirSync(SHOT_DIR, { recursive: true });
    for (const { name, img } of LIST) {
      buildY4m(img, path.join(CAM_DIR, name + '.y4m'));
      const xmlPath = path.join(SCENE_DIR, 'marker_' + name + '.xml');
      fs.writeFileSync(xmlPath, sceneXml(name));
      const html = execFileSync('xsltproc',
        ['--stringparam', 'assetbase', '', path.join(ROOT, 'aframe.xsl'), xmlPath],
        { maxBuffer: 64 * 1024 * 1024 }).toString();
      fs.writeFileSync(path.join(SCENE_DIR, 'marker_' + name + '.html'), html);
    }
  });

  test('markers with printable images are present', () => {
    expect(LIST.length, 'no markers with images found').toBeGreaterThan(0);
  });

  for (const { name } of LIST) {
    test(`detects and renders ${name}`, async ({ baseURL }) => {
      const y4m = path.join(CAM_DIR, name + '.y4m');
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
        await page.goto(`${baseURL}/static-html/marker_${name}.html`, { waitUntil: 'domcontentloaded' });
        await page.evaluate(() => {
          window.__found = false;
          const m = document.querySelector('a-marker');
          if (m) m.addEventListener('markerFound', () => { window.__found = true; });
        });

        // artoolkit must detect the marker square AND match its pattern with
        // high confidence — proof the real marker artwork drives the tracking.
        await expect.poll(async () => page.evaluate(() => {
          try {
            const arc = document.querySelector('a-marker')
              .components['arjs-anchor']._arAnchor.controls.context.arController;
            let best = 0;
            const n = arc.getMarkerNum();
            for (let i = 0; i < n; i++) { const mk = arc.getMarker(i); if (mk && mk.cf > best) best = mk.cf; }
            return best;
          } catch (e) { return 0; }
        }), { timeout: 30_000, message: `${name} pattern never matched` }).toBeGreaterThan(0.5);

        // AR.js raises markerFound and shows the anchored content once the
        // smoothed confidence crosses its threshold — poll so markers whose
        // confidence sits just above the bar aren't lost to a one-shot read.
        await expect.poll(() => page.evaluate(() => {
          const m = document.querySelector('a-marker');
          return !!window.__found && !!(m && m.object3D && m.object3D.visible);
        }), { timeout: 15_000, message: `${name} markerFound / visibility never settled` }).toBe(true);

        await page.screenshot({ path: path.join(SHOT_DIR, name + '.png') });
      } finally {
        await browser.close();
      }
    });
  }
});
