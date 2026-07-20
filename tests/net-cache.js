// @ts-check
// On-demand network layer for the Playwright suite.
//
// The generated pages and the editor reference everything by its real internet
// URL (CDN libraries, Festo scene assets, the CORS proxy) — nothing is
// pre-fetched. In tests every https:// request is intercepted, fetched once
// Node-side (no CORS restrictions) into a disk cache, and answered with a
// redirect to the local static server which replays the cached body with CORS
// headers. The redirect matters: fulfilling multi-megabyte bodies over the
// CDP pipe delays every other fulfillment past Chromium's request timeout
// (textures then 408 and A-Frame drops them).
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const CACHE_DIR = path.resolve(__dirname, '..', 'node_modules', '.cache', 'ar-net');
const LOCAL_BASE = 'http://localhost:8321/__netcache/';

// 4×4 opaque white PNG — a missing texture must stay visible (a transparent
// one would blank the pixel-diff renders). Same rationale as static-server.
const PLACEHOLDER_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAGUlEQVR4AWP8DwQMSICJAQ0wMaABJgY0AAAGXQQEOHaWpAAAAABJRU5ErkJggg==',
  'base64'
);

const MIME_BY_EXT = {
  '.js': 'text/javascript', '.json': 'application/json', '.xml': 'application/xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.obj': 'text/plain', '.mtl': 'text/plain',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.patt': 'text/plain',
  '.mp4': 'video/mp4', '.pdf': 'application/pdf', '.html': 'text/html', '.htm': 'text/html',
};

/** The URL a request is really after (unwraps the allorigins CORS proxy). */
function targetOf(url) {
  const m = url.match(/^https:\/\/api\.allorigins\.win\/raw\?url=(.+)$/);
  return m ? decodeURIComponent(m[1]) : url;
}

function cachePaths(url) {
  const key = crypto.createHash('sha1').update(url).digest('hex');
  return { key, body: path.join(CACHE_DIR, key), meta: path.join(CACHE_DIR, key + '.meta') };
}

async function fetchCached(url) {
  const { key, body, meta } = cachePaths(url);
  if (fs.existsSync(body) && fs.existsSync(meta)) {
    return { key, buf: fs.readFileSync(body), ...JSON.parse(fs.readFileSync(meta, 'utf8')) };
  }
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url, { redirect: 'follow' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const buf = Buffer.from(await r.arrayBuffer());
      const contentType = r.headers.get('content-type') ||
        MIME_BY_EXT[path.extname(new URL(url).pathname).toLowerCase()] || 'application/octet-stream';
      fs.mkdirSync(CACHE_DIR, { recursive: true });
      fs.writeFileSync(body, buf);
      fs.writeFileSync(meta, JSON.stringify({ contentType }));
      return { key, buf, contentType };
    } catch (e) {
      lastErr = e;
      await new Promise((res) => setTimeout(res, 700 * (attempt + 1)));
    }
  }
  throw lastErr;
}

/**
 * Intercept every https:// GET in the context: make sure it is in the disk
 * cache, then redirect the browser to the static server's /__netcache/ replay
 * (plain local HTTP with CORS + Range support — no CDP payload).
 * Missing/unreachable *assets* degrade to a placeholder so a flaky texture
 * host cannot fail CI; scripts and documents propagate the failure.
 */
async function installNetCache(context) {
  await context.route(/^https:\/\//, async (route) => {
    // Answer CORS preflights locally — falling back would send the OPTIONS
    // to the real internet, where it can hang and starve the actual GET
    if (route.request().method() === 'OPTIONS') {
      return route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET, HEAD, OPTIONS',
          'access-control-allow-headers': '*',
        },
      });
    }
    if (route.request().method() !== 'GET') return route.fallback();
    const url = targetOf(route.request().url());
    try {
      const { key, buf, contentType } = await fetchCached(url);
      if (buf.length > 2 * 1024 * 1024) {
        // Big bodies (videos, models) would clog the CDP pipe and 408 every
        // other pending fulfillment — hand them off to the local server
        await route.fulfill({
          status: 302,
          headers: { location: LOCAL_BASE + key, 'access-control-allow-origin': '*' },
        });
        return;
      }
      await route.fulfill({
        body: buf,
        headers: { 'content-type': contentType, 'access-control-allow-origin': '*' },
      });
    } catch (e) {
      const ext = path.extname(new URL(url).pathname).toLowerCase();
      if (['.png', '.jpg', '.jpeg', '.gif'].includes(ext)) {
        await route.fulfill({
          body: PLACEHOLDER_PNG,
          headers: { 'content-type': 'image/png', 'access-control-allow-origin': '*' },
        });
      } else {
        await route.abort('failed');
      }
    }
  });
}

module.exports = { installNetCache, fetchCached, CACHE_DIR };
