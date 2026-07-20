// Static file server for the Playwright suite.
//
// It serves the repository exactly like GitHub Pages, with one addition: the
// xsltproc-generated preview pages (static-html/, static-live/) reference Festo
// scene assets by relative paths (images/, obj/, targets/*.patt, …) that the
// slow, CORS-less Festo host provides but our local mirror only partially
// carries. Rather than 404 on every missing texture — which floods the CI log
// and looks like a failure — we return a harmless in-memory placeholder for
// missing *asset* files (images, models, patterns, videos, fonts). Missing
// pages/scripts/data (.html/.js/.css/.xml/.json-data) still 404 so genuine
// bugs surface. fdar-texture-guard already drops placeholder textures at
// runtime, so the visual output is unchanged.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 8321);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.xsl': 'application/xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.obj': 'text/plain; charset=utf-8',
  '.mtl': 'text/plain; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.patt': 'text/plain; charset=utf-8',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.m4v': 'video/mp4',
  '.pdf': 'application/pdf',
};

// 4×4 opaque white PNG. Opaque (not transparent) on purpose: a transparent
// placeholder loads as a valid texture and turns textured meshes invisible,
// which would blank the marker-free render the pixel-diff tests rely on. White
// keeps them visible and lets any tint multiply through.
const PLACEHOLDER_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAGUlEQVR4AWP8DwQMSICJAQ0wMaABJgY0AAAGXQQEOHaWpAAAAABJRU5ErkJggg==',
  'base64'
);
// A 16×16 all-zero AR.js pattern: four orientations, each three RGB planes of
// sixteen rows — parses without error, never matches anything (fine headless).
const PATT_BODY = (() => {
  const line = new Array(16).fill('0').map((v) => v.padStart(3, ' ')).join(' ') + '\n';
  const block = line.repeat(16);
  return (block + block + block).repeat(4);
})();

const ASSET_PLACEHOLDER = {
  '.png': () => PLACEHOLDER_PNG,
  '.jpg': () => PLACEHOLDER_PNG,
  '.jpeg': () => PLACEHOLDER_PNG,
  '.gif': () => PLACEHOLDER_PNG,
  '.svg': () => Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'),
  '.obj': () => Buffer.from('# placeholder\n'),
  '.mtl': () => Buffer.from('# placeholder\n'),
  '.glb': () => Buffer.alloc(0),
  '.gltf': () => Buffer.from('{"asset":{"version":"2.0"},"scenes":[],"nodes":[]}'),
  '.patt': () => Buffer.from(PATT_BODY),
  '.mp4': () => Buffer.alloc(0),
  '.webm': () => Buffer.alloc(0),
  '.m4v': () => Buffer.alloc(0),
  '.pdf': () => Buffer.alloc(0),
};

const { CACHE_DIR, fetchCached } = require('./net-cache.js');

// Same-origin CORS proxy (/proxy?url=<encoded>) — the tests point the app's
// CORS_PROXY here so cross-origin scene assets arrive without preflights,
// interception or the public allorigins service. Content comes from the
// net-cache disk cache (fetched once, node-side).
function serveProxy(req, res, rawUrl) {
  let url;
  try { url = decodeURIComponent(rawUrl); } catch (e) { url = rawUrl; }
  fetchCached(url).then(({ buf, contentType }) => {
    sendRanged(req, res, buf, contentType);
  }).catch(() => {
    const ext = path.extname(url.split('?')[0]).toLowerCase();
    const placeholder = ASSET_PLACEHOLDER[ext];
    if (placeholder) {
      const body = placeholder();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Content-Length': body.length });
      res.end(body);
    } else {
      res.writeHead(502).end('proxy failure: ' + url);
    }
  });
}

function sendRanged(req, res, buf, contentType) {
  const headers = {
    'Content-Type': contentType || 'application/octet-stream',
    'Access-Control-Allow-Origin': '*',
    'Accept-Ranges': 'bytes',
  };
  const m = (req.headers.range || '').match(/bytes=(\d+)-(\d*)/);
  if (m) {
    const start = Number(m[1]);
    const end = m[2] ? Math.min(Number(m[2]), buf.length - 1) : buf.length - 1;
    headers['Content-Range'] = `bytes ${start}-${end}/${buf.length}`;
    buf = buf.subarray(start, end + 1);
    headers['Content-Length'] = buf.length;
    res.writeHead(206, headers);
  } else {
    headers['Content-Length'] = buf.length;
    res.writeHead(200, headers);
  }
  if (req.method === 'HEAD') res.end(); else res.end(buf);
}

// Replay a net-cache entry (/__netcache/<sha1>) with CORS and Range support.
// The Playwright route layer redirects intercepted internet URLs here so
// large bodies (videos, models) never travel over the CDP pipe.
function serveNetCache(req, res, key) {
  if (!/^[0-9a-f]{40}$/.test(key)) { res.writeHead(400).end('bad key'); return; }
  let buf, meta;
  try {
    buf = fs.readFileSync(path.join(CACHE_DIR, key));
    meta = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, key + '.meta'), 'utf8'));
  } catch (e) {
    res.writeHead(404).end('no cache entry');
    return;
  }
  sendRanged(req, res, buf, meta.contentType);
}

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath.startsWith('/__netcache/')) return serveNetCache(req, res, urlPath.slice('/__netcache/'.length));
  if (urlPath === '/proxy') return serveProxy(req, res, ((req.url || '').split('?url=')[1] || ''));
  const isDir = urlPath.endsWith('/');
  const rel = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  let filePath = path.join(ROOT, rel);
  if (!filePath.startsWith(ROOT)) { res.writeHead(403).end('Forbidden'); return; }
  // Directory request: serve index.html, then index.htm (GitHub Pages / python
  // http.server both fall back this way; the app's entry point is index.htm)
  if (isDir) {
    const html = path.join(filePath, 'index.html');
    filePath = fs.existsSync(html) ? html : path.join(filePath, 'index.htm');
  }

  const ext = path.extname(filePath).toLowerCase();
  const send = (status, body, type) => {
    res.writeHead(status, { 'Content-Type': type || 'application/octet-stream', 'Content-Length': body.length });
    if (req.method === 'HEAD') { res.end(); } else { res.end(body); }
  };

  fs.readFile(filePath, (err, data) => {
    if (!err) { send(200, data, MIME[ext] || 'application/octet-stream'); return; }
    const placeholder = ASSET_PLACEHOLDER[ext];
    if (placeholder) { send(200, placeholder(), MIME[ext] || 'application/octet-stream'); return; }
    send(404, Buffer.from('Not found: ' + rel), 'text/plain; charset=utf-8');
  });
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log('static-server listening on http://localhost:' + PORT + ' (root: ' + ROOT + ')');
});
