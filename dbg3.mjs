import { chromium } from '@playwright/test';
const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.goto('http://localhost:8321/static-live/cp-cloud_om_CP-AM-DRILL_01.html');
await page.waitForTimeout(5000);
await page.locator('.mf-slider').click();
await page.waitForTimeout(1200);
const dump = await page.evaluate(() => {
  const scene = document.querySelector('a-scene');
  const cam = scene.camera;
  const out = { camera: { pos: cam.getWorldPosition(new THREE.Vector3()).toArray().map(n=>+n.toFixed(2)), fov: cam.fov }, meshes: [], currentView: window.fdarCurrentView };
  scene.object3D.updateMatrixWorld(true);
  scene.object3D.traverse((o) => {
    if (!o.isMesh) return;
    let p = o, vis = true;
    while (p) { if (p.visible === false) { vis = false; break; } p = p.parent; }
    if (!vis) return;
    const box = new THREE.Box3().setFromObject(o);
    const size = new THREE.Vector3(); box.getSize(size);
    const center = new THREE.Vector3(); box.getCenter(center);
    out.meshes.push({
      geo: o.geometry && o.geometry.type,
      pos: center.toArray().map(n => +n.toFixed(3)),
      size: size.toArray().map(n => +n.toFixed(4)),
      mat: o.material ? { color: o.material.color && o.material.color.getHexString(), opacity: o.material.opacity, transparent: o.material.transparent, visible: o.material.visible, colorWrite: o.material.colorWrite } : null,
    });
  });
  return out;
});
console.log(JSON.stringify(dump, null, 1).slice(0, 3500));
await browser.close();
