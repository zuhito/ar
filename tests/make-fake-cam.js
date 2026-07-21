// @ts-check
// Turn a printable AR.js pattern marker (marker/<name>.png) into a Y4M video
// clip usable as Chromium's fake webcam
// (--use-file-for-fake-video-capture=<file>.y4m). AR.js/artoolkit then detects
// the marker from the fed frames exactly as it would from a live camera, so the
// headless tests exercise the real marker pipeline — not the marker-free preview.
//
// The bundled Playwright ffmpeg is a minimal build with no PNG decoder, so the
// clip is assembled here with pngjs: the marker is nearest-neighbour scaled onto
// a white canvas (the quiet zone artoolkit needs around the black border) and
// written as planar YUV420 (I420) frames.
const fs = require('node:fs');
const path = require('node:path');
const { PNG } = require('pngjs');

/**
 * Nearest-neighbour scale of an RGBA PNG onto a WxH canvas, centred.
 * The backdrop defaults to a light grey (not white) so that white augmentation
 * text/geometry stays visible in the screenshot while still reading as the
 * bright "quiet zone" artoolkit needs around the black marker border.
 */
function compose(src, W, H, target, bg = 0xc8) {
  const canvas = Buffer.alloc(W * H * 3, bg);
  const scale = target / Math.max(src.width, src.height);
  const dw = Math.round(src.width * scale);
  const dh = Math.round(src.height * scale);
  const ox = (W - dw) >> 1;
  const oy = (H - dh) >> 1;
  for (let y = 0; y < dh; y++) {
    const sy = Math.min(src.height - 1, Math.floor(y / scale));
    for (let x = 0; x < dw; x++) {
      const sx = Math.min(src.width - 1, Math.floor(x / scale));
      const si = (sy * src.width + sx) * 4;
      const a = src.data[si + 3] / 255;
      const di = ((oy + y) * W + (ox + x)) * 3;
      // Alpha-composite over the backdrop
      canvas[di] = Math.round(src.data[si] * a + bg * (1 - a));
      canvas[di + 1] = Math.round(src.data[si + 1] * a + bg * (1 - a));
      canvas[di + 2] = Math.round(src.data[si + 2] * a + bg * (1 - a));
    }
  }
  return canvas;
}

/** RGB packed buffer -> planar I420 (YUV420) for one frame. */
function rgbToI420(rgb, W, H) {
  const ySize = W * H;
  const cSize = (W >> 1) * (H >> 1);
  const out = Buffer.alloc(ySize + 2 * cSize);
  const U = ySize, V = ySize + cSize;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      const r = rgb[i], g = rgb[i + 1], b = rgb[i + 2];
      out[y * W + x] = Math.max(0, Math.min(255, Math.round(0.299 * r + 0.587 * g + 0.114 * b)));
      if ((y & 1) === 0 && (x & 1) === 0) {
        const ci = (y >> 1) * (W >> 1) + (x >> 1);
        out[U + ci] = Math.max(0, Math.min(255, Math.round(-0.169 * r - 0.331 * g + 0.5 * b + 128)));
        out[V + ci] = Math.max(0, Math.min(255, Math.round(0.5 * r - 0.419 * g - 0.081 * b + 128)));
      }
    }
  }
  return out;
}

/**
 * Write a Y4M clip for one marker PNG.
 * @param {string} pngPath source marker image
 * @param {string} outPath destination .y4m
 * @param {{W?:number,H?:number,target?:number,frames?:number,fps?:number}} [opt]
 */
function buildY4m(pngPath, outPath, opt = {}) {
  const W = opt.W || 640, H = opt.H || 480;
  const target = opt.target || 360, frames = opt.frames || 20, fps = opt.fps || 15;
  const src = PNG.sync.read(fs.readFileSync(pngPath));
  const rgb = compose(src, W, H, target);
  const frame = rgbToI420(rgb, W, H);
  const fd = fs.openSync(outPath, 'w');
  fs.writeSync(fd, `YUV4MPEG2 W${W} H${H} F${fps}:1 Ip A1:1 C420jpeg\n`);
  for (let i = 0; i < frames; i++) {
    fs.writeSync(fd, 'FRAME\n');
    fs.writeSync(fd, frame);
  }
  fs.closeSync(fd);
  return outPath;
}

module.exports = { buildY4m };

// CLI: node make-fake-cam.js <marker.png> <out.y4m>
if (require.main === module) {
  const [, , src, out] = process.argv;
  if (!src || !out) { console.error('usage: make-fake-cam.js <marker.png> <out.y4m>'); process.exit(1); }
  buildY4m(path.resolve(src), path.resolve(out));
  console.log('wrote', out);
}
