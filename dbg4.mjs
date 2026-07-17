import { chromium } from '@playwright/test';
const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.goto('http://localhost:8321/static-live/cp-cloud_om_CP-AM-DRILL_01.html');
await page.waitForTimeout(5000);
await page.locator('.mf-slider').click();
await page.waitForTimeout(1200);
const info = await page.evaluate(() => {
  const scene = document.querySelector('a-scene');
  const stage = document.getElementById('mf-stage');
  const canvas = scene.canvas;
  const r = scene.renderer;
  const cam = scene.camera;
  return {
    render: r ? { triangles: r.info.render.triangles, calls: r.info.render.calls, frame: r.info.render.frame } : null,
    canvasSize: canvas ? [canvas.width, canvas.height, canvas.style.width, canvas.style.height] : null,
    canvasDisplay: canvas ? getComputedStyle(canvas).display : null,
    sceneVisible: scene.object3D.visible,
    stageVisible: stage.object3D.visible,
    stageWorld: stage.object3D.matrixWorld.elements.map(n=>+n.toFixed(2)),
    isPlaying: scene.isPlaying,
    time: scene.time,
    camParent: cam.parent && cam.parent.type,
    camProjection: cam.projectionMatrix.elements.slice(0,4).map(n=>+n.toFixed(3)),
    camWorldInv: cam.matrixWorldInverse.elements.slice(12,15).map(n=>+n.toFixed(2)),
    activeCameraEl: scene.camera.el && scene.camera.el.tagName,
  };
});
console.log(JSON.stringify(info, null, 1));
await browser.close();
