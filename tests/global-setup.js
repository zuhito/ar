// @ts-check
// Pre-generates static HTML from the embedded test scenes (tests/fixtures.js)
// with xsltproc, mirroring the offline workflow:
//   xsltproc aframe.xsl scene.xml > scene.html
// Both the XML and the generated HTML land in static-html/ (the XMLs double as
// URL-loading fixtures for the editor tests). The pages keep their real CDN
// URLs — tests fetch them on demand through tests/net-cache.js.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { SCENES } = require('./fixtures.js');

module.exports = async () => {
  try {
    execFileSync('xsltproc', ['--version'], { stdio: 'pipe' });
  } catch (e) {
    throw new Error('xsltproc is required for the static-generation tests (apt-get install xsltproc)');
  }

  const root = path.resolve(__dirname, '..');
  const outDir = path.join(root, 'static-html');
  fs.mkdirSync(outDir, { recursive: true });

  // Solid-red 64x64 PNG used by the viewer_local scene's pixel-proof test
  fs.writeFileSync(path.join(outDir, 'test-image.png'), Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAb0lEQVR4nO3PAQkAAAyEwO9feoshgnABdLep8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3IPanc8OLDQitxAAAAAElFTkSuQmCC',
    'base64'
  ));

  for (const [name, xml] of Object.entries(SCENES)) {
    const xmlPath = path.join(outDir, name + '.xml');
    fs.writeFileSync(xmlPath, xml);
    const html = execFileSync('xsltproc', ['--stringparam', 'assetbase', '', path.join(root, 'aframe.xsl'), xmlPath], { maxBuffer: 64 * 1024 * 1024 }).toString();
    fs.writeFileSync(path.join(outDir, name + '.html'), html);
  }
};
