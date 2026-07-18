// @ts-check
// Pre-generates static HTML from every XML under tests/scenes/ (recursively)
// with xsltproc, mirroring the offline workflow:
//   xsltproc aframe.xsl scene.xml > scene.html
// Output lands in static-html/ preserving the directory layout, and is
// exercised by static.spec.js. A scene that fails to transform fails setup.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function collectXml(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectXml(p));
    else if (entry.name.endsWith('.xml')) out.push(p);
  }
  return out;
}

module.exports = async () => {
  try {
    execFileSync('xsltproc', ['--version'], { stdio: 'pipe' });
  } catch (e) {
    throw new Error('xsltproc is required for the static-generation tests (apt-get install xsltproc)');
  }

  const root = path.resolve(__dirname, '..');
  const scenesDir = path.join(__dirname, 'scenes');
  const outDir = path.join(root, 'static-html');

  for (const file of collectXml(scenesDir)) {
    const rel = path.relative(scenesDir, file);
    let html = execFileSync('xsltproc', [path.join(root, 'aframe.xsl'), file], { maxBuffer: 64 * 1024 * 1024 }).toString();
    // Local vendor copies keep the tests fast and network-independent
    html = html
      .replace('https://aframe.io/releases/1.7.1/aframe.min.js', '/vendor/aframe.min.js')
      .replace('https://raw.githack.com/AR-js-org/AR.js/master/aframe/build/aframe-ar.js', '/vendor/aframe-ar.js')
      .replace(/<a-text /g, '<a-text font="/vendor/Roboto-msdf.json" shader="msdf" negate="false" ');
    const target = path.join(outDir, rel.replace(/\.xml$/, '.html'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, html);
  }
};
