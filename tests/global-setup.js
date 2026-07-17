// @ts-check
// Pre-generates static HTML from tests/scenes/*.xml with xsltproc, mirroring
// the offline workflow: xsltproc aframe.xsl scene.xml > scene.html
// The results are served alongside the app and exercised by static.spec.js.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

module.exports = async () => {
  try {
    execFileSync('xsltproc', ['--version'], { stdio: 'pipe' });
  } catch (e) {
    throw new Error('xsltproc is required for the static-generation tests (apt-get install xsltproc)');
  }

  const root = path.resolve(__dirname, '..');
  const scenesDir = path.join(__dirname, 'scenes');
  const outDir = path.join(root, 'static-html');
  fs.mkdirSync(outDir, { recursive: true });

  for (const file of fs.readdirSync(scenesDir).filter((f) => f.endsWith('.xml'))) {
    const html = execFileSync('xsltproc', [path.join(root, 'aframe.xsl'), path.join(scenesDir, file)]);
    fs.writeFileSync(path.join(outDir, file.replace(/\.xml$/, '.html')), html);
  }
};
