// @ts-check
const { test, expect } = require('@playwright/test');

/** Editor value, whether Monaco loaded or the textarea fallback is active. */
function getEditorValue(page) {
  return page.evaluate(() => {
    const w = /** @type {any} */ (window);
    if (w._monacoEditor) return w._monacoEditor.getValue();
    const ta = /** @type {HTMLTextAreaElement} */ (document.getElementById('fallback-editor'));
    return ta.value;
  });
}

/** Set the XML source, triggering the same input pipeline as typing. */
function setEditorValue(page, value) {
  return page.evaluate((v) => {
    const w = /** @type {any} */ (window);
    if (w._monacoEditor) {
      w._monacoEditor.setValue(v);
    } else {
      const ta = /** @type {HTMLTextAreaElement} */ (document.getElementById('fallback-editor'));
      ta.value = v;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, value);
}

/** Generated HTML of the last successful transform. */
function getGeneratedHtml(page) {
  return page.evaluate(() => /** @type {any} */ (window)._popupCode || '');
}

async function openApp(page) {
  await page.goto('/');
  // Tabs render once Monaco (or its textarea fallback) has initialized
  await expect(page.locator('#xml-tab-bar .dtab')).toHaveCount(13);
  await expect.poll(() => getEditorValue(page)).toContain('<AUGMENTATION>');
}

/** Wait until the XML -> HTML transform has produced output. */
async function waitForTransform(page) {
  await expect.poll(() => getGeneratedHtml(page), { timeout: 20_000 }).toContain('<a-scene');
}

test.describe('startup', () => {
  test('loads with default tabs and panes', async ({ page }) => {
    await openApp(page);
    await expect(page).toHaveTitle('AR App Live Editor');
    await expect(page.locator('#xml-tab-bar .dtab.active')).toHaveText(/text/);
    await expect(page.locator('#preview-tab-bar .dtab')).toHaveCount(3);
    // aframe.xsl was fetched, so the drop overlay must stay hidden
    await expect(page.locator('#xsl-drop-overlay')).not.toHaveClass(/show/);
  });

  test('active tab content is shown in the editor', async ({ page }) => {
    await openApp(page);
    const value = await getEditorValue(page);
    expect(value).toContain('<TEXT label="Hello World"');
  });
});

test.describe('transform pipeline', () => {
  test('generates A-Frame HTML from the XML scene', async ({ page }) => {
    await openApp(page);
    await waitForTransform(page);
    const html = await getGeneratedHtml(page);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<a-scene');
    expect(html).toContain('<a-text');
    expect(html).toContain('Hello World');
    expect(html).toContain('<base href=');
  });

  test('AR marker scene generates a-marker markup', async ({ page }) => {
    await openApp(page);
    await page.locator('#xml-tab-bar .dtab', { hasText: 'model_ar' }).locator('.dtab-label').click();
    await expect.poll(() => getEditorValue(page)).toContain('<TARGETBASE');
    await expect.poll(() => getGeneratedHtml(page), { timeout: 20_000 }).toContain('<a-marker');
    const html = await getGeneratedHtml(page);
    // Relative url= attributes are rewritten to absolute against the page base
    expect(html).toMatch(/url="[^"]*marker\/CP-AM-DRILL\.patt"/);
    expect(html).toContain('gltf-model="obj/arrow_blue.glb"');
  });

  test('preview iframe contains the generated scene', async ({ page }) => {
    await openApp(page);
    await waitForTransform(page);
    const frame = page.frameLocator('#preview-iframe');
    await expect(frame.locator('a-scene')).toBeAttached();
    await expect(frame.locator('a-text')).toBeAttached();
  });

  test('invalid XML shows an error page in the preview', async ({ page }) => {
    await openApp(page);
    await waitForTransform(page);
    await setEditorValue(page, '<AUGMENTATION><broken</AUGMENTATION>');
    const frame = page.frameLocator('#preview-iframe');
    await expect(frame.locator('.box')).toContainText('XML Error');
  });
});

test.describe('xml tabs', () => {
  test('clicking a tab switches editor content and persists the choice', async ({ page }) => {
    await openApp(page);
    await page.locator('#xml-tab-bar .dtab', { hasText: 'viewer' }).first().locator('.dtab-label').click();
    await expect(page.locator('#xml-tab-bar .dtab.active')).toHaveText(/viewer/);
    await expect.poll(() => getEditorValue(page)).toContain('<VIEWER');
    const active = await page.evaluate(() => localStorage.getItem('fdar_editor_active_tab'));
    expect(active).toBe('viewer');
  });

  test('arrow keys move between tabs', async ({ page }) => {
    await openApp(page);
    await page.locator('#xml-tab-bar .dtab.active').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#xml-tab-bar .dtab.active')).toHaveAttribute('data-id', 'helloworldar');
    await expect.poll(() => getEditorValue(page)).toContain('<TARGETBASE');
  });

  test('the + button adds a tab and close removes it', async ({ page }) => {
    await openApp(page);
    await page.locator('#xml-add-btn').click();
    await expect(page.locator('#xml-tab-bar .dtab')).toHaveCount(14);
    const added = page.locator('#xml-tab-bar .dtab.active');
    await expect(added).toHaveText(/untitled/);
    await expect.poll(() => getEditorValue(page)).toContain('<AUGMENTATION>');
    await added.locator('.dtab-close').click();
    await expect(page.locator('#xml-tab-bar .dtab')).toHaveCount(13);
  });

  test('double click renames a tab', async ({ page }) => {
    await openApp(page);
    await page.locator('#xml-tab-bar .dtab.active .dtab-label').dblclick();
    const input = page.locator('#xml-tab-bar .rename-input');
    await expect(input).toBeVisible();
    await input.fill('renamed_tab');
    await input.press('Enter');
    await expect(page.locator('#xml-tab-bar .dtab.active')).toHaveText(/renamed_tab/);
    const stored = await page.evaluate(() => localStorage.getItem('fdar_editor_tabs') || '');
    expect(stored).toContain('renamed_tab');
  });

  test('edits are persisted to localStorage per tab', async ({ page }) => {
    await openApp(page);
    await setEditorValue(page, '<AUGMENTATION>\n  <CAMERA>\n    <NODE tz="100">\n      <TEXT label="Edited!" />\n    </NODE>\n  </CAMERA>\n</AUGMENTATION>');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('fdar_editor_tabs') || '')).toContain('Edited!');
  });
});

test.describe('preview tabs', () => {
  test('HTML Code tab reveals the code view and save button', async ({ page }) => {
    await openApp(page);
    await waitForTransform(page);
    await page.locator('#preview-tab-bar .dtab', { hasText: 'HTML Code' }).locator('.dtab-label').click();
    await expect(page.locator('#html-code-wrap')).toBeVisible();
    await expect(page.locator('#btn-save-html')).toBeVisible();
    await expect(page.locator('#preview-iframe')).toBeHidden();
    // Switching back restores the iframe
    await page.locator('#preview-tab-bar .dtab', { hasText: 'AR Preview' }).locator('.dtab-label').click();
    await expect(page.locator('#preview-iframe')).toBeVisible();
    await expect(page.locator('#html-code-wrap')).toBeHidden();
  });
});

test.describe('preview state', () => {
  test('marker-free toggle survives editing the XML', async ({ page }) => {
    test.slow(); // AR preview pulls AR.js from a CDN
    await openApp(page);
    // Switch to a marker scene so the preview shows the toggle
    await page.locator('#xml-tab-bar .dtab', { hasText: 'model_ar' }).locator('.dtab-label').click();
    await expect.poll(() => getEditorValue(page)).toContain('<TARGETBASE');
    const frame = page.frameLocator('#preview-iframe');
    await expect(frame.locator('#mf-checkbox')).toBeAttached({ timeout: 30_000 });
    await frame.locator('.mf-slider').click();
    await expect(frame.locator('#mf-checkbox')).toBeChecked();

    // Editing the XML reloads the preview; the toggle must stay on
    await setEditorValue(page, (await getEditorValue(page)).replace('sxyz="0.1"', 'sxyz="0.2"'));
    await expect.poll(() => getGeneratedHtml(page), { timeout: 20_000 }).toContain('scale="0.2 0.2 0.2"');
    await expect(frame.locator('#mf-checkbox')).toBeChecked({ timeout: 30_000 });
    // ...and actually re-applies (marker content moved onto the stage)
    await expect.poll(() => page.evaluate(() => {
      const iframe = /** @type {HTMLIFrameElement} */ (document.getElementById('preview-iframe'));
      const doc = iframe.contentDocument;
      const stage = doc && /** @type {any} */ (doc.getElementById('mf-stage'));
      return stage && stage.object3D ? stage.object3D.children.length : 0;
    }), { timeout: 30_000 }).toBeGreaterThan(0);
  });
});

test.describe('open dialog', () => {
  test('Open shows a dialog with file drop zone, URL input and QR scan', async ({ page }) => {
    await openApp(page);
    await page.locator('#btn-open-xml').click();
    const dialog = page.locator('#open-dialog');
    await expect(dialog).toBeVisible();
    await expect(page.locator('#od-drop-zone')).toBeVisible();
    await expect(page.locator('#od-url-input')).toBeVisible();
    await expect(page.locator('#od-qr-btn')).toBeVisible();
    // URL field doubles as a pulldown of Azure sample scenes (datalist),
    // while still accepting free-form input
    await expect(page.locator('#od-url-input')).toHaveAttribute('list', 'od-url-samples');
    const optionCount = await page.locator('#od-url-samples option').count();
    expect(optionCount).toBeGreaterThanOrEqual(40);
    const values = await page.locator('#od-url-samples option').evaluateAll(
      (opts) => opts.map((o) => /** @type {HTMLOptionElement} */ (o).value));
    expect(values).toContain('https://festodidacticsw.azurewebsites.net/ar/MPS400/Sorting_01.xml');
    expect(values.every((v) => /^https:\/\//.test(v))).toBe(true);
    // Escape closes it
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('clicking the drop zone opens the OS file picker', async ({ page }) => {
    await openApp(page);
    await page.locator('#btn-open-xml').click();
    const chooserPromise = page.waitForEvent('filechooser');
    await page.locator('#od-drop-zone').click();
    const chooser = await chooserPromise;
    expect(chooser.isMultiple()).toBe(false);
  });

  test('dropping an XML file onto the drop zone opens it as a tab', async ({ page }) => {
    await openApp(page);
    await page.locator('#btn-open-xml').click();
    // Synthesize a drag & drop with a DataTransfer carrying an XML file
    await page.evaluate(() => {
      const dt = new DataTransfer();
      dt.items.add(new File(
        ['<AUGMENTATION>\n  <CAMERA>\n    <NODE tz="100">\n      <TEXT label="dropped!" />\n    </NODE>\n  </CAMERA>\n</AUGMENTATION>'],
        'dropped_scene.xml', { type: 'text/xml' }));
      const zone = /** @type {HTMLElement} */ (document.getElementById('od-drop-zone'));
      zone.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer: dt }));
      zone.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dt }));
    });
    await expect(page.locator('#open-dialog')).toBeHidden();
    await expect(page.locator('#xml-tab-bar .dtab.active')).toHaveText(/dropped_scene/);
    await expect.poll(() => getEditorValue(page)).toContain('dropped!');
  });

  test('loading an XML from a URL adds a tab and transforms it', async ({ page }) => {
    await openApp(page);
    await page.locator('#btn-open-xml').click();
    await page.locator('#od-url-input').fill('http://localhost:8321/tests/scenes/link.xml');
    await page.locator('#od-url-load').click();
    await expect(page.locator('#open-dialog')).toBeHidden();
    await expect(page.locator('#xml-tab-bar .dtab.active')).toHaveText(/link/);
    await expect.poll(() => getEditorValue(page)).toContain('nodered.jp');
    await expect.poll(() => getGeneratedHtml(page), { timeout: 20_000 }).toContain('navigate-on-click');
  });

  test('a failing URL shows an error and keeps the dialog open', async ({ page }) => {
    await openApp(page);
    await page.locator('#btn-open-xml').click();
    await page.locator('#od-url-input').fill('http://localhost:8321/does-not-exist.xml');
    await page.locator('#od-url-load').click();
    await expect(page.locator('#od-error')).toContainText('Failed to load', { timeout: 20_000 });
    await expect(page.locator('#open-dialog')).toBeVisible();
  });

  test('QR scan flow loads the decoded URL', async ({ page }) => {
    // Stub BarcodeDetector to decode a known URL from the fake camera stream
    await page.addInitScript(() => {
      // @ts-ignore
      window.BarcodeDetector = class {
        static getSupportedFormats() { return Promise.resolve(['qr_code']); }
        detect() {
          return Promise.resolve([{ rawValue: 'http://localhost:8321/tests/scenes/signal.xml' }]);
        }
      };
    });
    await openApp(page);
    await page.locator('#btn-open-xml').click();
    await page.locator('#od-qr-btn').click();
    await expect(page.locator('#xml-tab-bar .dtab.active')).toHaveText(/signal/, { timeout: 20_000 });
    await expect.poll(() => getEditorValue(page)).toContain('<SIGNAL');
    // Camera must be released after a successful scan
    expect(await page.evaluate(() => {
      const v = /** @type {HTMLVideoElement} */ (document.getElementById('od-qr-video'));
      return v.srcObject === null;
    })).toBe(true);
  });
});

test.describe('file operations', () => {
  test('Save XML downloads the active tab as .xml', async ({ page }) => {
    await openApp(page);
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#btn-save-xml').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('text.xml');
  });

  test('Save HTML downloads the generated scene', async ({ page }) => {
    await openApp(page);
    await waitForTransform(page);
    await page.locator('#preview-tab-bar .dtab', { hasText: 'HTML Code' }).locator('.dtab-label').click();
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#btn-save-html').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('scene.htm');
  });
});
