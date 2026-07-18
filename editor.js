/*
 * AR App Live Editor
 *
 * Left pane: XML source tabs (Monaco editor, textarea fallback).
 * Right pane: the XML transformed through aframe.xsl, shown as a live
 * A-Frame preview, an inspector view, or the generated HTML code.
 *
 * Sections:
 *   1. Constants and persisted state
 *   2. DOM references and runtime state
 *   3. XSLT engine and HTML post-processing
 *   4. Tab-level undo/redo
 *   5. XML tabs (render / switch / close / add / drag / rename)
 *   6. Preview tabs and popups
 *   7. Transform pipeline (XML -> HTML -> iframe/popups)
 *   8. File load/save and drag & drop
 *   9. Editors (Monaco with textarea fallback)
 *  10. Layout (divider, resize, popup expand) and keyboard shortcuts
 */
(function () {
  'use strict';

  /* ================================================================
   * 1. Constants and persisted state
   * ================================================================ */

  var LS_TABS = 'fdar_editor_tabs';
  var LS_ACTIVE = 'fdar_editor_active_tab';

  var DEFAULT_TABS = [
    { id: 'helloworld', name: 'text', content: '<AUGMENTATION>\n  <CAMERA>\n    <NODE tz="100">\n      <TEXT label="Hello World" rgba="00ff0088" width="10" />\n    </NODE>\n  </CAMERA>\n</AUGMENTATION>' },
    { id: 'helloworldar', name: 'text_ar', content: '<AUGMENTATION>\n  <TARGETBASE file="CP-System">\n    <TARGET marker="marker/CP-AM-DRILL">\n      <NODE rx="90">\n        <NODE>\n          <TEXT label="Hello World" />\n        </NODE>\n      </NODE>\n    </TARGET>\n  </TARGETBASE>\n</AUGMENTATION>' },
    { id: 'link', name: 'link', content: '<AUGMENTATION>\n  <CAMERA>\n    <NODE tz="100">\n      <TEXT label="Website">\n        <LINK refer="https://nodered.jp"/>\n      </TEXT>\n    </NODE>\n  </CAMERA>\n</AUGMENTATION>' },
    { id: 'viewer', name: 'viewer', content: '<AUGMENTATION>\n  <CAMERA>\n    <NODE tz="1">\n      <VIEWER picture="https://picsum.photos/200" refresh="5" />\n    </NODE>\n  </CAMERA>\n</AUGMENTATION>' },
    { id: 'viewer_ar', name: 'viewer_ar', content: '<AUGMENTATION>\n  <TARGETBASE file="CP-System">\n    <TARGET marker="marker/CP-AM-DRILL">\n      <NODE rx="90" sxyz="4">\n        <VIEWER picture="https://nodered.jp/images/yokoi.jpg" />\n      </NODE>\n    </TARGET>\n  </TARGETBASE>\n</AUGMENTATION>' },
    { id: 'model', name: 'model', content: '<AUGMENTATION>\n  <CAMERA>\n    <NODE tz="30">\n      <ANIMATION attribute="rx">\n        <KEYFRAME time="0" value="0" lerp="linear" />\n        <KEYFRAME time="10" value="360" />\n      </ANIMATION>\n      <MODEL file="obj/arrow_blue.glb" />\n    </NODE>\n  </CAMERA>\n</AUGMENTATION>' },
    { id: 'model_ar', name: 'model_ar', content: '<AUGMENTATION>\n  <TARGETBASE file="CP-System">\n    <TARGET marker="marker/CP-AM-DRILL">\n      <NODE sxyz="0.1">\n        <MODEL file="obj/arrow_blue.glb" />\n      </NODE>\n    </TARGET>\n  </TARGETBASE>\n</AUGMENTATION>' },
    { id: 'streamer', name: 'streamer', content: '<AUGMENTATION>\n  <CAMERA>\n    <NODE tz="1">\n      <STREAMER url="https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8" />\n    </NODE>\n  </CAMERA>\n</AUGMENTATION>' },
    { id: 'signal', name: 'signal', content: '<AUGMENTATION>\n  <CAMERA>\n    <NODE sxyz="20" tz="100">\n      <SIGNAL rgb="f00" status="on"/>\n    </NODE>\n  </CAMERA>\n</AUGMENTATION>' },
    { id: 'signal_ws', name: 'ws_send', content: '<AUGMENTATION>\n  <VALUESERVER>\n    <WEBSOCKET url="ws://127.0.0.1:1880/ws/data" transmitter="send"/>\n  </VALUESERVER>\n  <CAMERA>\n    <NODE tz="10">\n      <SWITCH>\n        <TRANSMIT attribute="pressed" variable="btnPressed" transmitter="send"/>\n      </SWITCH>\n      <SIGNAL rgb="f00" status="@anim:btnPressed"/>\n    </NODE>\n  </CAMERA>\n</AUGMENTATION>' },
    { id: 'ws_receive', name: 'ws_receive', content: '<AUGMENTATION>\n  <VALUESERVER>\n    <WEBSOCKET url="ws://127.0.0.1:1880/ws/data" />\n  </VALUESERVER>\n  <CAMERA>\n    <NODE tz="100">\n      <TEXT label="@anim:temperature" />\n    </NODE>\n  </CAMERA>\n</AUGMENTATION>' },
    { id: 'counter', name: 'counter', content: '<AUGMENTATION>\n  <CAMERA>\n    <NODE tz="100">\n      <COUNTER value="451" />\n    </NODE>\n  </CAMERA>\n</AUGMENTATION>' },
    { id: 'vumeter', name: 'vumeter', content: '<AUGMENTATION>\n  <TARGETBASE file="CP-System">\n    <TARGET marker="marker/CP-AM-DRILL">\n      <NODE rx="90" sxyz="4">\n        <VUMETER value="0.451" label="temperature" />\n      </NODE>\n    </TARGET>\n  </TARGETBASE>\n</AUGMENTATION>' }
  ];

  var PREVIEW_TABS = [
    { id: 'preview', label: '\u{1F310} AR Preview', popup: true },
    { id: 'inspector', label: '\u{1F50D} AR Inspector', popup: true },
    { id: 'code', label: '</> HTML Code', popup: true }
  ];

  // Injected into every generated page: auto-dismiss A-Frame's VR modal.
  var VR_SUPPRESS = '\n<script>document.addEventListener("DOMContentLoaded",function(){var iv=setInterval(function(){var m=document.querySelector(".a-modal");if(m){m.remove();clearInterval(iv);}},200);setTimeout(function(){clearInterval(iv);},5000);});<\/script>\n';

  // Additionally injected for the inspector view: load and open aframe-inspector.
  var INSPECTOR_INJECT = '\n<script>document.addEventListener("DOMContentLoaded",function(){var cs=setInterval(function(){if(typeof AFRAME!=="undefined"&&AFRAME.scenes&&AFRAME.scenes[0]){clearInterval(cs);var scene=AFRAME.scenes[0];var scr=document.createElement("script");scr.src="https://cdn.jsdelivr.net/gh/aframevr/aframe-inspector@master/dist/aframe-inspector.min.js";scr.onload=function(){scene.setAttribute("inspector","");setTimeout(function(){try{scene.components.inspector.openInspector();}catch(e){console.warn(e);}},800);};document.head.appendChild(scr);}},500);});<\/script>\n';

  function loadXmlTabs() {
    try {
      var stored = localStorage.getItem(LS_TABS);
      var tabs = stored ? JSON.parse(stored) : null;
      if (!tabs || !tabs.length) tabs = JSON.parse(JSON.stringify(DEFAULT_TABS));
      var active = localStorage.getItem(LS_ACTIVE) || tabs[0].id;
      if (!tabs.find(function (t) { return t.id === active; })) active = tabs[0].id;
      return { tabs: tabs, active: active };
    } catch (e) {
      var defaults = JSON.parse(JSON.stringify(DEFAULT_TABS));
      return { tabs: defaults, active: defaults[0].id };
    }
  }

  /* ================================================================
   * 2. DOM references and runtime state
   * ================================================================ */

  var errorBar = document.getElementById('error-bar');
  var previewIframe = document.getElementById('preview-iframe');
  var fallbackEditor = document.getElementById('fallback-editor');
  var fallbackHtmlCode = document.getElementById('fallback-html-code');
  var htmlCodeWrap = document.getElementById('html-code-wrap');
  var xslDropOverlay = document.getElementById('xsl-drop-overlay');
  var xslFileInput = document.getElementById('xsl-file-input');
  var xmlFileInput = document.getElementById('xml-file-input');
  var editorPane = document.getElementById('editor-pane');
  var xmlTabBar = document.getElementById('xml-tab-bar');
  var previewTabBar = document.getElementById('preview-tab-bar');
  var btnSaveHtml = document.getElementById('btn-save-html');

  var state = loadXmlTabs();
  var xmlTabs = state.tabs;
  var activeXmlTabId = state.active;
  var activePreviewTab = 'preview';

  var xslString = null;          // loaded aframe.xsl source
  var lastHtmlRaw = '';          // last transform result
  var lastHtmlPreview = '';      // ... with VR modal suppression injected
  var lastHtmlInspector = '';    // ... with inspector bootstrap injected
  var currentBlobUrl = null;     // blob URL currently shown in the iframe

  var htmlMonacoEditor = null;   // read-only Monaco instance for HTML view
  var monacoLoaded = false;
  var uid = Date.now();          // id counter for new tabs

  var _previewPopup = null;
  var _inspectorPopup = null;
  var _codePopup = null;
  var _popupCheckTimer = null;

  var _iframeTimer = null;
  var _tabNavActive = false;     // true briefly during keyboard tab navigation

  /* ================================================================
   * 3. XSLT engine and HTML post-processing
   * ================================================================ */

  var _xsltEngine = null;

  // Wrap whichever API shape the loaded xslt-processor build exposes.
  function getXsltEngine() {
    if (_xsltEngine) return _xsltEngine;
    var ns = globalThis.XsltProcessor || window.XsltProcessor;
    if (!ns) return null;
    if (ns.Xslt && ns.xmlParse) {
      var inst = new ns.Xslt({ escape: false, selfClosingTags: false });
      _xsltEngine = {
        process: function (xml, xsl) { return inst.xsltProcess(ns.xmlParse(xml), ns.xmlParse(xsl)); }
      };
      return _xsltEngine;
    }
    if (ns.Xslt && ns.XmlParser) {
      var inst2 = new ns.Xslt({ escape: false, selfClosingTags: false });
      var parser = new ns.XmlParser();
      _xsltEngine = {
        process: function (xml, xsl) { return inst2.xsltProcess(parser.xmlParse(xml), parser.xmlParse(xsl)); }
      };
      return _xsltEngine;
    }
    return null;
  }

  var VOID_ELEMENTS = /^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/i;

  // The XSLT output is XHTML-ish; massage it into HTML the browser parses
  // the way A-Frame expects.
  function fixXhtmlToHtml(str) {
    str = str.replace(/<\?xml[^?]*\?>\s*/g, '');
    str = str.replace(/\s+xmlns(:[a-zA-Z0-9]+)?="[^"]*"/g, '');
    // Expand self-closing tags on non-void elements: <a-entity /> -> <a-entity></a-entity>
    str = str.replace(/<([a-zA-Z][a-zA-Z0-9-]*)(\s[^>]*)?\s*\/>/g, function (m, tag, attrs) {
      if (VOID_ELEMENTS.test(tag)) return m;
      return '<' + tag + (attrs || '') + '></' + tag + '>';
    });
    // Drop bogus closing tags the serializer may emit for void elements
    str = str.replace(/<\/(meta|br|hr|img|input|link|area|base|col|embed|param|source|track|wbr)>/gi, '');
    // Script/style bodies must not stay entity-escaped
    str = str.replace(/<script([^>]*)>([\s\S]*?)<\/script>/gi, function (m, attrs, code) {
      return '<script' + attrs + '>' + code.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&') + '<\/scr' + 'ipt>';
    });
    str = str.replace(/<style([^>]*)>([\s\S]*?)<\/style>/gi, function (m, attrs, css) {
      return '<style' + attrs + '>' + css.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&') + '</style>';
    });
    // NaN in attribute values breaks A-Frame; substitute a sane default
    str = str.replace(/(\w[\w-]*)="([^"]*)"/g, function (m, attr, value) {
      if (value.indexOf('NaN') === -1) return m;
      var def = (/scale/i.test(attr)) ? '1' : '0';
      return attr + '="' + value.replace(/NaN/g, def) + '"';
    });
    str = str.trim();
    if (str.indexOf('<!DOCTYPE') === -1 && str.indexOf('<!doctype') === -1) str = '<!DOCTYPE html>\n' + str;
    return str;
  }

  // Re-indent the generated HTML (script/style bodies left untouched).
  function tidyHtml(html) {
    var blocks = [];
    html = html.replace(/<(script|style)([^>]*)>([\s\S]*?)<\/\1>/gi, function (m) {
      blocks.push(m);
      return '<!--BLOCK' + (blocks.length - 1) + '-->';
    });
    html = html.replace(/>\s*</g, '>\n<');
    var voidTags = /^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr|!doctype)$/i;
    var lines = html.split('\n');
    var indent = 0;
    var result = '';
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      if (line.match(/^<\/[a-zA-Z]/)) indent = Math.max(0, indent - 1);
      result += '  '.repeat(indent) + line + '\n';
      var tag = line.match(/^<([a-zA-Z][a-zA-Z0-9-]*)/);
      var opensBlock = tag && !line.match(/\/>$/) && !line.match(/^<\//) && !line.match(/^<!/) &&
        !voidTags.test(tag[1]) && !line.match(/<\/[a-zA-Z][a-zA-Z0-9-]*>$/);
      if (opensBlock) indent++;
    }
    result = result.replace(/<!--BLOCK(\d+)-->/g, function (m, idx) { return blocks[parseInt(idx)]; });
    return result.trimEnd();
  }

  // Pretty-print XML (used when importing files); returns input unchanged if unparsable.
  function formatXml(xml) {
    xml = xml.replace(/\u00A0/g, ' ');
    try {
      var doc = new DOMParser().parseFromString(xml, 'text/xml');
      if (doc.getElementsByTagName('parsererror').length > 0) return xml;
      xml = new XMLSerializer().serializeToString(doc);
      xml = xml.replace(/<\?xml[^?]*\?>\s*/g, '');
    } catch (e) {
      return xml;
    }
    var lines = xml.replace(/>\s*</g, '>\n<').split('\n');
    var indent = 0;
    var result = '';
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      if (line.match(/^<\/\w/)) indent = Math.max(0, indent - 1);
      result += '  '.repeat(indent) + line + '\n';
      if (line.match(/^<\w/) && !line.match(/\/>$/) && !line.match(/^<\?/) && !line.match(/<\/\w+>$/)) indent++;
    }
    return result.trim();
  }

  /* ================================================================
   * 4. Tab-level undo/redo (tab add/close/rename/reorder)
   * ================================================================ */

  var _tabUndoStack = [];
  var _tabRedoStack = [];

  function snapshotTabs() {
    return { tabs: JSON.parse(JSON.stringify(xmlTabs)), active: activeXmlTabId };
  }

  function _pushTabState() {
    var active = xmlTabs.find(function (t) { return t.id === activeXmlTabId; });
    if (active && window._monacoEditor) active.content = window._monacoEditor.getValue();
    _tabUndoStack.push(snapshotTabs());
    _tabRedoStack = [];
    if (_tabUndoStack.length > 50) _tabUndoStack.shift();
  }

  function restoreTabs(snapshot) {
    xmlTabs = snapshot.tabs;
    activeXmlTabId = snapshot.active;
    var tab = xmlTabs.find(function (t) { return t.id === activeXmlTabId; });
    if (tab) setEditorValue(tab.content);
    renderXmlTabs();
    saveXmlTabs();
    doTransform(getEditorValue());
  }

  function _undoTabs() {
    if (!_tabUndoStack.length) return;
    _tabRedoStack.push(snapshotTabs());
    restoreTabs(_tabUndoStack.pop());
  }

  function _redoTabs() {
    if (!_tabRedoStack.length) return;
    _tabUndoStack.push(snapshotTabs());
    restoreTabs(_tabRedoStack.pop());
  }

  /* ================================================================
   * 5. XML tabs
   * ================================================================ */

  function saveXmlTabs() {
    var active = xmlTabs.find(function (t) { return t.id === activeXmlTabId; });
    if (active) active.content = getEditorValue();
    try {
      localStorage.setItem(LS_TABS, JSON.stringify(xmlTabs));
      localStorage.setItem(LS_ACTIVE, activeXmlTabId);
    } catch (e) { /* storage full or unavailable */ }
  }

  function renderXmlTabs() {
    document.getElementById('editor-container').style.display = xmlTabs.length > 0 ? '' : 'none';
    xmlTabBar.innerHTML = '';
    xmlTabs.forEach(function (tab) {
      var el = document.createElement('div');
      el.className = 'dtab' + (tab.id === activeXmlTabId ? ' active' : '');
      el.dataset.id = tab.id;
      el.draggable = true;
      el.tabIndex = 0;

      var label = document.createElement('span');
      label.className = 'dtab-label';
      label.textContent = '\u{1F4C4} ' + tab.name;

      // Single click selects (after a delay so a double click can cancel it);
      // double click starts inline rename.
      var clickTimer = null;
      label.addEventListener('click', function () {
        if (label.querySelector('input')) return;
        if (clickTimer) clearTimeout(clickTimer);
        clickTimer = setTimeout(function () {
          clickTimer = null;
          console.log('[TabNav] xml-tab-bar: selected ' + tab.id);
          switchXmlTab(tab.id);
        }, 250);
      });
      label.addEventListener('dblclick', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }
        // Activate the tab without a full re-render, so the rename input survives
        if (tab.id !== activeXmlTabId) {
          var cur = xmlTabs.find(function (t) { return t.id === activeXmlTabId; });
          if (cur) cur.content = getEditorValue();
          activeXmlTabId = tab.id;
          setEditorValue(tab.content);
          saveXmlTabs();
          xmlTabBar.querySelectorAll('.dtab').forEach(function (d) { d.classList.remove('active'); });
          el.classList.add('active');
        }
        startRename(tab, label);
      });
      el.appendChild(label);

      var close = document.createElement('button');
      close.className = 'dtab-close';
      close.innerHTML = '&times;';
      close.title = 'Close';
      close.addEventListener('click', function (e) {
        e.stopPropagation();
        closeXmlTab(tab.id);
      });
      el.appendChild(close);

      xmlTabBar.appendChild(el);
    });
    var activeEl = xmlTabBar.querySelector('.dtab.active');
    if (activeEl) setTimeout(function () { activeEl.focus(); }, 0);
  }

  function startRename(tab, label) {
    var input = document.createElement('input');
    input.type = 'text';
    input.value = tab.name;
    input.className = 'rename-input';
    input.style.width = Math.max(60, tab.name.length * 8 + 20) + 'px';
    label.textContent = '';
    label.appendChild(document.createTextNode('\u{1F4C4} '));
    label.appendChild(input);
    input.focus();
    input.select();

    var done = false;
    function finish() {
      if (done) return;
      done = true;
      var name = input.value.trim();
      if (name && name !== tab.name) {
        _pushTabState();
        tab.name = name;
      }
      saveXmlTabs();
      renderXmlTabs();
    }
    input.addEventListener('blur', finish);
    input.addEventListener('keydown', function (ev) {
      ev.stopPropagation();
      if (ev.key === 'Enter') { ev.preventDefault(); input.blur(); }
      if (ev.key === 'Escape') { input.value = tab.name; input.blur(); }
    });
    input.addEventListener('click', function (ev) { ev.stopPropagation(); });
    input.addEventListener('dblclick', function (ev) { ev.stopPropagation(); });
  }

  function switchXmlTab(id) {
    var cur = xmlTabs.find(function (t) { return t.id === activeXmlTabId; });
    if (cur) cur.content = getEditorValue();
    activeXmlTabId = id;
    var tab = xmlTabs.find(function (t) { return t.id === id; });
    if (tab) setEditorValue(tab.content);
    renderXmlTabs();
    saveXmlTabs();
    doTransform(getEditorValue());
  }

  function closeXmlTab(id) {
    _pushTabState();
    var idx = xmlTabs.findIndex(function (t) { return t.id === id; });
    if (idx < 0) return;
    xmlTabs.splice(idx, 1);

    if (xmlTabs.length === 0) {
      try {
        localStorage.removeItem(LS_TABS);
        localStorage.removeItem(LS_ACTIVE);
      } catch (e) { /* ignore */ }
      activeXmlTabId = null;
      setEditorValue('');
      renderXmlTabs();
      showError(null);
      lastHtmlPreview = '';
      lastHtmlInspector = '';
      lastHtmlRaw = '';
      if (htmlMonacoEditor) htmlMonacoEditor.setValue('');
      if (currentBlobUrl) { URL.revokeObjectURL(currentBlobUrl); currentBlobUrl = null; }
      previewIframe.removeAttribute('src');
      return;
    }

    if (activeXmlTabId === id) {
      activeXmlTabId = xmlTabs[Math.min(idx, xmlTabs.length - 1)].id;
    }
    var tab = xmlTabs.find(function (t) { return t.id === activeXmlTabId; });
    if (tab) setEditorValue(tab.content);
    renderXmlTabs();
    saveXmlTabs();
    doTransform(getEditorValue());
  }

  function addXmlTab(name, content) {
    _pushTabState();
    var id = 'tab_' + (++uid);
    xmlTabs.push({ id: id, name: name, content: formatXml(content) });
    switchXmlTab(id);
  }

  // Generic drag & drop reordering for a tab bar.
  function makeDraggable(tabBar, getOrder, setOrder) {
    var dragSrc = null;
    tabBar.addEventListener('dragstart', function (e) {
      var tab = e.target.closest('.dtab');
      if (!tab || tab.classList.contains('dtab-add')) return;
      dragSrc = tab;
      tab.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', tab.dataset.id);
    });
    tabBar.addEventListener('dragend', function (e) {
      var tab = e.target.closest('.dtab');
      if (tab) tab.classList.remove('dragging');
      tabBar.querySelectorAll('.dtab').forEach(function (t) { t.classList.remove('drag-over-left', 'drag-over-right'); });
      dragSrc = null;
    });
    tabBar.addEventListener('dragover', function (e) {
      if (!dragSrc) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      tabBar.querySelectorAll('.dtab').forEach(function (t) { t.classList.remove('drag-over-left', 'drag-over-right'); });
      var tab = e.target.closest('.dtab');
      if (!tab || tab === dragSrc || tab.classList.contains('dtab-add')) return;
      var rect = tab.getBoundingClientRect();
      if (e.clientX < rect.left + rect.width / 2) tab.classList.add('drag-over-left');
      else tab.classList.add('drag-over-right');
    });
    tabBar.addEventListener('dragleave', function (e) {
      var tab = e.target.closest('.dtab');
      if (tab) tab.classList.remove('drag-over-left', 'drag-over-right');
    });
    tabBar.addEventListener('drop', function (e) {
      if (!dragSrc) return;
      e.preventDefault();
      tabBar.querySelectorAll('.dtab').forEach(function (t) { t.classList.remove('drag-over-left', 'drag-over-right'); });
      var target = e.target.closest('.dtab');
      if (!target || target === dragSrc || target.classList.contains('dtab-add')) return;
      var srcId = dragSrc.dataset.id;
      var tgtId = target.dataset.id;
      var order = getOrder();
      var si = order.findIndex(function (x) { return x === srcId; });
      var ti = order.findIndex(function (x) { return x === tgtId; });
      if (si < 0 || ti < 0) return;
      var rect = target.getBoundingClientRect();
      var insertAfter = e.clientX >= rect.left + rect.width / 2;
      order.splice(si, 1);
      ti = order.findIndex(function (x) { return x === tgtId; });
      order.splice(insertAfter ? ti + 1 : ti, 0, srcId);
      setOrder(order);
    });
  }

  makeDraggable(xmlTabBar,
    function () { return xmlTabs.map(function (t) { return t.id; }); },
    function (order) {
      var byId = {};
      xmlTabs.forEach(function (t) { byId[t.id] = t; });
      _pushTabState();
      xmlTabs = order.map(function (id) { return byId[id]; }).filter(Boolean);
      renderXmlTabs();
      saveXmlTabs();
    });

  /* ================================================================
   * 6. Preview tabs and popups
   * ================================================================ */

  function renderPreviewTabs() {
    previewTabBar.innerHTML = '';
    PREVIEW_TABS.forEach(function (tab, i) {
      if (i > 0) {
        var sep = document.createElement('div');
        sep.className = 'tab-sep';
        previewTabBar.appendChild(sep);
      }
      var el = document.createElement('div');
      el.className = 'dtab' + (tab.id === activePreviewTab ? ' active' : '');
      el.dataset.id = tab.id;
      el.draggable = true;
      el.tabIndex = 0;

      var label = document.createElement('span');
      label.className = 'dtab-label';
      label.innerHTML = tab.id === 'code' ? '&lt;/&gt; HTML Code' : tab.label;
      label.addEventListener('click', function () {
        console.log('[TabNav] preview-tab-bar: selected ' + tab.id);
        switchPreviewTab(tab.id);
      });
      el.appendChild(label);

      if (tab.popup) {
        var popup = document.createElement('button');
        popup.className = 'popup-btn';
        popup.innerHTML = '&#x29C9;';
        popup.title = 'Open in new window';
        popup.addEventListener('click', function (e) {
          e.stopPropagation();
          openPreviewPopup(tab.id);
        });
        el.appendChild(popup);
      }
      previewTabBar.appendChild(el);
    });
  }

  function openPreviewPopup(tabId) {
    if (tabId === 'code' && lastHtmlRaw) {
      _codePopup = openMonacoPopup(lastHtmlRaw);
      _onPopupOpen();
    } else if (_isMobile()) {
      // No popup windows on mobile; go fullscreen in place instead
      if (tabId === 'preview') { switchPreviewTab('preview'); _goFullscreen(); }
      else if (tabId === 'inspector') { switchPreviewTab('inspector'); _goFullscreen(); }
    } else {
      if (tabId === 'preview' && lastHtmlPreview) {
        _previewPopup = openHtmlPopup(lastHtmlPreview, 'AR Preview');
        _onPopupOpen();
      } else if (tabId === 'inspector' && lastHtmlInspector) {
        _inspectorPopup = openHtmlPopup(lastHtmlInspector, 'AR Inspector');
        _onPopupOpen();
      }
    }
  }

  function switchPreviewTab(id) {
    activePreviewTab = id;
    renderPreviewTabs();
    updatePreviewView();
  }

  makeDraggable(previewTabBar,
    function () { return PREVIEW_TABS.map(function (t) { return t.id; }); },
    function (order) {
      var byId = {};
      PREVIEW_TABS.forEach(function (t) { byId[t.id] = t; });
      PREVIEW_TABS = order.map(function (id) { return byId[id]; }).filter(Boolean);
      renderPreviewTabs();
    });

  function updatePreviewView() {
    btnSaveHtml.style.display = (activePreviewTab === 'code') ? '' : 'none';
    if (activePreviewTab === 'code') {
      previewIframe.style.display = 'none';
      htmlCodeWrap.style.display = 'block';
      if (htmlMonacoEditor) htmlMonacoEditor.layout();
    } else {
      previewIframe.style.display = 'block';
      htmlCodeWrap.style.display = 'none';
      if (activePreviewTab === 'preview' && lastHtmlPreview) reloadIframe(lastHtmlPreview);
      else if (activePreviewTab === 'inspector' && lastHtmlInspector) reloadIframe(lastHtmlInspector);
    }
  }

  function openHtmlPopup(html, title) {
    if (title) html = html.replace('</head>', '<scr' + 'ipt>document.title="' + title + '";</' + 'script></head>');
    var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var win = window.open(url, '_blank', 'width=1024,height=768');
    setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
    return win;
  }

  // Popup window with its own Monaco showing the generated HTML; it polls
  // window.opener._popupCode so it stays current as the user edits.
  function openMonacoPopup(code) {
    window._popupCode = code;
    var win = window.open('', '_blank', 'width=1024,height=768');
    if (!win) return;
    var doc = win.document;
    doc.open();
    doc.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>HTML Code<\/title><style>*{margin:0;padding:0;box-sizing:border-box}body{overflow:hidden;background:#1e1e1e}#c{width:100vw;height:100vh}<\/style><\/head><body><div id="c"><\/div><script src="https:\/\/cdn.jsdelivr.net\/npm\/monaco-editor@0.55.1\/min\/vs\/loader.js"><\/script><script>var code=(window.opener&&window.opener._popupCode)||"";require.config({paths:{vs:"https:\/\/cdn.jsdelivr.net\/npm\/monaco-editor@0.55.1\/min\/vs"}});require(["vs\/editor\/editor.main"],function(){var ed=monaco.editor.create(document.getElementById("c"),{value:code,language:"html",theme:"vs-dark",fontSize:13,minimap:{enabled:false},automaticLayout:true,wordWrap:"on",scrollBeyondLastLine:false,readOnly:true,tabSize:2});var _prev=code;setInterval(function(){try{var c=window.opener&&window.opener._popupCode;if(c&&c!==_prev){_prev=c;ed.setValue(c);}}catch(e){}},1000);});<\/script><\/body><\/html>');
    doc.close();
    return win;
  }

  /* ================================================================
   * 7. Transform pipeline
   * ================================================================ */

  function showError(message) {
    if (!message) return;
    var escaped = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    var page = '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
      '<style>body{margin:0;background:#1e1e1e;color:#f48771;font-family:Consolas,monospace;display:flex;align-items:center;justify-content:center;height:100vh;padding:24px}' +
      '.box{background:#2d2d2d;border:1px solid #5a1d1d;border-radius:8px;padding:20px 28px;max-width:90%;word-break:break-all;white-space:pre-wrap;font-size:13px;line-height:1.6}' +
      '.t{color:#ff6b6b;font-size:15px;font-weight:bold;margin-bottom:10px}</style></head>' +
      '<body><div class="box"><div class="t">Error</div>' + escaped + '</div></body></html>';
    _discardPending();
    if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
    var blob = new Blob([page], { type: 'text/html;charset=utf-8' });
    currentBlobUrl = URL.createObjectURL(blob);
    previewIframe.src = currentBlobUrl;
  }

  // Double-buffered preview reload: the next page loads in a hidden iframe
  // and is swapped in once its scene is ready, so edits neither flash the
  // preview nor show a half-initialized scene.
  var _pendingIframe = null;

  function _discardPending() {
    if (!_pendingIframe) return;
    var stale = _pendingIframe;
    _pendingIframe = null;
    if (stale._pollTimer) clearInterval(stale._pollTimer);
    if (stale._blobUrl) URL.revokeObjectURL(stale._blobUrl);
    stale.remove();
  }

  function _doReloadIframe(html) {
    _discardPending();
    var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    var url = URL.createObjectURL(blob);

    var next = document.createElement('iframe');
    next.setAttribute('allow', 'camera;microphone;autoplay');
    next.tabIndex = -1;
    next.style.visibility = 'hidden';
    next.style.display = previewIframe.style.display;
    next._blobUrl = url;
    previewIframe.parentElement.appendChild(next);
    _pendingIframe = next;

    var swapped = false;
    var swap = function () {
      if (swapped || _pendingIframe !== next) return;
      swapped = true;
      if (next._pollTimer) clearInterval(next._pollTimer);
      _pendingIframe = null;
      var old = previewIframe;
      next.id = 'preview-iframe';
      old.removeAttribute('id');
      next.style.visibility = '';
      next.style.pointerEvents = old.style.pointerEvents;
      old.remove();
      if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
      currentBlobUrl = url;
      previewIframe = next;
    };

    var started = Date.now();
    next.addEventListener('load', function () {
      next._pollTimer = setInterval(function () {
        var ready = false;
        try {
          var doc = next.contentDocument;
          var scene = doc && doc.querySelector('a-scene');
          if (scene) ready = !!scene.hasLoaded;
          else ready = !!(doc && doc.readyState === 'complete');
        } catch (e) {
          ready = true;
        }
        if (ready || Date.now() - started > 6000) swap();
      }, 100);
    });
    // Safety net: swap even if the load event never fires
    setTimeout(swap, 9000);
    next.src = url;
  }

  // During keyboard tab navigation reloads are deferred, so stepping across
  // several tabs doesn't restart the (camera-using) preview each time.
  function reloadIframe(html) {
    if (_iframeTimer) clearTimeout(_iframeTimer);
    if (_tabNavActive) {
      _iframeTimer = setTimeout(function () { _doReloadIframe(html); }, 2000);
    } else {
      _doReloadIframe(html);
    }
  }

  function doTransform(xmlStr) {
    if (!xslString || !xmlStr || !xmlStr.trim()) return;
    try {
      var check = new DOMParser().parseFromString(xmlStr, 'text/xml');
      if (check.getElementsByTagName('parsererror').length > 0) {
        showError('XML Error: ' + check.getElementsByTagName('parsererror')[0].textContent.substring(0, 200));
        return;
      }
      var engine = getXsltEngine();
      if (!engine) {
        showError('xslt-processor library not loaded. Check internet connection.');
        return;
      }
      var result = engine.process(xmlStr, xslString);
      if (result && typeof result.then === 'function') {
        result.then(applyResult).catch(function (e) { showError('XSLT Error: ' + e.message); });
      } else {
        applyResult(result);
      }
    } catch (e) {
      showError('Error: ' + e.message);
    }
  }

  function applyResult(resultStr) {
    if (typeof resultStr !== 'string') resultStr = String(resultStr);
    resultStr = fixXhtmlToHtml(resultStr);
    resultStr = tidyHtml(resultStr);

    // Blob URLs have no base; anchor relative references to this page's folder
    var baseHref = window.location.href.replace(/[^\/]*$/, '');
    if (resultStr.indexOf('<base ') === -1) {
      resultStr = resultStr.replace(/<head>/i, '<head>\n  <base href="' + baseHref + '">');
    }
    resultStr = resultStr.replace(/url="(?!https?:\/\/|data:|blob:|\/|#)([^"]+)"/gi, function (m, path) {
      return 'url="' + baseHref + path + '"';
    });

    lastHtmlRaw = resultStr;
    window._popupCode = resultStr;
    lastHtmlPreview = resultStr.indexOf('</head>') !== -1
      ? resultStr.replace('</head>', VR_SUPPRESS + '</head>')
      : resultStr + VR_SUPPRESS;
    lastHtmlInspector = resultStr.indexOf('</head>') !== -1
      ? resultStr.replace('</head>', VR_SUPPRESS + INSPECTOR_INJECT + '</head>')
      : resultStr + VR_SUPPRESS + INSPECTOR_INJECT;

    if (htmlMonacoEditor) htmlMonacoEditor.setValue(lastHtmlRaw);
    else if (fallbackHtmlCode) fallbackHtmlCode.value = lastHtmlRaw;

    if (activePreviewTab === 'preview') reloadIframe(lastHtmlPreview);
    else if (activePreviewTab === 'inspector') reloadIframe(lastHtmlInspector);
    showError(null);

    refreshPopups();
  }

  function reloadPopup(win, html, title) {
    var titled = html.replace('</head>', '<scr' + 'ipt>document.title="' + title + '";</' + 'script></head>');
    var blob = new Blob([titled], { type: 'text/html;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    win.location.href = url;
    setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
  }

  function refreshPopups() {
    var needRefocus = false;
    if (_previewPopup && !_previewPopup.closed) {
      reloadPopup(_previewPopup, lastHtmlPreview, 'AR Preview');
      needRefocus = true;
    }
    if (_inspectorPopup && !_inspectorPopup.closed) {
      reloadPopup(_inspectorPopup, lastHtmlInspector, 'AR Inspector');
      needRefocus = true;
    }
    // Navigating the popups steals focus; take it back so typing continues
    if (needRefocus) {
      var refocus = function () {
        window.focus();
        if (window._monacoEditor) window._monacoEditor.focus();
      };
      setTimeout(refocus, 200);
      setTimeout(refocus, 600);
    }
  }

  /* ================================================================
   * 8. File load/save and drag & drop
   * ================================================================ */

  function loadXslFromString(str, fileName) {
    try {
      var doc = new DOMParser().parseFromString(str, 'text/xml');
      if (doc.getElementsByTagName('parsererror').length > 0) {
        throw new Error(doc.getElementsByTagName('parsererror')[0].textContent);
      }
    } catch (e) {
      xslString = null;
      showError('XSL Error: ' + e.message);
      return;
    }
    xslString = str;
    console.log('[Editor] XSL loaded:', fileName);
    xslDropOverlay.classList.remove('show');
    showError(null);
    var xml = getEditorValue();
    if (xml) doTransform(xml);
  }

  function tryFetchXsl() {
    fetch('aframe.xsl')
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      })
      .then(function (t) { loadXslFromString(t, 'aframe.xsl'); })
      .catch(function () {
        showError('Please select an XSL file');
        xslDropOverlay.classList.add('show');
      });
  }

  function readFileAsText(file, onLoad) {
    var reader = new FileReader();
    reader.onload = function (ev) { onLoad(ev.target.result); };
    reader.readAsText(file, 'UTF-8');
  }

  xslFileInput.addEventListener('change', function (e) {
    var file = e.target.files[0];
    if (!file) return;
    readFileAsText(file, function (text) { loadXslFromString(text, file.name); });
    xslFileInput.value = '';
  });

  xslDropOverlay.addEventListener('dragover', function (e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });
  xslDropOverlay.addEventListener('drop', function (e) {
    e.preventDefault();
    var file = e.dataTransfer.files[0];
    if (!file) return;
    readFileAsText(file, function (text) { loadXslFromString(text, file.name); });
  });

  xmlFileInput.addEventListener('change', function (e) {
    var file = e.target.files[0];
    if (!file) return;
    readFileAsText(file, function (text) {
      addXmlTab(file.name.replace(/\.[^.]+$/, ''), text);
      closeOpenDialog();
    });
    xmlFileInput.value = '';
  });

  /* ---- Open dialog: local file (click or drop) / URL / QR scan ---- */

  var openDialogOverlay = document.getElementById('open-dialog-overlay');
  var odDropZone = document.getElementById('od-drop-zone');
  var odUrlInput = document.getElementById('od-url-input');
  var odError = document.getElementById('od-error');
  var odQrArea = document.getElementById('od-qr-area');
  var odQrVideo = document.getElementById('od-qr-video');
  var odQrBtn = document.getElementById('od-qr-btn');
  var _qrStream = null;
  var _qrTimer = null;

  function showOpenDialog() {
    odError.textContent = '';
    odUrlInput.value = '';
    openDialogOverlay.classList.add('show');
    odUrlInput.focus();
  }

  function closeOpenDialog() {
    stopQrScan();
    openDialogOverlay.classList.remove('show');
  }

  function tabNameFromUrl(url) {
    var base = url.split(/[?#]/)[0].split('/').pop() || 'remote';
    try { base = decodeURIComponent(base); } catch (e) { /* keep raw */ }
    return base.replace(/\.[^.]+$/, '') || 'remote';
  }

  // Direct fetch first; if the server does not allow CORS (e.g.
  // festodidacticsw.azurewebsites.net), retry through a public CORS proxy.
  function fetchXmlWithFallback(url) {
    var proxied = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url);
    var check = function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    };
    return fetch(url).then(check).catch(function (directErr) {
      // An HTTP status is a definitive answer; only network/CORS failures
      // are worth retrying through the proxy
      if (/^HTTP \d+/.test(directErr.message)) throw directErr;
      return fetch(proxied).then(check).catch(function () { throw directErr; });
    });
  }

  function loadXmlFromUrl(url) {
    url = (url || '').trim();
    if (!url) return;
    odError.textContent = '';
    odError.style.color = '';
    odError.textContent = 'Loading ' + url + ' ...';
    odError.style.color = '#999';
    fetchXmlWithFallback(url)
      .then(function (text) {
        var doc = new DOMParser().parseFromString(text, 'text/xml');
        if (doc.getElementsByTagName('parsererror').length > 0) {
          throw new Error('Not a valid XML document');
        }
        addXmlTab(tabNameFromUrl(url), text);
        closeOpenDialog();
      })
      .catch(function (e) {
        odError.style.color = '';
        odError.textContent = 'Failed to load: ' + e.message;
      });
  }

  /* QR scanning: native BarcodeDetector when available, jsQR (CDN) otherwise */
  function stopQrScan() {
    if (_qrTimer) { clearInterval(_qrTimer); _qrTimer = null; }
    if (_qrStream) {
      _qrStream.getTracks().forEach(function (t) { t.stop(); });
      _qrStream = null;
    }
    odQrVideo.srcObject = null;
    odQrArea.style.display = 'none';
    odQrBtn.textContent = '\u{1F4F7} Start camera';
  }

  function onQrResult(text) {
    stopQrScan();
    odUrlInput.value = text;
    if (/^https?:\/\//i.test(text)) loadXmlFromUrl(text);
    else odError.textContent = 'QR code does not contain a URL: ' + text;
  }

  function loadJsQr() {
    return new Promise(function (resolve, reject) {
      if (window.jsQR) return resolve(window.jsQR);
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
      s.onload = function () { resolve(window.jsQR); };
      s.onerror = function () { reject(new Error('failed to load jsQR')); };
      document.head.appendChild(s);
    });
  }

  function startQrScan() {
    odError.textContent = '';
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then(function (stream) {
        _qrStream = stream;
        odQrVideo.srcObject = stream;
        odQrVideo.play();
        odQrArea.style.display = 'block';
        odQrBtn.textContent = 'Stop camera';
        if ('BarcodeDetector' in window) {
          var detector = new window.BarcodeDetector({ formats: ['qr_code'] });
          _qrTimer = setInterval(function () {
            detector.detect(odQrVideo).then(function (codes) {
              if (codes.length && codes[0].rawValue) onQrResult(codes[0].rawValue);
            }).catch(function () { /* frame not ready */ });
          }, 300);
        } else {
          loadJsQr().then(function (jsQR) {
            var canvas = document.createElement('canvas');
            var ctx = canvas.getContext('2d', { willReadFrequently: true });
            _qrTimer = setInterval(function () {
              if (!odQrVideo.videoWidth) return;
              canvas.width = odQrVideo.videoWidth;
              canvas.height = odQrVideo.videoHeight;
              ctx.drawImage(odQrVideo, 0, 0);
              var img = ctx.getImageData(0, 0, canvas.width, canvas.height);
              var code = jsQR(img.data, img.width, img.height);
              if (code && code.data) onQrResult(code.data);
            }, 300);
          }).catch(function (e) { odError.textContent = e.message; });
        }
      })
      .catch(function (e) {
        odError.textContent = 'Camera unavailable: ' + e.message;
      });
  }

  document.getElementById('btn-open-xml').addEventListener('click', showOpenDialog);
  document.getElementById('od-close').addEventListener('click', closeOpenDialog);
  openDialogOverlay.addEventListener('click', function (e) {
    if (e.target === openDialogOverlay) closeOpenDialog();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && openDialogOverlay.classList.contains('show')) closeOpenDialog();
  });

  // Drop zone: click opens the OS file picker, drag & drop reads the file
  odDropZone.addEventListener('click', function () { xmlFileInput.click(); });
  odDropZone.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); xmlFileInput.click(); }
  });
  odDropZone.addEventListener('dragover', function (e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    odDropZone.classList.add('drag-over');
  });
  odDropZone.addEventListener('dragleave', function () {
    odDropZone.classList.remove('drag-over');
  });
  odDropZone.addEventListener('drop', function (e) {
    e.preventDefault();
    odDropZone.classList.remove('drag-over');
    var file = e.dataTransfer.files[0];
    if (!file) return;
    readFileAsText(file, function (text) {
      addXmlTab(file.name.replace(/\.[^.]+$/, ''), text);
      closeOpenDialog();
    });
  });

  document.getElementById('od-url-load').addEventListener('click', function () {
    loadXmlFromUrl(odUrlInput.value);
  });
  odUrlInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); loadXmlFromUrl(odUrlInput.value); }
  });
  odQrBtn.addEventListener('click', function () {
    if (_qrStream) stopQrScan();
    else startQrScan();
  });

  document.getElementById('btn-save-xml').addEventListener('click', function () {
    var tab = xmlTabs.find(function (t) { return t.id === activeXmlTabId; });
    downloadBlob(getEditorValue(), 'application/xml;charset=utf-8', (tab ? tab.name : 'scene') + '.xml');
  });

  btnSaveHtml.addEventListener('click', function () {
    if (!lastHtmlRaw) return;
    downloadBlob(lastHtmlRaw, 'text/html;charset=utf-8', 'scene.htm');
  });

  function downloadBlob(content, type, filename) {
    var blob = new Blob([content], { type: type });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // Dropping an XML file on the editor pane opens it as a new tab
  editorPane.addEventListener('dragover', function (e) {
    if (e.dataTransfer.types.indexOf('Files') >= 0) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      editorPane.classList.add('drop-highlight');
    }
  });
  editorPane.addEventListener('dragleave', function () {
    editorPane.classList.remove('drop-highlight');
  });
  editorPane.addEventListener('drop', function (e) {
    editorPane.classList.remove('drop-highlight');
    if (!e.dataTransfer.files.length) return;
    e.preventDefault();
    var file = e.dataTransfer.files[0];
    readFileAsText(file, function (text) { addXmlTab(file.name.replace(/\.[^.]+$/, ''), text); });
  });

  /* ================================================================
   * 9. Editors (Monaco with textarea fallback)
   * ================================================================ */

  function getEditorValue() {
    if (window._monacoEditor) return window._monacoEditor.getValue();
    return fallbackEditor.value;
  }

  function setEditorValue(val) {
    if (window._monacoEditor) window._monacoEditor.setValue(val);
    else fallbackEditor.value = val;
  }

  var debounceTimer = null;
  function onInput(val) {
    if (!xmlTabs.length) return;
    var active = xmlTabs.find(function (t) { return t.id === activeXmlTabId; });
    if (active) active.content = val;
    saveXmlTabs();
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () { doTransform(val); }, 500);
  }

  // Replace non-breaking spaces on paste (they break XML attribute parsing)
  function sanitizeNbsp(editor) {
    var replacing = false;
    editor.onDidPaste(function () {
      if (replacing) return;
      var model = editor.getModel();
      var text = model.getValue();
      var cleaned = text.replace(/\u00A0/g, ' ');
      if (cleaned !== text) {
        replacing = true;
        var pos = editor.getPosition();
        model.setValue(cleaned);
        try { editor.setPosition(pos); } catch (e) { /* position out of range */ }
        replacing = false;
      }
    });
  }

  // Color swatches for rgba/rgb/tint/backrgba hex attributes in the XML editor
  function parseHexPair(hex, i) { return parseInt(hex.substring(i, i + 2), 16) / 255; }
  function parseHexDigit(hex, i) { return parseInt(hex[i] + hex[i], 16) / 255; }

  function hexToColor(hex) {
    switch (hex.length) {
      case 3: return { red: parseHexDigit(hex, 0), green: parseHexDigit(hex, 1), blue: parseHexDigit(hex, 2), alpha: 1 };
      case 4: return { red: parseHexDigit(hex, 0), green: parseHexDigit(hex, 1), blue: parseHexDigit(hex, 2), alpha: parseHexDigit(hex, 3) };
      case 6: return { red: parseHexPair(hex, 0), green: parseHexPair(hex, 2), blue: parseHexPair(hex, 4), alpha: 1 };
      case 8: return { red: parseHexPair(hex, 0), green: parseHexPair(hex, 2), blue: parseHexPair(hex, 4), alpha: parseHexPair(hex, 6) };
      default: return null;
    }
  }

  var xmlColorProvider = {
    provideDocumentColors: function (model) {
      var matches = [];
      var text = model.getValue();
      var re = /((?:back)?rgba?)="([0-9a-fA-F]{3,8})"/g;
      var m;
      while ((m = re.exec(text)) !== null) {
        var attr = m[1];
        var hex = m[2];
        var color = hexToColor(hex);
        if (!color) continue;
        var offset = m.index + attr.length + 2;
        var start = model.getPositionAt(offset);
        var end = model.getPositionAt(offset + hex.length);
        matches.push({
          color: color,
          range: { startLineNumber: start.lineNumber, startColumn: start.column, endLineNumber: end.lineNumber, endColumn: end.column }
        });
      }
      return matches;
    },
    provideColorPresentations: function (model, info) {
      var toHex = function (v) { return ('0' + Math.round(v * 255).toString(16)).slice(-2); };
      var hex6 = toHex(info.color.red) + toHex(info.color.green) + toHex(info.color.blue);
      var alpha = Math.round(info.color.alpha * 255);
      var full = alpha < 255 ? hex6 + toHex(info.color.alpha) : hex6;
      // Offer the short form (e.g. "f00") when every pair repeats
      var canShorten = true;
      for (var i = 0; i < full.length; i += 2) {
        if (full[i] !== full[i + 1]) { canShorten = false; break; }
      }
      var presentations = [];
      if (canShorten) {
        var short = '';
        for (var j = 0; j < full.length; j += 2) short += full[j];
        presentations.push({ label: short, textEdit: { range: info.range, text: short } });
      }
      presentations.push({ label: full, textEdit: { range: info.range, text: full } });
      return presentations;
    }
  };

  var xmlFormattingProvider = {
    provideDocumentFormattingEdits: function (model) {
      var text = model.getValue().replace(/\u00A0/g, ' ');
      try {
        var lines = text.replace(/>\s*</g, '>\n<').split('\n');
        var indent = 0;
        var result = [];
        for (var i = 0; i < lines.length; i++) {
          var line = lines[i].trim();
          if (!line) continue;
          if (line.match(/^<\/\w/)) indent = Math.max(0, indent - 1);
          result.push('  '.repeat(indent) + line);
          if (line.match(/^<\w/) && !line.match(/\/>$/) && !line.match(/^<\?/) && !line.match(/<\/\w[^>]*>$/)) indent++;
        }
        text = result.join('\n');
      } catch (e) { /* keep original text */ }
      return [{ range: model.getFullModelRange(), text: text }];
    }
  };

  function initMonaco() {
    monacoLoaded = true;
    fallbackEditor.style.display = 'none';
    fallbackHtmlCode.style.display = 'none';

    var tab = xmlTabs.find(function (t) { return t.id === activeXmlTabId; });
    var editor = monaco.editor.create(document.getElementById('editor-container'), {
      value: tab ? tab.content : '',
      language: 'xml',
      theme: 'vs-dark',
      fontSize: 14,
      minimap: { enabled: false },
      automaticLayout: true,
      wordWrap: 'on',
      scrollBeyondLastLine: false,
      tabSize: 2,
      renderWhitespace: 'selection'
    });
    window._monacoEditor = editor;
    editor.onDidChangeModelContent(function () { onInput(editor.getValue()); });
    sanitizeNbsp(editor);

    monaco.languages.registerColorProvider('xml', xmlColorProvider);
    monaco.languages.registerDocumentFormattingEditProvider('xml', xmlFormattingProvider);

    htmlMonacoEditor = monaco.editor.create(document.getElementById('html-code-container'), {
      value: '',
      language: 'html',
      theme: 'vs-dark',
      fontSize: 13,
      minimap: { enabled: false },
      automaticLayout: true,
      wordWrap: 'on',
      scrollBeyondLastLine: false,
      readOnly: true,
      tabSize: 2
    });

    renderXmlTabs();
    renderPreviewTabs();
    tryFetchXsl();
  }

  function initFallback() {
    if (monacoLoaded) return;
    var tab = xmlTabs.find(function (t) { return t.id === activeXmlTabId; });
    fallbackEditor.value = tab ? tab.content : '';
    fallbackEditor.style.display = 'block';
    fallbackHtmlCode.style.display = 'block';

    fallbackEditor.addEventListener('input', function () { onInput(fallbackEditor.value); });
    fallbackEditor.addEventListener('keydown', function (e) {
      if (e.key === 'Tab') {
        e.preventDefault();
        var start = this.selectionStart;
        var end = this.selectionEnd;
        this.value = this.value.substring(0, start) + '  ' + this.value.substring(end);
        this.selectionStart = this.selectionEnd = start + 2;
        onInput(this.value);
      }
    });
    fallbackEditor.addEventListener('paste', function () {
      setTimeout(function () {
        var v = fallbackEditor.value;
        var cleaned = v.replace(/\u00A0/g, ' ');
        if (cleaned !== v) {
          fallbackEditor.value = cleaned;
          onInput(cleaned);
        }
      }, 0);
    });

    renderXmlTabs();
    renderPreviewTabs();
    tryFetchXsl();
  }

  var loaderScript = document.createElement('script');
  loaderScript.src = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/min/vs/loader.js';
  loaderScript.onload = function () {
    try {
      require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/min/vs' } });
      require(['vs/editor/editor.main'], initMonaco, function () { initFallback(); });
    } catch (e) {
      initFallback();
    }
  };
  loaderScript.onerror = function () { initFallback(); };
  document.head.appendChild(loaderScript);
  setTimeout(function () { if (!monacoLoaded) initFallback(); }, 8000);

  /* ================================================================
   * 10. Layout and keyboard shortcuts
   * ================================================================ */

  function layoutEditors() {
    if (window._monacoEditor) window._monacoEditor.layout();
    if (htmlMonacoEditor) htmlMonacoEditor.layout();
  }

  // Draggable divider between the panes
  (function () {
    var divider = document.getElementById('divider');
    var dragging = false;
    divider.addEventListener('mousedown', function (e) {
      e.preventDefault();
      dragging = true;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      previewIframe.style.pointerEvents = 'none';
    });
    window.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      var w = Math.max(200, Math.min(window.innerWidth - 200, e.clientX));
      editorPane.style.width = w + 'px';
      layoutEditors();
    });
    window.addEventListener('mouseup', function () {
      if (!dragging) return;
      dragging = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      previewIframe.style.pointerEvents = '';
      layoutEditors();
    });
  })();

  window.addEventListener('resize', layoutEditors);

  // While a popup window is open, the editor takes the full width; the split
  // layout is restored once every popup is closed.
  function _expandEditor() {
    document.getElementById('preview-pane').style.display = 'none';
    document.getElementById('divider').style.display = 'none';
    editorPane.style.width = '';
    editorPane.style.flex = '1';
    if (window._monacoEditor) window._monacoEditor.layout();
  }

  function _restoreLayout() {
    document.getElementById('preview-pane').style.display = '';
    document.getElementById('divider').style.display = '';
    editorPane.style.flex = '';
    editorPane.style.width = '500px';
    layoutEditors();
  }

  function _anyPopupOpen() {
    return (_previewPopup && !_previewPopup.closed) ||
      (_inspectorPopup && !_inspectorPopup.closed) ||
      (_codePopup && !_codePopup.closed);
  }

  function _onPopupOpen() {
    _expandEditor();
    if (_popupCheckTimer) clearInterval(_popupCheckTimer);
    _popupCheckTimer = setInterval(function () {
      if (!_anyPopupOpen()) {
        clearInterval(_popupCheckTimer);
        _popupCheckTimer = null;
        _restoreLayout();
      }
    }, 500);
  }

  function handleTabArrowKey(e) {
    var el = document.activeElement;
    if (!el || !el.classList.contains('dtab')) return false;
    e.preventDefault();
    var bar = el.closest('.tab-bar');
    if (!bar) return true;

    var tabs, cur, switchFn;
    if (bar.id === 'xml-tab-bar') {
      tabs = xmlTabs.map(function (t) { return t.id; });
      cur = activeXmlTabId;
      switchFn = switchXmlTab;
    } else if (bar.id === 'preview-tab-bar') {
      tabs = PREVIEW_TABS.map(function (t) { return t.id; });
      cur = activePreviewTab;
      switchFn = switchPreviewTab;
    } else {
      return true;
    }

    var idx = tabs.indexOf(cur);
    if (idx < 0) return true;
    var next = e.key === 'ArrowLeft' ? idx - 1 : idx + 1;
    if (next < 0 || next >= tabs.length) return true;

    // Defer preview reloads while stepping through XML tabs with the keyboard
    if (bar.id === 'xml-tab-bar') _tabNavActive = true;
    switchFn(tabs[next]);
    if (bar.id === 'xml-tab-bar') setTimeout(function () { _tabNavActive = false; }, 3000);
    return true;
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      if (handleTabArrowKey(e)) return;
    }

    // Ctrl/Cmd+Z / +Y: undo/redo tab operations (Monaco handles its own text undo)
    var ae = document.activeElement;
    if (ae && ae.closest && ae.closest('.monaco-editor')) return;
    var isMac = navigator.platform.indexOf('Mac') > -1;
    var mod = isMac ? e.metaKey : e.ctrlKey;
    if (!mod) return;
    if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); _undoTabs(); return; }
    if (e.key === 'y') { e.preventDefault(); _redoTabs(); return; }
  });

  function _isMobile() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  function _goFullscreen() {
    var el = previewIframe;
    if (el.requestFullscreen) el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else if (el.msRequestFullscreen) el.msRequestFullscreen();
  }

  /* ================================================================
   * Toolbar wiring
   * ================================================================ */

  function setupScrollBtns(leftId, rightId, barId) {
    document.getElementById(leftId).addEventListener('click', function () {
      document.getElementById(barId).scrollLeft -= 150;
    });
    document.getElementById(rightId).addEventListener('click', function () {
      document.getElementById(barId).scrollLeft += 150;
    });
  }
  setupScrollBtns('xml-scroll-left', 'xml-scroll-right', 'xml-tab-bar');
  setupScrollBtns('pv-scroll-left', 'pv-scroll-right', 'preview-tab-bar');

  document.getElementById('xml-add-btn').addEventListener('click', function () {
    addXmlTab('untitled', '<AUGMENTATION>\n</AUGMENTATION>');
  });
})();
