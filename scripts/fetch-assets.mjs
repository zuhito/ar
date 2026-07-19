// On-demand asset fetcher.
//
// The repository does not commit files that originate on the internet — the
// vendored libraries (A-Frame, AR.js, xslt-processor, jsQR, the Roboto MSDF
// font), the Festo sample scene XMLs, and the mirrored Festo scene assets.
// This script downloads the current versions of all of them into their working
// locations on demand. It is idempotent (skips files already present) and is
// run automatically before the test suite (tests/global-setup.js) and can be
// run by hand: `node scripts/fetch-assets.mjs [--force]`.
//
// assets-manifest.json lists every file and its upstream URL, split into:
//   required   — libraries and scene XMLs; a failure here fails the run
//   bestEffort — mirrored scene assets; misses are tolerated (the test static
//                server serves placeholders, and the deployed app never fetches
//                these CORS-less hosts from the browser anyway)
//   generated  — files we synthesise locally (e.g. the red test image)
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FORCE = process.argv.includes('--force');

async function exists(p) {
  try { await access(p, constants.F_OK); return true; } catch { return false; }
}

async function download(url, dest, { required }) {
  const abs = path.join(ROOT, dest);
  if (!FORCE && (await exists(abs))) return 'skip';
  await mkdir(path.dirname(abs), { recursive: true });
  let lastErr;
  for (let attempt = 0; attempt < (required ? 4 : 2); attempt++) {
    try {
      const r = await fetch(url, { redirect: 'follow' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const buf = Buffer.from(await r.arrayBuffer());
      await writeFile(abs, buf);
      return 'ok';
    } catch (e) {
      lastErr = e;
      await new Promise((res) => setTimeout(res, 800 * (attempt + 1)));
    }
  }
  if (required) throw new Error(dest + ' <- ' + url + ' : ' + lastErr.message);
  return 'miss';
}

// A 64×64 solid red PNG, matching what the viewer_local test expects.
function redPng(size) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0; // filter byte
    for (let x = 0; x < size; x++) {
      const o = y * (size * 3 + 1) + 1 + x * 3;
      raw[o] = 255; raw[o + 1] = 0; raw[o + 2] = 0;
    }
  }
  const idat = zlib.deflateSync(raw);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit, truecolor
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0)),
  ]);
}
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
  }
  return ~c;
}

async function main() {
  const manifest = JSON.parse(await readFile(path.join(ROOT, 'assets-manifest.json'), 'utf8'));
  const pool = async (items, fn, limit = 12) => {
    let i = 0; const out = [];
    const workers = Array.from({ length: limit }, async () => {
      while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx]); }
    });
    await Promise.all(workers);
    return out;
  };

  const req = await pool(manifest.required || [], (f) => download(f.url, f.path, { required: true }));
  const best = await pool(manifest.bestEffort || [], (f) => download(f.url, f.path, { required: false }));

  for (const g of manifest.generated || []) {
    const abs = path.join(ROOT, g.path);
    if (FORCE || !(await exists(abs))) {
      await mkdir(path.dirname(abs), { recursive: true });
      if (g.kind === 'red64') await writeFile(abs, redPng(64));
    }
  }

  const count = (arr, v) => arr.filter((x) => x === v).length;
  console.log(
    `required: ${count(req, 'ok')} fetched, ${count(req, 'skip')} cached | ` +
    `mirror: ${count(best, 'ok')} fetched, ${count(best, 'skip')} cached, ${count(best, 'miss')} missing`
  );
}

main().catch((e) => { console.error('fetch-assets failed:', e.message); process.exit(1); });
