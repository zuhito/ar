<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="xml" encoding="UTF-8" indent="yes" omit-xml-declaration="yes" />
  <xsl:strip-space elements="*" />

  <!-- Scenes reference their assets relatively (FDAR spec), so a stylesheet
       run on its own has nothing to resolve them against. Anchor them to
       where the scenes are published; override with
       `xsltproc - -stringparam assetbase <dir-with-trailing-slash>` when the
       assets live elsewhere, or with '' to keep the paths relative (the
       editor does that — it emits its own <base href> per tab). -->
  <xsl:param name="assetbase" select="'https://festodidacticsw.azurewebsites.net/ar/cp-cloud_om/'" />

  <!-- Prefix a relative asset reference with $assetbase. Anything already
       absolute, or a bare keyword like 'cube'/'fdar_white' (no extension),
       is passed through untouched. -->
  <xsl:template name="asset-url">
    <xsl:param name="ref" />
    <xsl:choose>
      <xsl:when test="$assetbase = '' or $ref = ''
                      or not(contains($ref, '.'))
                      or starts-with($ref, 'http://') or starts-with($ref, 'https://')
                      or starts-with($ref, 'data:') or starts-with($ref, 'blob:')
                      or starts-with($ref, '/') or starts-with($ref, '#')">
        <xsl:value-of select="$ref" />
      </xsl:when>
      <xsl:otherwise><xsl:value-of select="concat($assetbase, $ref)" /></xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template match="/AUGMENTATION">
    <xsl:text disable-output-escaping="yes">&lt;!DOCTYPE html&gt;&#10;</xsl:text>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <title><xsl:choose><xsl:when test="@name != ''"><xsl:value-of select="@name"/></xsl:when><xsl:otherwise>AR App</xsl:otherwise></xsl:choose></title>
        <script src="https://aframe.io/releases/1.7.1/aframe.min.js"><xsl:text> </xsl:text></script>
        <style><xsl:text disable-output-escaping="yes">
      /* Embedded scenes have no intrinsic size; guarantee they fill the page
         (AR.js may override with its own video-fitting geometry later) */
      html, body { height: 100%; }
      a-scene { display: block; width: 100%; height: 100%; }
      /* Indeterminate progress bar shown during heavy work (scene boot,
         marker-free re-fit). Hidden unless #fdar-progress has .active. */
      #fdar-progress {
        position: fixed; top: 0; left: 0; right: 0; height: 3px; z-index: 10000;
        background: rgba(10,132,255,0.18); overflow: hidden;
        opacity: 0; transition: opacity 0.2s; pointer-events: none;
      }
      #fdar-progress.active { opacity: 1; }
      #fdar-progress:before {
        content: ''; position: absolute; top: 0; height: 100%; width: 40%;
        background: #0a84ff; animation: fdar-progress-slide 1.1s ease-in-out infinite;
      }
      @keyframes fdar-progress-slide {
        0% { left: -40%; } 100% { left: 100%; }
      }
        </xsl:text></style>
        
        <xsl:if test="TARGETBASE or IMGTARGET or TARGET">
          <script src="https://raw.githack.com/AR-js-org/AR.js/master/aframe/build/aframe-ar.js"><xsl:text> </xsl:text></script>
        </xsl:if>

        <xsl:if test="//VALUESERVER/WEBSOCKET">
          <style><xsl:text disable-output-escaping="yes">
      #ws-status-overlay {
        position: fixed; top: 12px; right: 16px; z-index: 9999;
        display: flex; align-items: center; gap: 8px;
        background: rgba(0,0,0,0.55); padding: 6px 14px 6px 10px;
        border-radius: 20px; pointer-events: none; user-select: none;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      #ws-status-dot {
        width: 12px; height: 12px; border-radius: 50%;
        background: #ff4444; box-shadow: 0 0 6px #ff4444;
        transition: background 0.3s, box-shadow 0.3s;
      }
      #ws-status-dot.connected { background: #44ff44; box-shadow: 0 0 8px #44ff44; }
      #ws-status-label { color: #fff; font-size: 13px; letter-spacing: 0.5px; }
          </xsl:text></style>
        </xsl:if>
        
        <xsl:if test="TARGETBASE or IMGTARGET or TARGET">
          <style><xsl:text disable-output-escaping="yes">
      #marker-free-toggle {
        position: fixed; top: 12px; left: 16px; z-index: 9999;
        display: flex; align-items: center; gap: 8px;
        background: rgba(0,0,0,0.55); padding: 8px 14px; border-radius: 22px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        user-select: none;
      }
      .mf-switch { position: relative; display: inline-block; width: 40px; height: 22px; }
      .mf-switch input { opacity: 0; width: 0; height: 0; position: absolute; }
      .mf-slider { position: absolute; top: 0; left: 0; right: 0; bottom: 0;
        background: #666; border-radius: 22px; transition: background 0.2s; cursor: pointer; }
      .mf-slider:before { content: ''; position: absolute; width: 18px; height: 18px;
        left: 2px; top: 2px; background: #fff; border-radius: 50%; transition: transform 0.2s; }
      .mf-switch input:checked + .mf-slider { background: #0a84ff; }
      .mf-switch input:checked + .mf-slider:before { transform: translateX(18px); }
      #mf-label { color: #fff; font-size: 12px; letter-spacing: 0.3px; }
          </xsl:text></style>
        </xsl:if>
        <xsl:if test="@viewdisplay = 'true' or @viewswitch = 'true'">
          <style><xsl:text disable-output-escaping="yes">
      #view-hud { position: fixed; bottom: 14px; left: 50%; transform: translateX(-50%);
        z-index: 9999; display: flex; align-items: center; gap: 10px;
        background: rgba(0,0,0,0.55); padding: 6px 14px; border-radius: 20px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
      #view-hud button { background: none; border: none; color: #ccc; font-size: 14px; cursor: pointer; }
      #view-hud button:hover { color: #fff; }
      #view-name { color: #fff; font-size: 13px; min-width: 60px; text-align: center; }
          </xsl:text></style>
        </xsl:if>

        <script>
          <xsl:text disable-output-escaping="yes">&#10;      // Strict FDAR bool conversion
      window.fdarTruthy = function (v) {
        var s = String(v).toLowerCase();
        return s === 'true' || s === 'wahr' || s === 'on' || s === 'enable' || s === 'show';
      };
      // hex colour (3/4/6/8 digits, optional #) -> { color, opacity }
      window.fdarParseHex = function (hex) {
        if (!hex) return null;
        if (hex.charAt(0) === '#') hex = hex.substring(1);
        var r = hex.length &gt;= 6 ? hex.substring(0, 6) : hex.substring(0, 3);
        var a = 'ff';
        if (hex.length === 8) a = hex.substring(6, 8);
        else if (hex.length === 4) a = hex.substring(3, 4) + hex.substring(3, 4);
        return { color: '#' + r, opacity: parseInt(a, 16) / 255 };
      };
      window.fdarHiddenChain = function (el) {
        var o = el.object3D;
        while (o) { if (o.visible === false) return true; o = o.parent; }
        return false;
      };
      // Progress bar for heavy work: reference-counted so overlapping tasks
      // (scene boot + a marker-free re-fit) keep it visible until all finish.
      // Starts at 1 for the initial scene boot, matching the .active markup.
      window._fdarBusy = 1;
      window.fdarProgress = function (on) {
        window._fdarBusy = Math.max(0, window._fdarBusy + (on ? 1 : -1));
        var bar = document.getElementById('fdar-progress');
        if (bar) bar.classList.toggle('active', window._fdarBusy &gt; 0);
      };
      // Clear the initial boot hold once preparation is done. The bar covers
      // preparation only (XSLT output booting, entity setup) — never the
      // ongoing AR camera pipeline: on webcam scenes 'loaded' can be held up
      // by camera initialization, so those clear as soon as rendering starts.
      document.addEventListener('DOMContentLoaded', function () {
        var scene = document.querySelector('a-scene');
        var clear = function () { if (window._fdarBoot) { window._fdarBoot = false; window.fdarProgress(false); } };
        window._fdarBoot = true;
        if (!scene) { clear(); return; }
        if (scene.hasLoaded) { clear(); }
        else if (scene.hasAttribute('arjs')) {
          requestAnimationFrame(function () { requestAnimationFrame(clear); });
        }
        else { scene.addEventListener('loaded', clear, { once: true }); }
        // Safety: never leave the bar stuck if 'loaded' never fires
        setTimeout(clear, 12000);
      });</xsl:text>

          <xsl:if test="//LINK or //SWITCH or //STREAMER">
            <xsl:text disable-output-escaping="yes">&#10;      // Keyboard navigation for clickable entities (Tab to move, Enter/Space to activate)
      AFRAME.registerComponent('keyboard-nav', {
        schema: {
          selector: {type: 'string', default: '.clickable'},
          wrap: {type: 'boolean', default: true}
        },
        init: function () {
          var sc = this.el;
          var self = this;
          self.items = [];
          self.index = -1;

          function refresh() {
            self.items = Array.prototype.slice.call(document.querySelectorAll(self.data.selector))
              .filter(function(el){ return el &amp;&amp; el.isConnected; });
            if (self.items.length === 0) { self.index = -1; return; }
            if (self.index &lt; 0) self.index = 0;
            if (self.index &gt;= self.items.length) self.index = self.items.length - 1;
          }

          function setActive(newIndex) {
            refresh();
            if (self.items.length === 0) return;
            var oldEl = (self.index &gt;= 0 &amp;&amp; self.index &lt; self.items.length) ? self.items[self.index] : null;
            var idx = newIndex;
            if (idx &lt; 0) idx = self.data.wrap ? (self.items.length - 1) : 0;
            if (idx &gt;= self.items.length) idx = self.data.wrap ? 0 : (self.items.length - 1);
            self.index = idx;
            var el = self.items[self.index];

            // Visual feedback: reuse hover-outline by emitting mouseenter/mouseleave
            if (oldEl &amp;&amp; oldEl !== el) { oldEl.emit('mouseleave'); }
            if (el) {
              el.emit('mouseenter');
              // try to focus DOM node for accessibility (best-effort)
              if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
              try { el.focus &amp;&amp; el.focus(); } catch(e) {}
            }
          }

          function activate() {
            refresh();
            if (self.items.length === 0) return;
            var el = self.items[self.index];
            if (!el) return;
            // Trigger click-equivalent
            el.emit('click');
          }

          function onKeyDown(e) {
            // Ignore when typing in an input/textarea
            var t = e.target;
            if (t &amp;&amp; (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;

            if (e.key === 'Tab') {
              e.preventDefault();
              setActive(self.index + (e.shiftKey ? -1 : 1));
            } else if (e.key === 'Enter' || e.key === ' ') {
              // Space is reported as ' ' in many browsers
              e.preventDefault();
              activate();
            }
          }

          sc.addEventListener('loaded', function () {
            refresh();
          });

          // Ensure keyboard-nav is active even if scene attribute injection failed
          if (!sc.hasAttribute('keyboard-nav')) { sc.setAttribute('keyboard-nav', ''); }

          // Keep list updated (entities may be created dynamically)
          self._refreshTimer = setInterval(refresh, 1000);
          window.addEventListener('keydown', onKeyDown, true);

          self._cleanup = function () {
            try { clearInterval(self._refreshTimer); } catch(e) {}
            window.removeEventListener('keydown', onKeyDown, true);
          };
        },
        remove: function () {
          if (this._cleanup) this._cleanup();
        }
      });</xsl:text>
          </xsl:if>


          <xsl:if test="(TARGETBASE or IMGTARGET) and (//LINK or //SWITCH or //STREAMER)">
            <xsl:text disable-output-escaping="yes">&#10;      // AR.js rewrites camera.projectionMatrix from the video calibration every
      // frame but never refreshes camera.projectionMatrixInverse, so THREE's
      // unproject (used by every raycast: mouse cursor, keyboard, marker-free)
      // reads a stale inverse and the hit point drifts off the pointer — you
      // had to aim slightly beside an icon to click it. Refresh the inverse at
      // the moment of the raycast so hits land exactly under the cursor. This
      // is projection-accurate, unlike a fixed pixel offset, and needs no tick
      // ordering guarantees.
      AFRAME.registerComponent('ar-cursor-fix', {
        init: function () {
          if (window._fdarRaycastPatched) return;
          window._fdarRaycastPatched = true;
          var THREE = AFRAME.THREE;
          var orig = THREE.Raycaster.prototype.setFromCamera;
          THREE.Raycaster.prototype.setFromCamera = function (coords, camera) {
            if (camera &amp;&amp; camera.isPerspectiveCamera) {
              camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
            }
            return orig.call(this, coords, camera);
          };
        }
      });</xsl:text>
          </xsl:if>

          <xsl:if test="//VALUESERVER/WEBSOCKET">
            <xsl:text disable-output-escaping="yes">&#10;      window.wsConnectionCount = 0;
      window.updateWsStatus = function(isOpen) {
        if (isOpen) { window.wsConnectionCount++; }
        else { window.wsConnectionCount = Math.max(0, window.wsConnectionCount - 1); }
        var dot = document.getElementById('ws-status-dot');
        if (dot) {
          if (window.wsConnectionCount &gt; 0) { dot.classList.add('connected'); }
          else { dot.classList.remove('connected'); }
        }
      };</xsl:text>
          </xsl:if>

          <xsl:if test="//NODE[@view != '' or @show != '' or @collapse != ''] or @viewlist or @views">
            <xsl:text disable-output-escaping="yes">&#10;      // View system: fdar-visibility nodes toggle with the current view and
      // @anim: bound show/collapse variables; @view: links call fdarSetView
      window.fdarVars = {};
      window.fdarCurrentView = '</xsl:text><xsl:value-of select="substring-before(concat(@viewlist, @views, ','), ',')"/><xsl:text disable-output-escaping="yes">';
      window.fdarViewList = '</xsl:text><xsl:value-of select="concat(@viewlist, @views)"/><xsl:text disable-output-escaping="yes">'.split(',').filter(function (s) { return s !== ''; });
      window.fdarSetView = function (name) {
        window.fdarCurrentView = name;
        var label = document.getElementById('view-name');
        if (label) label.textContent = name;
        window.dispatchEvent(new CustomEvent('fdar-view-change', { detail: { view: name } }));
      };
      window.fdarViewStep = function (dir) {
        var l = window.fdarViewList;
        if (!l.length) return;
        var i = l.indexOf(window.fdarCurrentView);
        window.fdarSetView(l[(i + dir + l.length) % l.length]);
      };
      document.addEventListener('DOMContentLoaded', function () {
        var label = document.getElementById('view-name');
        if (label) label.textContent = window.fdarCurrentView;
      });
      window.addEventListener('fdar-variable-update', function (e) {
        window.fdarVars[e.detail.key] = e.detail.value;
        // Reserved variable: switching views remotely
        if (e.detail.key === 'fdarcurrentview') {
          var v = String(e.detail.value);
          if (window.fdarViewList.indexOf(v) !== -1) window.fdarSetView(v);
        }
      });
      AFRAME.registerComponent('fdar-visibility', {
        schema: {
          views: {type: 'string', default: ''},
          show: {type: 'string', default: ''},
          collapse: {type: 'string', default: ''}
        },
        init: function () {
          var self = this;
          var parse = function (raw) {
            if (raw.indexOf('@anim:') === 0) return { key: raw.substring(6).split(':')[0] };
            return { lit: raw };
          };
          this.showBind = parse(this.data.show);
          this.collapseBind = parse(this.data.collapse);
          this.viewList = this.data.views ? this.data.views.split(',') : null;
          window.addEventListener('fdar-view-change', function () { self.apply(); });
          window.addEventListener('fdar-variable-update', function (e) {
            if (e.detail.key === self.showBind.key || e.detail.key === self.collapseBind.key) self.apply();
          });
          this.el.addEventListener('loaded', function () { self.apply(); });
          this.apply();
        },
        resolve: function (bind, def) {
          if (bind.key) {
            var v = window.fdarVars[bind.key];
            return v === undefined ? def : window.fdarTruthy(v);
          }
          if (bind.lit === '' || bind.lit === undefined) return def;
          return window.fdarTruthy(bind.lit);
        },
        apply: function () {
          // Per spec: view and show affect only the elements directly contained
          // in the node (child NODEs are unaffected); collapse hides the subtree
          var viewOk = !this.viewList || this.viewList.indexOf(window.fdarCurrentView) !== -1;
          var showOk = this.resolve(this.showBind, true);
          var collapsed = this.resolve(this.collapseBind, false);
          this.el.object3D.visible = !collapsed;
          var contentVisible = viewOk &amp;&amp; showOk;
          for (var i = 0; i &lt; this.el.children.length; i++) {
            var c = this.el.children[i];
            if (!c.object3D) continue;
            if (c.classList &amp;&amp; c.classList.contains('fdar-node')) continue;
            c.object3D.visible = contentVisible;
          }
        }
      });</xsl:text>
          </xsl:if>

          <xsl:if test="//VALUESERVER">
            <xsl:text disable-output-escaping="yes">&#10;      // Central value-server runtime: connections dispatch fdar-variable-update
      // events; transmitters are registered for TRANSMIT sends
      window.fdarTransmitters = {};
      window.fdarDispatchVars = function (obj, prefix) {
        Object.keys(obj).forEach(function (k) {
          window.dispatchEvent(new CustomEvent('fdar-variable-update', { detail: { key: (prefix || '') + k, value: obj[k] } }));
        });
      };</xsl:text>
            <xsl:for-each select="//VALUESERVER/WEBSOCKET">
              <xsl:text disable-output-escaping="yes">&#10;      (function () {
        var url = '</xsl:text><xsl:value-of select="@url"/><xsl:text disable-output-escaping="yes">';
        var prefix = '</xsl:text><xsl:value-of select="@prefix"/><xsl:text disable-output-escaping="yes">';
        var transmitterId = '</xsl:text><xsl:value-of select="@transmitter"/><xsl:text disable-output-escaping="yes">';
        var connect = function () {
          var s = new WebSocket(url);
          if (transmitterId) window.fdarTransmitters[transmitterId] = s;
          s.onopen = function () { if (window.updateWsStatus) window.updateWsStatus(true); };
          s.onmessage = function (ev) {
            try { window.fdarDispatchVars(JSON.parse(ev.data), prefix); } catch (e) {}
          };
          s.onclose = function () { if (window.updateWsStatus) window.updateWsStatus(false); setTimeout(connect, 3000); };
          s.onerror = function () { s.close(); };
        };
        connect();
      })();</xsl:text>
            </xsl:for-each>
            <xsl:for-each select="//VALUESERVER/RESTJSON">
              <xsl:text disable-output-escaping="yes">&#10;      setInterval(function () {
        fetch('</xsl:text><xsl:value-of select="@url"/><xsl:text disable-output-escaping="yes">').then(function (r) { return r.json(); })
          .then(function (data) { window.fdarDispatchVars(data, '</xsl:text><xsl:value-of select="@prefix"/><xsl:text disable-output-escaping="yes">'); })
          .catch(function () {});
      }, 2000);</xsl:text>
            </xsl:for-each>
            <xsl:for-each select="//VALUESERVER/MQTT">
              <xsl:text disable-output-escaping="yes">&#10;      console.warn('FDAR: MQTT value servers are not supported in this web preview');</xsl:text>
            </xsl:for-each>
            <xsl:text disable-output-escaping="yes">&#10;      document.addEventListener('DOMContentLoaded', function () {
        setTimeout(function () {
          var data = {};</xsl:text>
            <xsl:for-each select="//VALUESERVER/@predefined">
              <xsl:text disable-output-escaping="yes">&#10;          try { Object.assign(data, </xsl:text><xsl:value-of select="."/><xsl:text disable-output-escaping="yes">); } catch (e) { console.warn('predefined parse failed', e); }</xsl:text>
            </xsl:for-each>
            <xsl:for-each select="//VALUESERVER/JSON">
              <xsl:variable name="jsonBody">
                <xsl:choose>
                  <xsl:when test="@text != ''"><xsl:value-of select="@text"/></xsl:when>
                  <xsl:when test="METADATA/text">
                    <xsl:call-template name="localized-value">
                      <xsl:with-param name="direct" select="''"/>
                      <xsl:with-param name="container" select="METADATA/text"/>
                      <xsl:with-param name="fallbackLang" select="METADATA/@fallback"/>
                    </xsl:call-template>
                  </xsl:when>
                  <!-- Concatenate child nodes individually: some engines lose
                       CDATA content when stringifying the element directly -->
                  <xsl:otherwise><xsl:for-each select="node()"><xsl:value-of select="."/></xsl:for-each></xsl:otherwise>
                </xsl:choose>
              </xsl:variable>
              <!-- Structural test (not string-based): CDATA string-values are
                   unreliable in some engines -->
              <xsl:if test="@text != '' or METADATA/text or node()">
                <xsl:text disable-output-escaping="yes">&#10;          try { var j = (</xsl:text><xsl:value-of select="$jsonBody" disable-output-escaping="yes"/><xsl:text disable-output-escaping="yes">); Object.keys(j).forEach(function (k) { data['</xsl:text><xsl:value-of select="@prefix"/><xsl:text disable-output-escaping="yes">' + k] = j[k]; }); } catch (e) { console.warn('JSON element parse failed', e); }</xsl:text>
              </xsl:if>
            </xsl:for-each>
            <xsl:text disable-output-escaping="yes">&#10;          window.fdarDispatchVars(data, '');
        }, 800);
      });</xsl:text>
          </xsl:if>

          <xsl:if test="//SWITCH or //LINK or //TOUCH">
            <xsl:text disable-output-escaping="yes">&#10;      // Interaction area per spec: semi-transparent (alpha default 0.1),
      // faintly pulsing (pulse default 0.2), transparent blue when no colour set
      AFRAME.registerComponent('fdar-area', {
        schema: {
          color: {type: 'string', default: ''},
          alpha: {type: 'string', default: ''},
          pulse: {type: 'string', default: ''}
        },
        init: function () {
          var raw = this.data.color.replace('#', '');
          var parsed = window.fdarParseHex(this.data.color) || { color: '#0088ff', opacity: 1 };
          var hasAlphaDigits = raw.length === 4 || raw.length === 8;
          var alpha = this.data.alpha !== '' ? parseFloat(this.data.alpha)
            : (hasAlphaDigits ? parsed.opacity : 0.1);
          this.baseOpacity = Math.max(0, Math.min(1, isNaN(alpha) ? 0.1 : alpha));
          this.pulseAmount = this.data.pulse !== '' ? parseFloat(this.data.pulse) : 0.2;
          if (isNaN(this.pulseAmount)) this.pulseAmount = 0.2;
          this.el.setAttribute('material', 'color: ' + parsed.color + '; opacity: ' + this.baseOpacity + '; transparent: true; depthWrite: false; shader: flat; side: double');
        },
        tick: function (t) {
          if (!this.pulseAmount) return;
          var mesh = this.el.getObject3D('mesh');
          if (mesh &amp;&amp; mesh.material) {
            mesh.material.opacity = this.baseOpacity * (1 + this.pulseAmount * Math.sin(t / 400));
          }
        }
      });
      // LINK inside TEXT/MODEL: hitbox sized from the parent's geometry,
      // with w/h/d added to the measured size (per spec)
      AFRAME.registerComponent('fdar-fit-parent', {
        schema: { w: {type: 'number', default: 0}, h: {type: 'number', default: 0}, d: {type: 'number', default: 0} },
        init: function () {
          var self = this;
          var fit = function () {
            var parent = self.el.parentElement;
            if (!parent || !parent.object3D) return;
            var box = new THREE.Box3();
            var tmp = new THREE.Box3();
            parent.object3D.updateWorldMatrix(true, true);
            parent.object3D.traverse(function (o) {
              if (!o.isMesh) return;
              var p = o, own = false;
              while (p) { if (p === self.el.object3D) { own = true; break; } p = p.parent; }
              if (own) return;
              tmp.setFromObject(o);
              if (!tmp.isEmpty()) box.union(tmp);
            });
            if (box.isEmpty()) return;
            var size = new THREE.Vector3(); box.getSize(size);
            var center = new THREE.Vector3(); box.getCenter(center);
            parent.object3D.worldToLocal(center);
            var ws = new THREE.Vector3(); parent.object3D.getWorldScale(ws);
            var w = size.x / (ws.x || 1) + self.data.w;
            var h = size.y / (ws.y || 1) + self.data.h;
            var d = size.z / (ws.z || 1) + self.data.d;
            self.el.setAttribute('geometry', 'primitive: box; width: ' + Math.max(w, 0.001) + '; height: ' + Math.max(h, 0.001) + '; depth: ' + Math.max(d, 0.001));
            self.el.object3D.position.copy(center);
            self.el.setAttribute('hover-outline', 'type: rect; width: ' + (w + 0.1) + '; height: ' + (h + 0.1));
          };
          var delayed = function () { setTimeout(fit, 100); };
          if (this.el.parentElement) {
            this.el.parentElement.addEventListener('model-loaded', delayed);
            this.el.parentElement.addEventListener('textfontset', delayed);
          }
          this.el.sceneEl.addEventListener('loaded', function () { setTimeout(fit, 400); });
        }
      });
      // TOUCH: drag to rotate/translate, wheel to scale
      AFRAME.registerComponent('fdar-touch', {
        schema: {
          rotate: {type: 'boolean', default: false},
          scale: {type: 'boolean', default: false},
          translate: {type: 'boolean', default: false}
        },
        init: function () {
          var self = this;
          var dragging = false, lastX = 0, lastY = 0;
          var area = this.el.querySelector('.clickable');
          if (!area) return;
          area.addEventListener('mousedown', function () { dragging = true; });
          window.addEventListener('mousemove', function (e) {
            if (!dragging) return;
            var dx = e.movementX !== undefined ? e.movementX : e.clientX - lastX;
            var dy = e.movementY !== undefined ? e.movementY : e.clientY - lastY;
            lastX = e.clientX; lastY = e.clientY;
            var o = self.el.object3D;
            if (self.data.rotate) {
              o.rotation.y += dx * 0.01;
              o.rotation.x += dy * 0.01;
            } else if (self.data.translate) {
              o.position.x += dx * 0.005;
              o.position.y -= dy * 0.005;
            }
          });
          window.addEventListener('mouseup', function () { dragging = false; });
          window.addEventListener('wheel', function (e) {
            if (!self.data.scale) return;
            var f = e.deltaY &lt; 0 ? 1.05 : 0.95;
            self.el.object3D.scale.multiplyScalar(f);
          });
        }
      });</xsl:text>
          </xsl:if>

          <xsl:if test="//SWITCH or //LINK or //STREAMER or //DISPLAY[starts-with(@text, '@video:')] or //TOUCH">
            <xsl:text disable-output-escaping="yes">&#10;      AFRAME.registerComponent('hover-outline', {
        schema: { 
          type: { type: 'string', default: 'circle' },
          width: { type: 'number', default: 1.2 },
          height: { type: 'number', default: 1.2 }
        },
        init: function () {
          this.el.addEventListener('mouseenter', () =&gt; {
            this.hovered = true;
            if (!this.outline) {
              this.outline = document.createElement('a-entity');
              
              if (this.data.type === 'rect') {
                const w = this.data.width;
                const h = this.data.height;
                const t = 0.05;
                
                const top = document.createElement('a-plane');
                top.setAttribute('width', w + t); top.setAttribute('height', t);
                top.setAttribute('position', `0 ${h/2} 0`);
                top.setAttribute('material', 'color: #0088ff; emissive: #0088ff; shader: flat; depthWrite: false; transparent: true');
                
                const bot = document.createElement('a-plane');
                bot.setAttribute('width', w + t); bot.setAttribute('height', t);
                bot.setAttribute('position', `0 -${h/2} 0`);
                bot.setAttribute('material', 'color: #0088ff; emissive: #0088ff; shader: flat; depthWrite: false; transparent: true');
                
                const left = document.createElement('a-plane');
                left.setAttribute('width', t); left.setAttribute('height', h + t);
                left.setAttribute('position', `-${w/2} 0 0`);
                left.setAttribute('material', 'color: #0088ff; emissive: #0088ff; shader: flat; depthWrite: false; transparent: true');
                
                const right = document.createElement('a-plane');
                right.setAttribute('width', t); right.setAttribute('height', h + t);
                right.setAttribute('position', `${w/2} 0 0`);
                right.setAttribute('material', 'color: #0088ff; emissive: #0088ff; shader: flat; depthWrite: false; transparent: true');
                
                this.outline.appendChild(top);
                this.outline.appendChild(bot);
                this.outline.appendChild(left);
                this.outline.appendChild(right);
              } else {
                const torus = document.createElement('a-torus');
                torus.setAttribute('radius', '0.6');
                torus.setAttribute('radius-tubular', '0.02');
                torus.setAttribute('material', 'color: #0088ff; emissive: #0088ff; emissiveIntensity: 1; depthWrite: false; shader: flat; transparent: true');
                torus.setAttribute('rotation', '0 0 0');
                this.outline.appendChild(torus);
              }
              
              this.outline.classList.remove('clickable');
              this.el.appendChild(this.outline);
            }
          });
          this.el.addEventListener('mouseleave', () =&gt; {
            this.hovered = false;
            if (this.outline) {
              this.el.removeChild(this.outline);
              this.outline = null;
            }
          });
        },
        update: function (oldData) {
          if (!this.outline) return;
          if (oldData.width === this.data.width &amp;&amp; oldData.height === this.data.height &amp;&amp; oldData.type === this.data.type) return;
          // Size changed while shown: rebuild at the new dimensions
          this.el.removeChild(this.outline);
          this.outline = null;
          if (this.hovered) this.el.emit('mouseenter');
        }
      });</xsl:text>
          </xsl:if>

          <xsl:if test="//@rgba | //@rgb | //@tint | //@backrgba">
            <xsl:text disable-output-escaping="yes">&#10;      AFRAME.registerComponent('fdar-color', {
        schema: { 
          rgba: {type: 'string', default: ''},
          tint: {type: 'string', default: ''},
          backrgba: {type: 'string', default: ''},
          border: {type: 'string', default: ''}
        },
        init: function () { this.applyColor(); },
        update: function () { this.applyColor(); },
        // TEXT background: a plane sized to the laid-out text plus the border
        applyBackground: function () {
          var self = this;
          var bg = window.fdarParseHex(this.data.backrgba);
          if (!bg) return;
          var build = function () {
            var textObj = self.el.getObject3D('text');
            if (!textObj) return;
            var box = new THREE.Box3().setFromObject(textObj);
            if (box.isEmpty()) return;
            var size = new THREE.Vector3(); box.getSize(size);
            var center = new THREE.Vector3(); box.getCenter(center);
            self.el.object3D.worldToLocal(center);
            var ws = new THREE.Vector3(); self.el.object3D.getWorldScale(ws);
            var pad = (parseFloat(self.data.border) || 0) / 10;
            var w = size.x / (ws.x || 1) + pad * 2;
            var h = size.y / (ws.y || 1) + pad * 2;
            if (!self.bgEl) {
              self.bgEl = document.createElement('a-plane');
              self.bgEl.setAttribute('class', 'fdar-text-bg');
              self.el.appendChild(self.bgEl);
            }
            self.bgEl.setAttribute('width', w);
            self.bgEl.setAttribute('height', h);
            self.bgEl.setAttribute('material', 'color: ' + bg.color + '; opacity: ' + bg.opacity + '; transparent: true; shader: flat; side: double; depthWrite: false');
            // Keep a real-world gap behind the glyphs: a fixed local offset can
            // collapse below depth-buffer precision once the ancestor chain
            // scales the text down (mm-space scenes), which strips white lines
            // through the letters. Also force the plane to paint before the
            // glyphs so equal-depth pixels can never win over the text.
            var zGap = Math.max(0.05, 0.0005 / (ws.z || 1));
            self.bgEl.object3D.position.set(center.x, center.y, center.z - zGap);
            self.bgEl.object3D.traverse(function (o) { o.renderOrder = -1; });
          };
          this.el.addEventListener('textfontset', function () { setTimeout(build, 50); });
          setTimeout(build, 600);
        },
        applyColor: function() {
          var main = window.fdarParseHex(this.data.rgba) || window.fdarParseHex(this.data.tint);
          if (this.data.backrgba) this.applyBackground();
          if(!main) return;
          
          if(this.el.tagName.toLowerCase() === 'a-text' || this.el.hasAttribute('text')) {
             this.el.setAttribute('text', 'color', main.color);
             this.el.setAttribute('text', 'opacity', main.opacity);
          } else {
             this.el.setAttribute('material', 'color', main.color);
             this.el.setAttribute('material', 'opacity', main.opacity);
             if(main.opacity &lt; 1.0) this.el.setAttribute('material', 'transparent', true);
          }
        }
      });</xsl:text>
          </xsl:if>

          <xsl:if test="//*[starts-with(@value, '@anim:') or starts-with(@label, '@anim:')]">
            <xsl:text disable-output-escaping="yes">&#10;      AFRAME.registerComponent('ws-value-updater', {
        schema: { key: {type: 'string', default: ''} },
        init: function () { 
          var rawKey = this.data.key;
          this.animKey = rawKey.includes(':') ? rawKey.split(':')[0] : rawKey;
          window.addEventListener('fdar-variable-update', (e) =&gt; {
            if (e.detail.key === this.animKey) {
              this.el.setAttribute('value', e.detail.value);
            }
          });
        }
      });</xsl:text>
          </xsl:if>

          <xsl:if test="//ANIMATION[count(KEYFRAME) &lt;= 1] or //NODE[contains(concat(@tx, '|', @ty, '|', @tz, '|', @rx, '|', @ry, '|', @rz, '|', @sx, '|', @sy, '|', @sz, '|', @sxyz), '@anim:')]">
            <xsl:text disable-output-escaping="yes">&#10;      // Variable-bound transform attributes ("tx: var:inc:double:triple:jump; ...").
      // Values approach their target at "increment" units/second; the double and
      // triple thresholds speed that up, and jump applies the value immediately.
      AFRAME.registerComponent('fdar-bind', {
        init: function () {
          var self = this;
          this.bindings = {};
          var spec = this.el.getAttribute('fdar-bind') || '';
          spec.split(';').forEach(function (entry) {
            entry = entry.trim();
            if (!entry) return;
            var sep = entry.indexOf(':');
            if (sep &lt; 0) return;
            var attr = entry.substring(0, sep).trim();
            var parts = entry.substring(sep + 1).trim().split(':');
            self.bindings[attr] = {
              key: parts[0],
              inc: parseFloat(parts[1]) || 0,
              dbl: parseFloat(parts[2]) || 0,
              tpl: parseFloat(parts[3]) || 0,
              jmp: parseFloat(parts[4]) || 0,
              target: null, current: null
            };
          });
          window.addEventListener('fdar-variable-update', function (e) {
            Object.keys(self.bindings).forEach(function (attr) {
              var b = self.bindings[attr];
              if (b.key !== e.detail.key) return;
              var v = parseFloat(e.detail.value);
              if (isNaN(v)) return;
              if (b.current === null || b.inc &lt;= 0 ||
                  (b.jmp &gt; 0 &amp;&amp; Math.abs(v - b.current) &gt;= b.jmp)) {
                b.current = v;
                self.applyAttr(attr, v);
              }
              b.target = v;
            });
          });
        },
        tick: function (t, dt) {
          var self = this;
          Object.keys(this.bindings).forEach(function (attr) {
            var b = self.bindings[attr];
            if (b.target === null || b.current === null || b.current === b.target) return;
            var diff = b.target - b.current;
            var speed = b.inc;
            if (b.tpl &gt; 0 &amp;&amp; Math.abs(diff) &gt;= b.tpl) speed = b.inc * 3;
            else if (b.dbl &gt; 0 &amp;&amp; Math.abs(diff) &gt;= b.dbl) speed = b.inc * 2;
            var step = speed * (dt / 1000);
            if (Math.abs(diff) &lt;= step) b.current = b.target;
            else b.current += (diff &gt; 0 ? step : -step);
            self.applyAttr(attr, b.current);
          });
        },
        applyAttr: function (attr, v) {
          var o = this.el.object3D;
          var d = Math.PI / 180;
          switch (attr) {
            case 'tx': o.position.x = v; break;
            case 'ty': o.position.y = v; break;
            case 'tz': o.position.z = -v; break;
            case 'rx': o.rotation.x = -v * d; break;
            case 'ry': o.rotation.y = -v * d; break;
            case 'rz': o.rotation.z = v * d; break;
            case 'sx': o.scale.x = v; break;
            case 'sy': o.scale.y = v; break;
            case 'sz': o.scale.z = v; break;
            case 'sxyz': o.scale.set(v, v, v); break;
          }
        }
      });</xsl:text>
          </xsl:if>

          <xsl:if test="//MODEL[@texture] or //VIEWER or //DISPLAY">
            <xsl:text disable-output-escaping="yes">&#10;      // A texture that failed to load leaves material.map without an image,
      // which renders black; drop such maps so the base colour shows instead
      AFRAME.registerComponent('fdar-texture-guard', {
        init: function () {
          var sceneEl = this.el;
          var sweep = function () {
            sceneEl.object3D.traverse(function (o) {
              if (!o.isMesh || !o.material || !o.material.map) return;
              var img = o.material.map.image;
              var broken = !img ||
                (typeof HTMLImageElement !== 'undefined' &amp;&amp; img instanceof HTMLImageElement &amp;&amp; img.complete &amp;&amp; img.naturalWidth === 0) ||
                (typeof HTMLVideoElement !== 'undefined' &amp;&amp; img instanceof HTMLVideoElement &amp;&amp; img.networkState === 3);
              if (broken) {
                o.material.map = null;
                o.material.needsUpdate = true;
              }
            });
          };
          sceneEl.addEventListener('loaded', function () {
            setTimeout(sweep, 2000);
            setTimeout(sweep, 5000);
            setTimeout(sweep, 10000);
          });
        }
      });</xsl:text>
          </xsl:if>

          <xsl:if test="//MATERIAL[@type = 'mask']">
            <xsl:text disable-output-escaping="yes">&#10;      // AR occluder: writes depth only, hiding virtual content behind it
      AFRAME.registerComponent('fdar-mask', {
        init: function () {
          var el = this.el;
          var apply = function () {
            el.object3D.traverse(function (o) {
              if (o.isMesh &amp;&amp; o.material) {
                o.material.colorWrite = false;
                o.renderOrder = -1;
              }
            });
          };
          el.addEventListener('loaded', apply);
          el.addEventListener('model-loaded', apply);
          apply();
        }
      });</xsl:text>
          </xsl:if>

          <xsl:if test="//CAMERA[@x != '' or @y != '' or @distance != '' or @scaleto != '']">
            <xsl:text disable-output-escaping="yes">&#10;      // CAMERA x/y origin (screen fractions), distance and scaleto normalisation
      AFRAME.registerComponent('fdar-camera-fit', {
        schema: {
          x: {type: 'number', default: 0.5},
          y: {type: 'number', default: 0.5},
          distance: {type: 'number', default: 1},
          scaleto: {type: 'string', default: ''}
        },
        init: function () {
          var self = this;
          var apply = function () { self.apply(); };
          this.el.sceneEl.addEventListener('loaded', function () { setTimeout(apply, 100); });
          window.addEventListener('resize', function () { setTimeout(apply, 100); });
        },
        tick: function () {
          // AR.js (and the marker-free preview) overwrite the projection matrix
          // directly, so watch it and re-anchor whenever the frustum changes
          var cam = this.el.sceneEl.camera;
          if (!cam) return;
          var e = cam.projectionMatrix.elements;
          var sig = e[0] + ',' + e[5];
          if (sig !== this._projSig) { this._projSig = sig; this.apply(); }
        },
        apply: function () {
          var cam = this.el.sceneEl.camera;
          if (!cam) return;
          var d = this.data.distance || 1;
          // Derive the frustum from the live projection matrix: cam.fov/aspect
          // are stale once AR.js installs its own projection
          var e = cam.projectionMatrix.elements;
          var halfW = e[0] ? d / e[0] : d * Math.tan(cam.fov * Math.PI / 360) * cam.aspect;
          var halfH = e[5] ? d / e[5] : d * Math.tan(cam.fov * Math.PI / 360);
          var o = this.el.object3D;
          o.position.set((this.data.x - 0.5) * 2 * halfW, (this.data.y - 0.5) * 2 * halfH, -d);
          var st = this.data.scaleto;
          var s = 1;
          if (st === 'width' || st === 'w') s = 2 * halfW;
          else if (st === 'height' || st === 'h') s = 2 * halfH;
          else if (st === 'min') s = 2 * Math.min(halfW, halfH);
          else if (st === 'max') s = 2 * Math.max(halfW, halfH);
          o.scale.set(s, s, s);
        }
      });</xsl:text>
          </xsl:if>

          <xsl:if test="//REFLECT">
            <xsl:text disable-output-escaping="yes">&#10;      // VIRTUAL/REFLECT: mirror the pose of visible nodes onto virtual targets
      AFRAME.registerComponent('fdar-reflect', {
        schema: { to: {type: 'string', default: ''}, priority: {type: 'string', default: '0'} },
        init: function () {
          this.becameVisible = 0;
          this.reg = window._fdarVirtualReg = window._fdarVirtualReg || {};
        },
        tick: function (t) {
          var parent = this.el.parentElement;
          if (!parent || !parent.object3D) return;
          var visible = !window.fdarHiddenChain(parent);
          if (!visible) { this.becameVisible = 0; return; }
          if (!this.becameVisible) this.becameVisible = t;
          var pri;
          if (this.data.priority === 'activated') pri = this.becameVisible / 1000;
          else if (this.data.priority === 'running') pri = (t - this.becameVisible) / 1000;
          else pri = parseFloat(this.data.priority) || 0;
          var target = document.getElementById('fdar-virtual-' + this.data.to);
          if (!target || !target.object3D) return;
          var mode = target.dataset.prioritisation || 'weighted';
          var slot = this.reg[this.data.to];
          var stale = !slot || t - slot.t &gt; 150;
          var wins = stale || (mode === 'lowest' ? pri &lt;= slot.pri : pri &gt;= slot.pri);
          if (!wins) return;
          this.reg[this.data.to] = { pri: pri, t: t };
          parent.object3D.updateWorldMatrix(true, false);
          parent.object3D.matrixWorld.decompose(target.object3D.position, target.object3D.quaternion, target.object3D.scale);
          target.object3D.visible = true;
        }
      });</xsl:text>
          </xsl:if>

          <xsl:if test="//COUNTER">
            <xsl:text disable-output-escaping="yes">&#10;      AFRAME.registerComponent('fdar-counter', {
        schema: {
          value: {type: 'string', default: ''},
          intdigits: {type: 'number', default: 3},
          fractdigits: {type: 'number', default: 0},
          intrgb: {type: 'string', default: 'fff'},
          fractrgb: {type: 'string', default: 'fff'},
          wheelintrgb: {type: 'string', default: '000'},
          wheelfractrgb: {type: 'string', default: 'f00'},
          casergb: {type: 'string', default: '111'},
          commargb: {type: 'string', default: 'fff'}
        },
        init: function () {
          var self = this;
          var raw = this.data.value;
          this.animKey = raw.indexOf('@anim:') === 0 ? raw.substring(6).split(':')[0] : null;
          this.current = this.animKey ? 0 : (parseFloat(raw) || 0);
          var col = function (v, def) { return (window.fdarParseHex(v) || { color: def }).color; };
          var ints = Math.max(1, Math.min(8, this.data.intdigits));
          var fracts = Math.max(0, Math.min(8, this.data.fractdigits));
          var digitW = 0.5;
          var caseW = (ints + fracts) * digitW + (fracts ? 0.25 : 0) + 0.4;
          var mk = function (tag) { var e = document.createElement(tag); self.el.appendChild(e); return e; };
          var casePlane = mk('a-plane');
          casePlane.setAttribute('width', caseW);
          casePlane.setAttribute('height', 1);
          casePlane.setAttribute('material', 'color: ' + col(this.data.casergb, '#111') + '; shader: flat; side: double');
          var intWheel = mk('a-plane');
          intWheel.setAttribute('width', ints * digitW);
          intWheel.setAttribute('height', 0.8);
          intWheel.setAttribute('position', (-caseW / 2 + 0.2 + ints * digitW / 2) + ' 0 0.01');
          intWheel.setAttribute('material', 'color: ' + col(this.data.wheelintrgb, '#000') + '; shader: flat; side: double');
          this.intText = mk('a-text');
          this.intText.setAttribute('align', 'center');
          this.intText.setAttribute('baseline', 'center');
          this.intText.setAttribute('anchor', 'center');
          this.intText.setAttribute('color', col(this.data.intrgb, '#fff'));
          this.intText.setAttribute('position', (-caseW / 2 + 0.2 + ints * digitW / 2) + ' 0 0.02');
          this.intText.setAttribute('scale', '1.6 1.6 1.6');
          if (fracts) {
            var comma = mk('a-text');
            comma.setAttribute('value', ',');
            comma.setAttribute('align', 'center');
            comma.setAttribute('color', col(this.data.commargb, '#fff'));
            comma.setAttribute('position', (-caseW / 2 + 0.2 + ints * digitW + 0.12) + ' -0.1 0.02');
            comma.setAttribute('scale', '1.6 1.6 1.6');
            var fractWheel = mk('a-plane');
            fractWheel.setAttribute('width', fracts * digitW);
            fractWheel.setAttribute('height', 0.8);
            fractWheel.setAttribute('position', (caseW / 2 - 0.2 - fracts * digitW / 2) + ' 0 0.01');
            fractWheel.setAttribute('material', 'color: ' + col(this.data.wheelfractrgb, '#f00') + '; shader: flat; side: double');
            this.fractText = mk('a-text');
            this.fractText.setAttribute('align', 'center');
            this.fractText.setAttribute('baseline', 'center');
            this.fractText.setAttribute('anchor', 'center');
            this.fractText.setAttribute('color', col(this.data.fractrgb, '#fff'));
            this.fractText.setAttribute('position', (caseW / 2 - 0.2 - fracts * digitW / 2) + ' 0 0.02');
            this.fractText.setAttribute('scale', '1.6 1.6 1.6');
          }
          this.ints = ints; this.fracts = fracts;
          this.render();
          if (this.animKey) {
            window.addEventListener('fdar-variable-update', function (e) {
              if (e.detail.key !== self.animKey) return;
              var v = parseFloat(e.detail.value);
              if (!isNaN(v)) { self.current = v; self.render(); }
            });
          }
        },
        render: function () {
          var v = Math.abs(this.current);
          var intPart = String(Math.floor(v));
          while (intPart.length &lt; this.ints) intPart = '0' + intPart;
          this.intText.setAttribute('value', intPart);
          if (this.fracts &amp;&amp; this.fractText) {
            var fract = v.toFixed(this.fracts);
            this.fractText.setAttribute('value', fract.substring(fract.indexOf('.') + 1));
          }
        }
      });</xsl:text>
          </xsl:if>

          <xsl:if test="//VUMETER">
            <xsl:text disable-output-escaping="yes">&#10;      AFRAME.registerComponent('fdar-vumeter', {
        schema: {
          value: {type: 'string', default: ''},
          label: {type: 'string', default: ''},
          labelmin: {type: 'string', default: 'Min'},
          labelmax: {type: 'string', default: 'Max'}
        },
        init: function () {
          var self = this;
          var raw = this.data.value;
          this.animKey = raw.indexOf('@anim:') === 0 ? raw.substring(6).split(':')[0] : null;
          this.current = this.animKey ? 0 : (parseFloat(raw) || 0);
          var mk = function (tag, parent) { var e = document.createElement(tag); (parent || self.el).appendChild(e); return e; };
          var casePlane = mk('a-plane');
          casePlane.setAttribute('width', 2);
          casePlane.setAttribute('height', 1.2);
          casePlane.setAttribute('material', 'color: #f4f2ea; shader: flat; side: double');
          var txt = function (value, x, y, s, color) {
            var t = mk('a-text');
            t.setAttribute('value', value); t.setAttribute('align', 'center');
            t.setAttribute('baseline', 'center'); t.setAttribute('anchor', 'center');
            t.setAttribute('color', color || '#222');
            t.setAttribute('position', x + ' ' + y + ' 0.02');
            t.setAttribute('scale', s + ' ' + s + ' ' + s);
            return t;
          };
          if (this.data.label) txt(this.data.label, 0, -0.4, 0.8);
          if (this.data.labelmin) txt(this.data.labelmin, -0.7, 0.35, 0.7);
          if (this.data.labelmax) txt(this.data.labelmax, 0.7, 0.35, 0.7);
          // Tick arc matching the app's dial face: 11 radial marks sweeping
          // +60deg (min, left) to -60deg (max, right) about the needle pivot.
          var pivotY = -0.15, tr = 0.62;
          for (var ti = 0; ti &lt;= 10; ti++) {
            var ang = (0.5 - ti / 10) * 2 * Math.PI / 3;
            var tick = mk('a-plane');
            tick.setAttribute('width', ti % 5 === 0 ? 0.035 : 0.02);
            tick.setAttribute('height', ti % 5 === 0 ? 0.13 : 0.08);
            tick.setAttribute('material', 'color: #333; shader: flat; side: double');
            tick.object3D.position.set(-Math.sin(ang) * tr, pivotY + Math.cos(ang) * tr, 0.015);
            tick.object3D.rotation.z = ang;
          }
          this.lamp = mk('a-circle');
          this.lamp.setAttribute('radius', '0.07');
          this.lamp.setAttribute('position', '0 -0.15 0.02');
          this.lamp.setAttribute('material', 'color: #400; shader: flat; side: double');
          this.needle = mk('a-entity');
          var blade = mk('a-plane', this.needle);
          blade.setAttribute('width', 0.04);
          blade.setAttribute('height', 0.75);
          blade.setAttribute('position', '0 0.375 0.03');
          blade.setAttribute('material', 'color: #c22; shader: flat; side: double');
          this.needle.object3D.position.set(0, -0.15, 0);
          this.render();
          if (this.animKey) {
            window.addEventListener('fdar-variable-update', function (e) {
              if (e.detail.key !== self.animKey) return;
              var v = parseFloat(e.detail.value);
              if (!isNaN(v)) { self.current = v; self.render(); }
            });
          }
        },
        render: function () {
          var v = this.current;
          var over = v &lt; 0 || v &gt; 1;
          // 0 -&gt; needle left (+60deg), 1 -&gt; right (-60deg), small overtravel
          var clamped = Math.max(-0.05, Math.min(1.05, v));
          this.needle.object3D.rotation.z = (0.5 - clamped) * 2 * Math.PI / 3;
          this.lamp.setAttribute('material', 'color: ' + (over ? '#f00' : '#400') + '; shader: flat; side: double');
        }
      });</xsl:text>
          </xsl:if>

          <xsl:if test="//TEXT">
            <xsl:text disable-output-escaping="yes">&#10;      // FDAR labels may embed formatting pseudo-tags such as &lt;align="left"&gt;;
      // apply the alignment to the a-text and strip the tags from the value
      AFRAME.registerComponent('fdar-label-fmt', {
        init: function () {
          var self = this;
          this.processing = false;
          var process = function () {
            if (self.processing) return;
            var raw = self.el.getAttribute('value') || '';
            if (raw.indexOf('&lt;') === -1) return;
            var align = null;
            var cleaned = raw.replace(/&lt;align="(left|center|right)"&gt;/gi, function (m, a) {
              align = a.toLowerCase();
              return '';
            });
            cleaned = cleaned.replace(/&lt;[a-z]+="[^"]*"&gt;/gi, '');
            if (cleaned === raw &amp;&amp; !align) return;
            self.processing = true;
            if (align) self.el.setAttribute('align', align);
            self.el.setAttribute('value', cleaned);
            self.processing = false;
          };
          process();
          this.observer = new MutationObserver(process);
          this.observer.observe(this.el, { attributes: true, attributeFilter: ['value'] });
        },
        remove: function () { if (this.observer) this.observer.disconnect(); }
      });</xsl:text>
          </xsl:if>

          <xsl:if test="//SIGNAL">
            <xsl:text disable-output-escaping="yes">&#10;      AFRAME.registerComponent('ws-signal', {
        schema: {
          key: {type: 'string', default: ''},
          color: {type: 'string', default: '#f00'},
          on: {type: 'boolean', default: false}
        },
        init: function () {
          this.isOn = this.data.on;
          var rawKey = this.data.key;
          this.animKey = rawKey.includes(':') ? rawKey.split(':')[0] : rawKey;
          window.addEventListener('fdar-variable-update', (e) =&gt; {
            if (e.detail.key === this.animKey) {
              this.isOn = window.fdarTruthy(String(e.detail.value));
              this.updateVisual();
            }
          });
          this.updateVisual();
        },
        updateVisual: function() {
          if (this.isOn) {
            this.el.setAttribute('material', 'emissive', this.data.color);
            this.el.setAttribute('material', 'emissiveIntensity', 0.8);
            this.el.setAttribute('material', 'roughness', 0.2);
            this.el.setAttribute('material', 'opacity', 1.0);
            this.el.setAttribute('material', 'transparent', false);
          } else {
            this.el.setAttribute('material', 'emissive', '#000000');
            this.el.setAttribute('material', 'emissiveIntensity', 0.0);
            this.el.setAttribute('material', 'roughness', 0.8);
            this.el.setAttribute('material', 'opacity', 0.4);
            this.el.setAttribute('material', 'transparent', true);
          }
        }
      });</xsl:text>
          </xsl:if>

          <xsl:if test="//SWITCH">
            <xsl:text disable-output-escaping="yes">&#10;      AFRAME.registerComponent('fdar-switch', {
        schema: {
          transmitter: {type: 'string', default: ''},
          transmitKey: {type: 'string', default: ''},
          on: {type: 'boolean', default: false},
          onvalue: {type: 'string', default: 'true'},
          offvalue: {type: 'string', default: 'false'},
          pressedvalue: {type: 'string', default: ''},
          unpressedvalue: {type: 'string', default: ''}
        },
        init: function () {
          this.isOn = this.data.on;
          if (this.data.pressedvalue !== '') {
            // Momentary button: one value while pressed, another on release
            this.el.addEventListener('mousedown', () =&gt; {
              if (window.fdarHiddenChain &amp;&amp; window.fdarHiddenChain(this.el)) return;
              this.transmit(this.data.pressedvalue);
            });
            this.el.addEventListener('mouseup', () =&gt; {
              if (window.fdarHiddenChain &amp;&amp; window.fdarHiddenChain(this.el)) return;
              this.transmit(this.data.unpressedvalue);
            });
          } else {
            this.el.addEventListener('click', () =&gt; {
              if (window.fdarHiddenChain &amp;&amp; window.fdarHiddenChain(this.el)) return;
              this.isOn = !this.isOn;
              this.transmit(this.isOn ? this.data.onvalue : this.data.offvalue);
            });
          }
        },
        transmit: function (valStr) {
          if (!this.data.transmitKey) return;
          window.dispatchEvent(new CustomEvent('fdar-variable-update', { 
            detail: { key: this.data.transmitKey, value: valStr } 
          }));
          // Without a transmitter the variable stays local (per spec)
          var socket = window.fdarTransmitters &amp;&amp; window.fdarTransmitters[this.data.transmitter];
          if (socket &amp;&amp; socket.readyState === WebSocket.OPEN) {
            const payload = {};
            payload[this.data.transmitKey] = valStr;
            socket.send(JSON.stringify(payload));
          }
        }
      });</xsl:text>
          </xsl:if>

          <xsl:if test="//STREAMER or //DISPLAY[starts-with(@text, '@video:')]">
            <xsl:text disable-output-escaping="yes">&#10;      AFRAME.registerComponent('video-controller', {
        schema: {
          status: {type: 'string', default: 'play'},
          position: {type: 'number', default: 0},
          showpos: {type: 'boolean', default: false}
        },
        init: function () {
          const el = this.el;
          const self = this;
          const videoId = el.getAttribute('src');
          if(!videoId || !videoId.startsWith('#')) return;
          const video = document.querySelector(videoId);
          if(!video) return;
          video.addEventListener('loadeddata', () =&gt; {
            if (self.data.position &gt; 0) { try { video.currentTime = self.data.position; } catch (e) {} }
            if (self.data.status !== 'pause') video.play().catch(e =&gt; {});
          });
          // Non-looping videos pause and rewind at the end (per spec)
          video.addEventListener('ended', () =&gt; {
            if (!video.loop) { video.pause(); video.currentTime = 0; }
          });
          el.addEventListener('click', () =&gt; { video.muted = false; if (video.paused) { video.play(); } else { video.pause(); } });
          if (self.data.showpos) {
            const w = parseFloat(el.getAttribute('width')) || 1.6;
            const h = parseFloat(el.getAttribute('height')) || 0.9;
            const track = document.createElement('a-plane');
            track.setAttribute('width', w);
            track.setAttribute('height', 0.05);
            track.setAttribute('material', 'color: #222; shader: flat; side: double');
            track.setAttribute('position', '0 ' + (-h / 2 - 0.05) + ' 0.01');
            el.appendChild(track);
            const bar = document.createElement('a-plane');
            bar.setAttribute('height', 0.05);
            bar.setAttribute('width', 0.001);
            bar.setAttribute('material', 'color: #0a84ff; shader: flat; side: double');
            track.appendChild(bar);
            setInterval(() =&gt; {
              if (!video.duration) return;
              const p = video.currentTime / video.duration;
              bar.setAttribute('width', Math.max(0.001, w * p));
              bar.object3D.position.x = -w / 2 + (w * p) / 2;
            }, 250);
          }
        }
      });</xsl:text>
          </xsl:if>

          <xsl:if test="//VIEWER[@refresh]">
            <xsl:text disable-output-escaping="yes">&#10;      AFRAME.registerComponent('image-refresher', {
        schema: { src: {type: 'string'}, interval: {type: 'number', default: 5} },
        init: function () {
          const self = this;
          const load = () =&gt; {
            const originalSrc = this.data.src;
            if (!originalSrc) return;
            // Cache-busting also dodges CDN responses cached without CORS headers
            const separator = originalSrc.includes('?') ? '&amp;' : '?';
            const newSrc = originalSrc + separator + 't=' + Date.now();
            const loader = new THREE.TextureLoader(); loader.setCrossOrigin('anonymous');
            loader.load(newSrc, (texture) =&gt; {
              const mesh = this.el.getObject3D('mesh');
              if (mesh &amp;&amp; mesh.material) { if (mesh.material.map) mesh.material.map.dispose(); mesh.material.map = texture; mesh.material.needsUpdate = true; }
            });
          };
          // Show the picture immediately on load, then refresh on the interval
          if (this.el.hasLoaded) load();
          else this.el.addEventListener('loaded', load, { once: true });
          if (this.data.interval &gt; 0) {
            this.timer = setInterval(load, this.data.interval * 1000);
          }
        },
        remove: function () { if (this.timer) clearInterval(this.timer); }
      });</xsl:text>
          </xsl:if>

          <xsl:if test="//LINK">
            <xsl:text disable-output-escaping="yes">&#10;      AFRAME.registerComponent('navigate-on-click', {
        schema: { url: { default: '' } },
        init: function () {
          const el = this.el;
          el.addEventListener('click', () =&gt; {
            if (window.fdarHiddenChain &amp;&amp; window.fdarHiddenChain(el)) return;
            var url = this.data.url;
            if (url.indexOf('@view:') === 0) { if (window.fdarSetView) window.fdarSetView(url.substring(6)); return; }
            if (url.charAt(0) === '@') return;
            window.open(url, '_blank');
          });
        }
      });</xsl:text>
          </xsl:if>
          <xsl:if test="TARGETBASE or IMGTARGET or TARGET">
            <xsl:text disable-output-escaping="yes">&#10;      // Marker-free preview: AR.js rewrites marker matrices and visibility
      // every frame, so the marker contents are reparented (THREE-level, the
      // DOM stays put) onto a stage entity in front of the camera, normalised
      // to a uniform size. Turning the toggle off moves them back.
      // Restore the previous marker-free choice (survives preview reloads)
      document.addEventListener('DOMContentLoaded', function () {
        var saved = null;
        try { saved = localStorage.getItem('fdar_marker_free'); } catch (e) {}
        if (saved === '1') {
          var cb = document.getElementById('mf-checkbox');
          if (cb) cb.checked = true;
          window.fdarMarkerFree(true);
        }
      });
      window.fdarMarkerFree = function (on) {
        window._mfOn = on;
        try { localStorage.setItem('fdar_marker_free', on ? '1' : '0'); } catch (e) {}
        var scene = document.querySelector('a-scene');
        if (!scene) return;
        if (!scene.hasLoaded) {
          scene.addEventListener('loaded', function () { window.fdarMarkerFree(on); }, { once: true });
          return;
        }
        var markers = Array.prototype.slice.call(document.querySelectorAll('a-marker'))
          .filter(function (m) { return m.object3D; });
        if (!markers.length) return;
        if (on) {
          if (!window._mfStage) {
            var stage = document.createElement('a-entity');
            stage.setAttribute('id', 'mf-stage');
            // Child of the camera: the staged content stays centred in view
            // regardless of how AR.js or look-controls move the camera
            var camEl = (scene.camera &amp;&amp; scene.camera.el) || scene;
            camEl.appendChild(stage);
            window._mfStage = stage;
          }
          var stageEl = window._mfStage;
          // Neutral backdrop while inspecting (restored on toggle off): the
          // scene background AND the AR.js webcam video behind the canvas —
          // otherwise the camera feed keeps showing through
          if (scene.object3D &amp;&amp; !window._mfBackground) {
            window._mfBackground = { had: scene.object3D.background };
            scene.object3D.background = new THREE.Color('#333333');
          }
          window._mfHiddenVideos = [];
          Array.prototype.forEach.call(document.querySelectorAll('video'), function (v) {
            if (v.style.display !== 'none') {
              window._mfHiddenVideos.push(v);
              v.style.display = 'none';
            }
          });
          // AR.js rewrites the camera pose/projection every frame from the
          // video calibration, which makes rendering and mouse raycasts
          // disagree. While marker-free is on, suspend the AR.js system and
          // set one standard projection for a stable, clickable view.
          var arSys = scene.systems &amp;&amp; scene.systems.arjs;
          if (arSys &amp;&amp; !window._mfArTick) {
            window._mfArTick = arSys.tick || true;
            arSys.tick = function () {};
          }
          // AR.js drives the camera matrix directly (matrixAutoUpdate off),
          // so after suspending it the render camera can be frozen in a pose
          // that no longer matches its entity — the whole stage then renders
          // offset. Re-enable normal matrix updates while inspecting.
          if (scene.camera) scene.camera.matrixAutoUpdate = true;
          window._mfSetProjection = function () {
            var cam = scene.camera;
            var canvas = scene.canvas;
            if (!cam || !canvas) return;
            var rect = canvas.getBoundingClientRect();
            if (rect.width &gt; 0 &amp;&amp; rect.height &gt; 0) {
              cam.fov = 60;
              cam.aspect = rect.width / rect.height;
              cam.updateProjectionMatrix();
            }
          };
          window._mfSetProjection();
          setTimeout(window._mfSetProjection, 500);
          window.addEventListener('resize', window._mfSetProjection);
          // Clicks: A-Frame's cursor rides on AR.js state, so raycast
          // ourselves with the same camera the scene renders with
          if (!window._mfClickHandler) {
            window._mfClickHandler = function (e) {
              if (!window._mfOn) return;
              // A drag-to-orbit gesture ends in a click; don't treat it as a tap
              if (window._mfDragged) { window._mfDragged = false; return; }
              var canvas = scene.canvas;
              if (!canvas || e.target !== canvas) return;
              var rect = canvas.getBoundingClientRect();
              var ndc = new THREE.Vector2(
                ((e.clientX - rect.left) / rect.width) * 2 - 1,
                -(((e.clientY - rect.top) / rect.height) * 2 - 1)
              );
              var ray = new THREE.Raycaster();
              ray.setFromCamera(ndc, scene.camera);
              var clickables = Array.prototype.slice.call(document.querySelectorAll('.clickable'))
                .filter(function (el) { return el.object3D &amp;&amp; !window.fdarHiddenChain(el); });
              var hits = ray.intersectObjects(clickables.map(function (el) { return el.object3D; }), true);
              if (!hits.length) return;
              var node = hits[0].object;
              var target = null;
              while (node) {
                if (node.el &amp;&amp; node.el.classList &amp;&amp; node.el.classList.contains('clickable')) { target = node.el; break; }
                node = node.parent;
              }
              if (target) target.emit('click');
            };
            document.addEventListener('click', window._mfClickHandler, true);
          }
          // Normalise: centre the content and scale it to ~1.2 units radius.
          // Only effectively visible meshes count — view-hidden content can
          // span a far larger volume and would shrink the visible part to
          // sub-pixel size. Re-run whenever late-loading geometry arrives so
          // the size does not depend on when the toggle was flipped.
          var fit = function (m) {
            var pivot = m._mfGroup;
            if (!pivot) return;
            var inner = pivot.children[0];
            inner.scale.set(1, 1, 1);
            inner.position.set(0, 0, 0);
            inner.rotation.set(0, 0, 0);
            var measure = function () {
              // Ancestor matrices (camera pose!) must be current before
              // measuring, or the recentring lands in a stale frame
              pivot.updateWorldMatrix(true, true);
              var box = new THREE.Box3();
              var tmp = new THREE.Box3();
              inner.traverse(function (o) {
                if (!o.isMesh) return;
                var p = o, vis = true;
                while (p &amp;&amp; p !== pivot.parent) {
                  if (p.visible === false) { vis = false; break; }
                  p = p.parent;
                }
                if (!vis) return;
                tmp.setFromObject(o);
                if (!tmp.isEmpty()) box.union(tmp);
              });
              if (box.isEmpty()) box.setFromObject(inner);
              return box;
            };
            var box = measure();
            if (box.isEmpty()) return;
            // Content lying flat on the marker plane (its Y extent much
            // smaller than its depth) would show almost edge-on in the
            // straight-ahead inspection camera: tip it upright first.
            var flat = box.getSize(new THREE.Vector3());
            if (flat.z > 0 &amp;&amp; flat.y &lt; flat.z * 0.35 &amp;&amp; flat.z &gt; flat.x * 0.35) {
              inner.rotation.x = -Math.PI / 2;
              box = measure();
              if (box.isEmpty()) return;
            }
            var sphere = box.getBoundingSphere(new THREE.Sphere());
            if (sphere.radius &gt; 0) {
              var s = 1.2 / sphere.radius;
              var center = pivot.worldToLocal(sphere.center.clone());
              inner.scale.setScalar(s);
              inner.position.copy(center).multiplyScalar(-s);
            }
          };
          window._mfFitAll = function () {
            if (window._mfFitTimer) clearTimeout(window._mfFitTimer);
            window.fdarProgress(true);
            window._mfFitTimer = setTimeout(function () {
              Array.prototype.forEach.call(document.querySelectorAll('a-marker'), function (m) {
                if (m._mfGroup) fit(m);
              });
              window.fdarProgress(false);
            }, 300);
          };
          // Manual navigation while marker-free is on: move the content with a
          // mouse drag or the arrow keys, zoom with the wheel. AR mode (a real
          // marker) keeps its fixed, camera-locked framing untouched. Dragging
          // pans rather than orbits so flat menu panels never turn edge-on and
          // vanish — the content stays on screen as the user moves it.
          window._mfNav = window._mfNav || { panX: 0, panY: 0, dist: 0 };
          window._mfApplyNav = function () {
            var st = window._mfStage;
            if (!st || !st.object3D) return;
            var n = window._mfNav;
            st.object3D.position.set(n.panX, n.panY, n.dist);
          };
          if (!window._mfNavBound) {
            window._mfNavBound = true;
            var scEl = scene;
            var canvas = function () { return scEl.canvas; };
            window._mfDrag = null;
            var onDown = function (e) {
              if (!window._mfOn || e.target !== canvas()) return;
              window._mfDrag = { x: e.clientX, y: e.clientY, moved: 0 };
            };
            var onMove = function (e) {
              if (!window._mfOn || !window._mfDrag) return;
              var dx = e.clientX - window._mfDrag.x, dy = e.clientY - window._mfDrag.y;
              window._mfDrag.x = e.clientX; window._mfDrag.y = e.clientY;
              window._mfDrag.moved += Math.abs(dx) + Math.abs(dy);
              window._mfNav.panX += dx * 0.004;   // follow the cursor
              window._mfNav.panY -= dy * 0.004;   // screen-down is world-down
              window._mfApplyNav();
            };
            var onUp = function () {
              // Remember whether this was a drag so the click handler can ignore it
              window._mfDragged = !!(window._mfDrag &amp;&amp; window._mfDrag.moved &gt; 6);
              window._mfDrag = null;
            };
            document.addEventListener('mousedown', onDown, true);
            document.addEventListener('mousemove', onMove, true);
            document.addEventListener('mouseup', onUp, true);
            document.addEventListener('wheel', function (e) {
              if (!window._mfOn) return;
              window._mfNav.dist += (e.deltaY &gt; 0 ? 1 : -1) * 0.15;  // dolly in/out
              window._mfApplyNav();
            }, { passive: true });
            window.addEventListener('keydown', function (e) {
              if (!window._mfOn) return;
              var t = e.target;
              if (t &amp;&amp; (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
              var step = 0.15;
              if (e.key === 'ArrowLeft') { window._mfNav.panX -= step; }
              else if (e.key === 'ArrowRight') { window._mfNav.panX += step; }
              else if (e.key === 'ArrowUp') { window._mfNav.panY += step; }
              else if (e.key === 'ArrowDown') { window._mfNav.panY -= step; }
              else return;
              e.preventDefault();
              window._mfApplyNav();
            }, true);
          }
          var mount = function () {
            markers.forEach(function (m, i) {
              if (m._mfGroup) return;
              var pivot = new THREE.Group();
              var inner = new THREE.Group();
              pivot.add(inner);
              m.object3D.children.slice().forEach(function (child) { inner.add(child); });
              pivot.position.set((i - (markers.length - 1) / 2) * 3, 0, -3);
              pivot.rotation.x = Math.PI / 2;   // marker content faces +Y; turn it to the camera
              m._mfGroup = pivot;
              stageEl.object3D.add(pivot);
              fit(m);
            });
            window._mfApplyNav();
            if (!window._mfRenormBound) {
              window._mfRenormBound = true;
              ['model-loaded', 'textfontset', 'materialtextureloaded', 'object3dset'].forEach(function (evt) {
                scene.addEventListener(evt, window._mfFitAll, true);
              });
              // Switching views changes which content is visible on the stage
              window.addEventListener('fdar-view-change', window._mfFitAll);
            }
          };
          if (stageEl.object3D) mount();
          else stageEl.addEventListener('loaded', mount, { once: true });
          // Keep re-fitting while active: late loads, view switches and camera
          // pose changes all shift the measured bounds
          if (!window._mfFitInterval) {
            window._mfFitInterval = setInterval(function () { window._mfFitAll(); }, 1000);
          }
        } else {
          if (window._mfFitInterval) { clearInterval(window._mfFitInterval); window._mfFitInterval = null; }
          // Reset navigation so the next marker-free session starts centred
          window._mfNav = { panX: 0, panY: 0, dist: 0 };
          if (window._mfStage &amp;&amp; window._mfStage.object3D) {
            window._mfStage.object3D.position.set(0, 0, 0);
          }
          var arSys2 = scene.systems &amp;&amp; scene.systems.arjs;
          if (arSys2 &amp;&amp; window._mfArTick) {
            if (window._mfArTick !== true) arSys2.tick = window._mfArTick;
            window._mfArTick = null;
          }
          if (window._mfSetProjection) {
            window.removeEventListener('resize', window._mfSetProjection);
            window._mfSetProjection = null;
          }
          if (window._mfBackground) {
            scene.object3D.background = window._mfBackground.had || null;
            window._mfBackground = null;
          }
          (window._mfHiddenVideos || []).forEach(function (v) { v.style.display = ''; });
          window._mfHiddenVideos = [];
          markers.forEach(function (m) {
            if (!m._mfGroup) return;
            var inner = m._mfGroup.children[0];
            inner.children.slice().forEach(function (child) { m.object3D.add(child); });
            if (m._mfGroup.parent) m._mfGroup.parent.remove(m._mfGroup);
            delete m._mfGroup;
          });
        }
      };</xsl:text>
          </xsl:if>
        <xsl:text disable-output-escaping="yes">&#10;    </xsl:text></script>
      </head>

      <body style="margin: 0; overflow: hidden;">
        <div id="fdar-progress" class="active"><xsl:text> </xsl:text></div>
        <xsl:if test="//VALUESERVER/WEBSOCKET">
          <div id="ws-status-overlay">
            <div id="ws-status-dot"><xsl:text> </xsl:text></div>
            <span id="ws-status-label">WebSocket</span>
          </div>
        </xsl:if>

        
        <xsl:if test="@viewdisplay = 'true' or @viewswitch = 'true'">
          <div id="view-hud">
            <xsl:if test="@viewswitch = 'true'"><button id="view-prev" onclick="window.fdarViewStep(-1)">&#x25C0;</button></xsl:if>
            <span id="view-name"><xsl:text> </xsl:text></span>
            <xsl:if test="@viewswitch = 'true'"><button id="view-next" onclick="window.fdarViewStep(1)">&#x25B6;</button></xsl:if>
          </div>
        </xsl:if>

        <xsl:if test="TARGETBASE or IMGTARGET or TARGET">
          <div id="marker-free-toggle">
            <label class="mf-switch">
              <input type="checkbox" id="mf-checkbox" onchange="window.fdarMarkerFree(this.checked)" />
              <span class="mf-slider"><xsl:text> </xsl:text></span>
            </label>
            <span id="mf-label">Show without marker</span>
          </div>
        </xsl:if>

        <a-scene vr-mode-ui="enabled: false">
          <xsl:if test="//MODEL[@texture] or //VIEWER or //DISPLAY">
            <xsl:attribute name="fdar-texture-guard"></xsl:attribute>
          </xsl:if>
          <xsl:choose>
            <xsl:when test="TARGETBASE or IMGTARGET or TARGET">
              <xsl:attribute name="embedded">embedded</xsl:attribute>
              <xsl:attribute name="arjs">sourceType: webcam; debugUIEnabled: false;</xsl:attribute>
            </xsl:when>
            <xsl:otherwise>
              <xsl:attribute name="background">color: #333333</xsl:attribute>
            </xsl:otherwise>
          </xsl:choose>

          <xsl:if test="//LINK or //SWITCH or //STREAMER or //TOUCH or //DISPLAY[starts-with(@text, '@video:')]">
            <xsl:attribute name="cursor">rayOrigin: mouse</xsl:attribute>
            <xsl:attribute name="raycaster">objects: .clickable</xsl:attribute>
            <xsl:attribute name="keyboard-nav"> </xsl:attribute>
            <xsl:attribute name="ar-cursor-fix"> </xsl:attribute>
          </xsl:if>

          <xsl:if test="//STREAMER or //DISPLAY[starts-with(@text, '@video:')]">
            <a-assets timeout="10000">
              <xsl:for-each select="//STREAMER | //DISPLAY[starts-with(@text, '@video:')]">
                <xsl:variable name="vUrl">
                  <xsl:choose>
                    <xsl:when test="self::DISPLAY"><xsl:value-of select="substring-after(@text, '@video:')"/></xsl:when>
                    <xsl:otherwise>
                      <xsl:call-template name="localized-value">
                        <xsl:with-param name="direct" select="@url"/>
                        <xsl:with-param name="container" select="METADATA/url"/>
                        <xsl:with-param name="fallbackLang" select="METADATA/@fallback"/>
                      </xsl:call-template>
                    </xsl:otherwise>
                  </xsl:choose>
                </xsl:variable>
                <xsl:variable name="vUrlAbs"><xsl:call-template name="asset-url"><xsl:with-param name="ref" select="$vUrl"/></xsl:call-template></xsl:variable>
                <xsl:if test="$vUrl != ''">
                  <video id="vid-{generate-id()}" src="{$vUrlAbs}" preload="auto" crossorigin="anonymous" playsinline="" webkit-playsinline="" muted="true">
                    <xsl:if test="@loop = 'true' or self::DISPLAY"><xsl:attribute name="loop">true</xsl:attribute></xsl:if>
                    <xsl:text> </xsl:text>
                  </video>
                </xsl:if>
              </xsl:for-each>
            </a-assets>
          </xsl:if>

          <!-- Applied per-kind (not as one union) so output order is identical
               across XSLT engines when a scene mixes markers and camera content -->
          <xsl:apply-templates select="VIRTUAL" />
          <xsl:apply-templates select="TARGETBASE" />
          <xsl:apply-templates select="IMGTARGET" />
          <xsl:apply-templates select="TARGET" />
          <xsl:apply-templates select="CAMERA" />

          <xsl:if test="not(CAMERA)">
            <a-entity camera="near: 0.01">
              <xsl:text> </xsl:text>
            </a-entity>
          </xsl:if>
        </a-scene>
      </body>
    </html>
  </xsl:template>

  <xsl:template match="TARGETBASE"><a-entity class="targetbase" dataset="{@file}"><xsl:apply-templates /></a-entity></xsl:template>
  
  <xsl:template match="CAMERA">
    <a-camera near="0.01">
      <!-- Plain (HUD) CAMERA content is authored for the app's camera; give the
           A-Frame camera a matching narrower fov so tx/ty offsets spread like
           the real app instead of clustering (default 80 vfov is too wide). -->
      <xsl:if test="not(@x != '' or @y != '' or @distance != '' or @scaleto != '')">
        <xsl:attribute name="fov">50</xsl:attribute>
      </xsl:if>
      <xsl:choose>
        <xsl:when test="@x != '' or @y != '' or @distance != '' or @scaleto != ''">
          <a-entity>
            <xsl:attribute name="fdar-camera-fit">x: <xsl:choose><xsl:when test="@x != ''"><xsl:value-of select="@x"/></xsl:when><xsl:otherwise>0.5</xsl:otherwise></xsl:choose>; y: <xsl:choose><xsl:when test="@y != ''"><xsl:value-of select="@y"/></xsl:when><xsl:otherwise>0.5</xsl:otherwise></xsl:choose>; distance: <xsl:choose><xsl:when test="@distance != ''"><xsl:value-of select="@distance"/></xsl:when><xsl:otherwise>1</xsl:otherwise></xsl:choose>; scaleto: <xsl:value-of select="@scaleto"/></xsl:attribute>
            <xsl:apply-templates />
          </a-entity>
        </xsl:when>
        <xsl:otherwise>
          <xsl:apply-templates />
        </xsl:otherwise>
      </xsl:choose>
    </a-camera>
  </xsl:template>
  
  <!-- TARGET (@marker) and IMGTARGET (@file with image extension stripped) render identically -->
  <xsl:template match="TARGET | IMGTARGET">
    <xsl:variable name="pattUrl">
      <xsl:choose>
        <xsl:when test="self::TARGET"><xsl:value-of select="@marker"/></xsl:when>
        <xsl:when test="contains(@file, '.jpg')"><xsl:value-of select="substring-before(@file, '.jpg')"/></xsl:when>
        <xsl:when test="contains(@file, '.jpeg')"><xsl:value-of select="substring-before(@file, '.jpeg')"/></xsl:when>
        <xsl:when test="contains(@file, '.png')"><xsl:value-of select="substring-before(@file, '.png')"/></xsl:when>
        <xsl:otherwise><xsl:value-of select="@file"/></xsl:otherwise>
      </xsl:choose>
    </xsl:variable>
    <xsl:variable name="markerSize">
      <xsl:choose>
        <xsl:when test="@size and number(@size) &gt; 0"><xsl:value-of select="@size"/></xsl:when>
        <xsl:when test="@width and number(@width) &gt; 0"><xsl:value-of select="@width"/></xsl:when>
        <xsl:otherwise>1</xsl:otherwise>
      </xsl:choose>
    </xsl:variable>
    <xsl:variable name="scaleFactor" select="1 div number($markerSize)" />
    <a-marker smooth="true" smoothCount="10" smoothTolerance="0.01" smoothThreshold="5">
      <!-- 'hiro' selects the AR.js built-in preset (used by the test scenes,
           printable everywhere); anything else is a pattern file next to the
           scene. Preset content is centred on the marker so it stays inside
           the black square. -->
      <xsl:choose>
        <xsl:when test="$pattUrl = 'hiro'">
          <xsl:attribute name="preset">hiro</xsl:attribute>
        </xsl:when>
        <xsl:otherwise>
          <xsl:attribute name="type">pattern</xsl:attribute>
          <xsl:attribute name="url"><xsl:value-of select="$pattUrl"/>.patt</xsl:attribute>
        </xsl:otherwise>
      </xsl:choose>
      <a-entity rotation="0 0 0" scale="{$scaleFactor} {$scaleFactor} {$scaleFactor}">
        <a-entity>
          <xsl:attribute name="position">
            <xsl:choose>
              <xsl:when test="$pattUrl = 'hiro'">0 0.005 0</xsl:when>
              <xsl:otherwise>0 0.005 <xsl:value-of select="0 - number($markerSize)"/></xsl:otherwise>
            </xsl:choose>
          </xsl:attribute>
          <xsl:apply-templates />
        </a-entity>
      </a-entity>
    </a-marker>
  </xsl:template>

  <xsl:template match="NODE">
    <xsl:variable name="tx"><xsl:choose><xsl:when test="starts-with(@tx, '@anim:')">0</xsl:when><xsl:when test="@tx"><xsl:value-of select="@tx"/></xsl:when><xsl:otherwise>0</xsl:otherwise></xsl:choose></xsl:variable>
    <xsl:variable name="ty"><xsl:choose><xsl:when test="starts-with(@ty, '@anim:')">0</xsl:when><xsl:when test="@ty"><xsl:value-of select="@ty"/></xsl:when><xsl:otherwise>0</xsl:otherwise></xsl:choose></xsl:variable>
    <xsl:variable name="tz">
      <xsl:choose>
        <xsl:when test="starts-with(@tz, '@anim:')">0</xsl:when>
        <xsl:when test="@tz"><xsl:value-of select="0 - number(@tz)"/></xsl:when>
        <xsl:otherwise>0</xsl:otherwise>
      </xsl:choose>
    </xsl:variable>
    <xsl:variable name="rx"><xsl:choose><xsl:when test="starts-with(@rx, '@anim:')">0</xsl:when><xsl:when test="@rx"><xsl:value-of select="0 - number(@rx)"/></xsl:when><xsl:otherwise>0</xsl:otherwise></xsl:choose></xsl:variable>
    <xsl:variable name="ry"><xsl:choose><xsl:when test="starts-with(@ry, '@anim:')">0</xsl:when><xsl:when test="@ry"><xsl:value-of select="0 - number(@ry)"/></xsl:when><xsl:otherwise>0</xsl:otherwise></xsl:choose></xsl:variable>
    <xsl:variable name="rz"><xsl:choose><xsl:when test="starts-with(@rz, '@anim:')">0</xsl:when><xsl:when test="@rz"><xsl:value-of select="@rz"/></xsl:when><xsl:otherwise>0</xsl:otherwise></xsl:choose></xsl:variable>
    
    <xsl:variable name="sxyz"><xsl:choose><xsl:when test="starts-with(@sxyz, '@anim:')">1</xsl:when><xsl:when test="@sxyz"><xsl:value-of select="@sxyz"/></xsl:when><xsl:otherwise>1</xsl:otherwise></xsl:choose></xsl:variable>
    <xsl:variable name="sx"><xsl:choose><xsl:when test="starts-with(@sx, '@anim:')">1</xsl:when><xsl:when test="@sx"><xsl:value-of select="@sx"/></xsl:when><xsl:otherwise>1</xsl:otherwise></xsl:choose></xsl:variable>
    <xsl:variable name="sy"><xsl:choose><xsl:when test="starts-with(@sy, '@anim:')">1</xsl:when><xsl:when test="@sy"><xsl:value-of select="@sy"/></xsl:when><xsl:otherwise>1</xsl:otherwise></xsl:choose></xsl:variable>
    <xsl:variable name="sz"><xsl:choose><xsl:when test="starts-with(@sz, '@anim:')">1</xsl:when><xsl:when test="@sz"><xsl:value-of select="@sz"/></xsl:when><xsl:otherwise>1</xsl:otherwise></xsl:choose></xsl:variable>

    <a-entity class="fdar-node">
      <!-- Omit transform attributes at their defaults: leaner, readable HTML -->
      <xsl:if test="concat($tx, ' ', $ty, ' ', $tz) != '0 0 0'">
        <xsl:attribute name="position"><xsl:value-of select="concat($tx, ' ', $ty, ' ', $tz)"/></xsl:attribute>
      </xsl:if>
      <xsl:if test="concat($rx, ' ', $ry, ' ', $rz) != '0 0 0'">
        <xsl:attribute name="rotation"><xsl:value-of select="concat($rx, ' ', $ry, ' ', $rz)"/></xsl:attribute>
      </xsl:if>
      <xsl:if test="not(number($sxyz) * number($sx) = 1 and number($sxyz) * number($sy) = 1 and number($sxyz) * number($sz) = 1)">
        <xsl:attribute name="scale"><xsl:value-of select="concat(number($sxyz) * number($sx), ' ', number($sxyz) * number($sy), ' ', number($sxyz) * number($sz))"/></xsl:attribute>
      </xsl:if>
      <xsl:if test="(@view and @view != '') or (@show and @show != '') or (@collapse and @collapse != '')">
        <xsl:attribute name="fdar-visibility">views: <xsl:value-of select="@view"/>; show: <xsl:value-of select="@show"/>; collapse: <xsl:value-of select="@collapse"/></xsl:attribute>
      </xsl:if>

      <!-- Variable-bound attributes: @anim: shorthand or single-keyframe
           ANIMATION (with increment/double/triple/jump smoothing) -->
      <xsl:variable name="bindSpec"><xsl:if test="starts-with(@tx, '@anim:')">tx: <xsl:value-of select="substring-after(@tx, '@anim:')"/>; </xsl:if><xsl:if test="starts-with(@ty, '@anim:')">ty: <xsl:value-of select="substring-after(@ty, '@anim:')"/>; </xsl:if><xsl:if test="starts-with(@tz, '@anim:')">tz: <xsl:value-of select="substring-after(@tz, '@anim:')"/>; </xsl:if><xsl:if test="starts-with(@rx, '@anim:')">rx: <xsl:value-of select="substring-after(@rx, '@anim:')"/>; </xsl:if><xsl:if test="starts-with(@ry, '@anim:')">ry: <xsl:value-of select="substring-after(@ry, '@anim:')"/>; </xsl:if><xsl:if test="starts-with(@rz, '@anim:')">rz: <xsl:value-of select="substring-after(@rz, '@anim:')"/>; </xsl:if><xsl:if test="starts-with(@sx, '@anim:')">sx: <xsl:value-of select="substring-after(@sx, '@anim:')"/>; </xsl:if><xsl:if test="starts-with(@sy, '@anim:')">sy: <xsl:value-of select="substring-after(@sy, '@anim:')"/>; </xsl:if><xsl:if test="starts-with(@sz, '@anim:')">sz: <xsl:value-of select="substring-after(@sz, '@anim:')"/>; </xsl:if><xsl:if test="starts-with(@sxyz, '@anim:')">sxyz: <xsl:value-of select="substring-after(@sxyz, '@anim:')"/>; </xsl:if><xsl:for-each select="ANIMATION[count(KEYFRAME) &lt;= 1 and (KEYFRAME/@value != '' or @targetvalue != '')]"><xsl:value-of select="@attribute"/>: <xsl:value-of select="concat(KEYFRAME/@value, @targetvalue)"/>:<xsl:choose><xsl:when test="@increment != ''"><xsl:value-of select="@increment"/></xsl:when><xsl:otherwise>0</xsl:otherwise></xsl:choose>:<xsl:choose><xsl:when test="@double != ''"><xsl:value-of select="@double"/></xsl:when><xsl:otherwise>0</xsl:otherwise></xsl:choose>:<xsl:choose><xsl:when test="@triple != ''"><xsl:value-of select="@triple"/></xsl:when><xsl:otherwise>0</xsl:otherwise></xsl:choose>:<xsl:choose><xsl:when test="@jump != ''"><xsl:value-of select="@jump"/></xsl:when><xsl:otherwise>0</xsl:otherwise></xsl:choose>; </xsl:for-each></xsl:variable>
      <xsl:if test="string($bindSpec) != ''">
        <xsl:attribute name="fdar-bind"><xsl:value-of select="$bindSpec"/></xsl:attribute>
      </xsl:if>

      <xsl:for-each select="ANIMATION[count(KEYFRAME) &gt;= 2]">
        <xsl:variable name="attr" select="@attribute" />
        <xsl:variable name="kf1" select="KEYFRAME[1]" />
        <xsl:variable name="kf2" select="KEYFRAME[last()]" />
        <xsl:variable name="dur">
          <xsl:choose>
            <xsl:when test="$kf1/@time and $kf2/@time"><xsl:value-of select="(number($kf2/@time) - number($kf1/@time)) * 1000"/></xsl:when>
            <xsl:otherwise>0</xsl:otherwise>
          </xsl:choose>
        </xsl:variable>

        <xsl:variable name="easing">
          <xsl:choose>
            <xsl:when test="$kf1/@lerp = 'linear'">linear</xsl:when>
            <xsl:otherwise>steps(1)</xsl:otherwise> 
          </xsl:choose>
        </xsl:variable>

        <xsl:variable name="prop">
          <xsl:choose>
            <xsl:when test="$attr='rx'">rotation.x</xsl:when>
            <xsl:when test="$attr='ry'">rotation.y</xsl:when>
            <xsl:when test="$attr='rz'">rotation.z</xsl:when>
            <xsl:when test="$attr='tx'">position.x</xsl:when>
            <xsl:when test="$attr='ty'">position.y</xsl:when>
            <xsl:when test="$attr='tz'">position.z</xsl:when>
            <xsl:when test="$attr='sxyz'">scale</xsl:when>
            <xsl:when test="$attr='sx'">scale.x</xsl:when>
            <xsl:when test="$attr='sy'">scale.y</xsl:when>
            <xsl:when test="$attr='sz'">scale.z</xsl:when>
          </xsl:choose>
        </xsl:variable>
        
        <xsl:variable name="fromStr">
          <xsl:choose>
            <xsl:when test="$attr='rz' or $attr='tx' or $attr='ty' or $attr='sx' or $attr='sy' or $attr='sz'">
              <xsl:value-of select="$kf1/@value"/>
            </xsl:when>
            <xsl:when test="$attr='rx' or $attr='ry'">
              <xsl:value-of select="0 - $kf1/@value"/>
            </xsl:when>
            <xsl:when test="$attr='tz'">
              <xsl:value-of select="0 - $kf1/@value"/>
            </xsl:when>
            <xsl:when test="$attr='sxyz'">
              <xsl:value-of select="concat(number($kf1/@value) * number($sx), ' ', number($kf1/@value) * number($sy), ' ', number($kf1/@value) * number($sz))"/>
            </xsl:when>
          </xsl:choose>
        </xsl:variable>
        
        <xsl:variable name="toStr">
          <xsl:choose>
            <xsl:when test="$attr='rz' or $attr='tx' or $attr='ty' or $attr='sx' or $attr='sy' or $attr='sz'">
              <xsl:value-of select="$kf2/@value"/>
            </xsl:when>
            <xsl:when test="$attr='rx' or $attr='ry'">
              <xsl:value-of select="0 - $kf2/@value"/>
            </xsl:when>
            <xsl:when test="$attr='tz'">
              <xsl:value-of select="0 - $kf2/@value"/>
            </xsl:when>
            <xsl:when test="$attr='sxyz'">
              <xsl:value-of select="concat(number($kf2/@value) * number($sx), ' ', number($kf2/@value) * number($sy), ' ', number($kf2/@value) * number($sz))"/>
            </xsl:when>
          </xsl:choose>
        </xsl:variable>
        
        <xsl:attribute name="animation__{$attr}">
          <xsl:value-of select="concat('property: ', $prop, '; from: ', $fromStr, '; to: ', $toStr, '; dur: ', $dur, '; easing: ', $easing, '; loop: true')" />
        </xsl:attribute>
      </xsl:for-each>

      <xsl:apply-templates />
    </a-entity>
  </xsl:template>

  <xsl:template match="TRANSMIT" />

  <!-- VIRTUAL: an anchor whose pose is driven by REFLECT elements; hidden
       until the first REFLECT reports a visible source -->
  <xsl:template match="VIRTUAL">
    <a-entity id="fdar-virtual-{@name}" visible="false" data-prioritisation="{@prioritisation}">
      <xsl:apply-templates />
    </a-entity>
  </xsl:template>

  <xsl:template match="REFLECT">
    <a-entity fdar-reflect="to: {@to}; priority: {@priority}"><xsl:text> </xsl:text></a-entity>
  </xsl:template>

  <!-- Unknown elements (e.g. xNODE / LINKxxx used to disable content in
       authored scenes) are dropped along with their subtree -->
  <xsl:template match="*" />

  <xsl:template match="DISPLAY">
    <xsl:choose>
      <xsl:when test="starts-with(@text, '@video:')">
        <a-video src="#vid-{generate-id()}" width="16" height="9" class="clickable" crossorigin="anonymous" video-controller="">
          <xsl:call-template name="hover-outline-rect">
            <xsl:with-param name="w" select="16"/>
            <xsl:with-param name="h" select="9"/>
          </xsl:call-template>
          <xsl:text> </xsl:text>
        </a-video>
      </xsl:when>
      <xsl:otherwise>
        <a-text align="center" color="white" outlineColor="black" outlineWidth="0.1" side="double" value="{@text}">
          <xsl:attribute name="scale">
            <xsl:choose>
              <xsl:when test="ancestor::TARGET or ancestor::IMGTARGET">0.75 0.75 0.75</xsl:when>
              <xsl:otherwise>4 4 4</xsl:otherwise>
            </xsl:choose>
          </xsl:attribute>
          <xsl:text> </xsl:text>
        </a-text>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template match="SWITCH">
    <xsl:variable name="w"><xsl:choose><xsl:when test="@w"><xsl:value-of select="@w"/></xsl:when><xsl:otherwise>1</xsl:otherwise></xsl:choose></xsl:variable>
    <xsl:variable name="h"><xsl:choose><xsl:when test="@h"><xsl:value-of select="@h"/></xsl:when><xsl:otherwise>1</xsl:otherwise></xsl:choose></xsl:variable>
    <xsl:variable name="d"><xsl:choose><xsl:when test="@d"><xsl:value-of select="@d"/></xsl:when><xsl:otherwise>1</xsl:otherwise></xsl:choose></xsl:variable>
    
    <xsl:variable name="transmit" select="TRANSMIT" />
    <xsl:variable name="transmitKey" select="$transmit/@variable" />
    <xsl:variable name="transmitterId" select="$transmit/@transmitter" />

    <xsl:variable name="isOn">
      <xsl:choose>
        <xsl:when test="@on='true' or @on='wahr' or @on='on' or @on='enable' or @on='show'">true</xsl:when>
        <xsl:otherwise>false</xsl:otherwise>
      </xsl:choose>
    </xsl:variable>

    <a-entity geometry="primitive: box; width: {$w}; height: {$h}; depth: {$d}" class="clickable">
      <xsl:call-template name="hover-outline-rect">
        <xsl:with-param name="w" select="$w"/>
        <xsl:with-param name="h" select="$h"/>
      </xsl:call-template>
      <xsl:attribute name="fdar-switch">transmitKey: <xsl:value-of select="$transmitKey"/>; transmitter: <xsl:value-of select="$transmitterId"/>; on: <xsl:value-of select="$isOn"/>;<xsl:if test="@onvalue != ''"> onvalue: <xsl:value-of select="@onvalue"/>;</xsl:if><xsl:if test="@offvalue != ''"> offvalue: <xsl:value-of select="@offvalue"/>;</xsl:if><xsl:if test="@pressedvalue != ''"> pressedvalue: <xsl:value-of select="@pressedvalue"/>;</xsl:if><xsl:if test="@unpressedvalue != ''"> unpressedvalue: <xsl:value-of select="@unpressedvalue"/>;</xsl:if></xsl:attribute>
      <xsl:call-template name="clickable-fill"/>
    </a-entity>
  </xsl:template>

  <xsl:template match="LINK">
    <xsl:variable name="linkUrl">
      <xsl:call-template name="localized-value">
        <xsl:with-param name="direct" select="@refer"/>
        <xsl:with-param name="container" select="METADATA/refer"/>
        <xsl:with-param name="fallbackLang" select="METADATA/@fallback"/>
      </xsl:call-template>
    </xsl:variable>
    <xsl:variable name="w"><xsl:choose><xsl:when test="@w"><xsl:value-of select="@w"/></xsl:when><xsl:otherwise>1</xsl:otherwise></xsl:choose></xsl:variable>
    <xsl:variable name="h"><xsl:choose><xsl:when test="@h"><xsl:value-of select="@h"/></xsl:when><xsl:otherwise>1</xsl:otherwise></xsl:choose></xsl:variable>
    <xsl:variable name="d"><xsl:choose><xsl:when test="@d"><xsl:value-of select="@d"/></xsl:when><xsl:otherwise>1</xsl:otherwise></xsl:choose></xsl:variable>

    <a-entity geometry="primitive: box; width: {$w}; height: {$h}; depth: {$d}" class="clickable" navigate-on-click="url: {$linkUrl}">
      <xsl:call-template name="hover-outline-rect">
        <xsl:with-param name="w" select="$w"/>
        <xsl:with-param name="h" select="$h"/>
      </xsl:call-template>
      <xsl:call-template name="clickable-fill"/>
    </a-entity>
  </xsl:template>

  <xsl:template match="MODEL">
    <a-entity>
      <xsl:if test="@tint">
        <xsl:attribute name="fdar-color">tint: <xsl:value-of select="@tint"/></xsl:attribute>
      </xsl:if>

      <xsl:if test="LINK">
        <xsl:variable name="linkUrl">
          <xsl:call-template name="localized-value">
            <xsl:with-param name="direct" select="LINK/@refer"/>
            <xsl:with-param name="container" select="LINK/METADATA/refer"/>
            <xsl:with-param name="fallbackLang" select="LINK/METADATA/@fallback"/>
          </xsl:call-template>
        </xsl:variable>
      </xsl:if>

      <xsl:choose>
        <xsl:when test="@file = 'planexy' or @file = 'fdar_white'">
          <xsl:attribute name="geometry">primitive: plane; width: 1; height: 1</xsl:attribute>
          <xsl:attribute name="rotation">-90 0 0</xsl:attribute>
          <xsl:variable name="matSrc">
            <xsl:choose>
              <xsl:when test="@texture"><xsl:text>src: url(</xsl:text><xsl:call-template name="asset-url"><xsl:with-param name="ref" select="@texture"/></xsl:call-template><xsl:text>); transparent: true; side: double; shader: flat</xsl:text></xsl:when>
              <xsl:otherwise>color: white; side: double; shader: flat</xsl:otherwise>
            </xsl:choose>
          </xsl:variable>
          <xsl:attribute name="material"><xsl:value-of select="$matSrc"/></xsl:attribute>
        </xsl:when>
        
        <xsl:when test="@file = 'cube'">
          <xsl:attribute name="geometry">primitive: box; width: 1; height: 1; depth: 1</xsl:attribute>
          <xsl:choose>
            <xsl:when test="MATERIAL[@type = 'mask']">
              <xsl:attribute name="fdar-mask"></xsl:attribute>
            </xsl:when>
            <xsl:when test="@texture and @texture != 'fdar_white'">
              <xsl:attribute name="material">src: url(<xsl:call-template name="asset-url"><xsl:with-param name="ref" select="@texture"/></xsl:call-template>)</xsl:attribute>
            </xsl:when>
          </xsl:choose>
        </xsl:when>

        <!-- An image file is a textured plane (menu icons, panels), not a
             3D model: obj-model would XHR the picture as OBJ and fail -->
        <xsl:when test="contains(@file, '.png') or contains(@file, '.jpg') or contains(@file, '.jpeg') or contains(@file, '.gif')">
          <xsl:attribute name="geometry">primitive: plane; width: 1; height: 1</xsl:attribute>
          <xsl:attribute name="material">
            <xsl:text>src: url(</xsl:text>
            <xsl:choose>
              <xsl:when test="@texture"><xsl:call-template name="asset-url"><xsl:with-param name="ref" select="@texture"/></xsl:call-template></xsl:when>
              <xsl:otherwise><xsl:call-template name="asset-url"><xsl:with-param name="ref" select="@file"/></xsl:call-template></xsl:otherwise>
            </xsl:choose>
            <xsl:text>); transparent: true; side: double; shader: flat</xsl:text>
          </xsl:attribute>
        </xsl:when>

        <xsl:when test="contains(@file, '.glb') or contains(@file, '.gltf') or @filetype='glb' or @filetype='gltf'">
          <xsl:attribute name="gltf-model"><xsl:call-template name="asset-url"><xsl:with-param name="ref" select="@file"/></xsl:call-template></xsl:attribute>
          <xsl:variable name="clip"><xsl:choose><xsl:when test="@clip"><xsl:value-of select="@clip"/></xsl:when><xsl:otherwise>*</xsl:otherwise></xsl:choose></xsl:variable>
          <xsl:variable name="loop"><xsl:choose><xsl:when test="@playmode = 'loop'">repeat</xsl:when><xsl:when test="@playmode = 'pingpong'">pingpong</xsl:when><xsl:when test="@play = 'true'">repeat</xsl:when><xsl:otherwise>repeat</xsl:otherwise></xsl:choose></xsl:variable>
          <xsl:attribute name="animation-mixer">clip: <xsl:value-of select="$clip"/>; loop: <xsl:value-of select="$loop"/>;</xsl:attribute>
        </xsl:when>
        
        <xsl:otherwise>
          <xsl:attribute name="obj-model">
            <xsl:text>obj: url(</xsl:text><xsl:call-template name="asset-url"><xsl:with-param name="ref" select="@file"/></xsl:call-template><xsl:text>)</xsl:text>
          </xsl:attribute>

          <xsl:choose>
            <xsl:when test="@texture and @alpha">
              <xsl:attribute name="material">src: url(<xsl:call-template name="asset-url"><xsl:with-param name="ref" select="@texture"/></xsl:call-template>); opacity: <xsl:value-of select="number(@alpha) div 100"/>; transparent: true</xsl:attribute>
            </xsl:when>
            <xsl:when test="@texture">
              <xsl:attribute name="material">src: url(<xsl:call-template name="asset-url"><xsl:with-param name="ref" select="@texture"/></xsl:call-template>)</xsl:attribute>
            </xsl:when>
            <xsl:when test="@alpha">
              <xsl:attribute name="material">opacity: <xsl:value-of select="number(@alpha) div 100"/>; transparent: true</xsl:attribute>
            </xsl:when>
          </xsl:choose>
          
          <xsl:attribute name="scale">1 1 1</xsl:attribute>
        </xsl:otherwise>
      </xsl:choose>
      <xsl:if test="LINK">
        <xsl:variable name="linkUrl2">
          <xsl:call-template name="localized-value">
            <xsl:with-param name="direct" select="LINK/@refer"/>
            <xsl:with-param name="container" select="LINK/METADATA/refer"/>
            <xsl:with-param name="fallbackLang" select="LINK/METADATA/@fallback"/>
          </xsl:call-template>
        </xsl:variable>
        <a-entity class="clickable" navigate-on-click="url: {$linkUrl2}">
          <xsl:attribute name="fdar-fit-parent">w: <xsl:choose><xsl:when test="LINK/@w"><xsl:value-of select="LINK/@w"/></xsl:when><xsl:otherwise>0</xsl:otherwise></xsl:choose>; h: <xsl:choose><xsl:when test="LINK/@h"><xsl:value-of select="LINK/@h"/></xsl:when><xsl:otherwise>0</xsl:otherwise></xsl:choose>; d: <xsl:choose><xsl:when test="LINK/@d"><xsl:value-of select="LINK/@d"/></xsl:when><xsl:otherwise>0</xsl:otherwise></xsl:choose></xsl:attribute>
          <xsl:attribute name="fdar-area"><xsl:if test="LINK/@rgba or LINK/@rgb">color: <xsl:choose><xsl:when test="LINK/@rgba"><xsl:value-of select="LINK/@rgba"/></xsl:when><xsl:otherwise><xsl:value-of select="LINK/@rgb"/></xsl:otherwise></xsl:choose>; </xsl:if><xsl:if test="LINK/@alpha">alpha: <xsl:value-of select="LINK/@alpha"/>; </xsl:if><xsl:if test="LINK/@pulse">pulse: <xsl:value-of select="LINK/@pulse"/>; </xsl:if></xsl:attribute>
          <xsl:text> </xsl:text>
        </a-entity>
      </xsl:if>
      <xsl:text> </xsl:text>
    </a-entity>
  </xsl:template>

  <!-- TOUCH: a NODE with a draggable interaction area -->
  <xsl:template match="TOUCH">
    <xsl:variable name="tx"><xsl:choose><xsl:when test="@tx"><xsl:value-of select="@tx"/></xsl:when><xsl:otherwise>0</xsl:otherwise></xsl:choose></xsl:variable>
    <xsl:variable name="ty"><xsl:choose><xsl:when test="@ty"><xsl:value-of select="@ty"/></xsl:when><xsl:otherwise>0</xsl:otherwise></xsl:choose></xsl:variable>
    <xsl:variable name="tz"><xsl:choose><xsl:when test="@tz"><xsl:value-of select="0 - number(@tz)"/></xsl:when><xsl:otherwise>0</xsl:otherwise></xsl:choose></xsl:variable>
    <xsl:variable name="rx"><xsl:choose><xsl:when test="@rx"><xsl:value-of select="0 - number(@rx)"/></xsl:when><xsl:otherwise>0</xsl:otherwise></xsl:choose></xsl:variable>
    <xsl:variable name="ry"><xsl:choose><xsl:when test="@ry"><xsl:value-of select="0 - number(@ry)"/></xsl:when><xsl:otherwise>0</xsl:otherwise></xsl:choose></xsl:variable>
    <xsl:variable name="rz"><xsl:choose><xsl:when test="@rz"><xsl:value-of select="@rz"/></xsl:when><xsl:otherwise>0</xsl:otherwise></xsl:choose></xsl:variable>
    <xsl:variable name="sxyz"><xsl:choose><xsl:when test="@sxyz"><xsl:value-of select="@sxyz"/></xsl:when><xsl:otherwise>1</xsl:otherwise></xsl:choose></xsl:variable>
    <xsl:variable name="sx"><xsl:choose><xsl:when test="@sx"><xsl:value-of select="@sx"/></xsl:when><xsl:otherwise>1</xsl:otherwise></xsl:choose></xsl:variable>
    <xsl:variable name="sy"><xsl:choose><xsl:when test="@sy"><xsl:value-of select="@sy"/></xsl:when><xsl:otherwise>1</xsl:otherwise></xsl:choose></xsl:variable>
    <xsl:variable name="sz"><xsl:choose><xsl:when test="@sz"><xsl:value-of select="@sz"/></xsl:when><xsl:otherwise>1</xsl:otherwise></xsl:choose></xsl:variable>
    <xsl:variable name="w"><xsl:choose><xsl:when test="@w"><xsl:value-of select="@w"/></xsl:when><xsl:otherwise>1</xsl:otherwise></xsl:choose></xsl:variable>
    <xsl:variable name="h"><xsl:choose><xsl:when test="@h"><xsl:value-of select="@h"/></xsl:when><xsl:otherwise>1</xsl:otherwise></xsl:choose></xsl:variable>
    <xsl:variable name="d"><xsl:choose><xsl:when test="@d"><xsl:value-of select="@d"/></xsl:when><xsl:otherwise>1</xsl:otherwise></xsl:choose></xsl:variable>
    <a-entity class="fdar-node">
      <!-- Omit transform attributes at their defaults: leaner, readable HTML -->
      <xsl:if test="concat($tx, ' ', $ty, ' ', $tz) != '0 0 0'">
        <xsl:attribute name="position"><xsl:value-of select="concat($tx, ' ', $ty, ' ', $tz)"/></xsl:attribute>
      </xsl:if>
      <xsl:if test="concat($rx, ' ', $ry, ' ', $rz) != '0 0 0'">
        <xsl:attribute name="rotation"><xsl:value-of select="concat($rx, ' ', $ry, ' ', $rz)"/></xsl:attribute>
      </xsl:if>
      <xsl:if test="not(number($sxyz) * number($sx) = 1 and number($sxyz) * number($sy) = 1 and number($sxyz) * number($sz) = 1)">
        <xsl:attribute name="scale"><xsl:value-of select="concat(number($sxyz) * number($sx), ' ', number($sxyz) * number($sy), ' ', number($sxyz) * number($sz))"/></xsl:attribute>
      </xsl:if>
      <xsl:if test="(@view and @view != '') or (@show and @show != '') or (@collapse and @collapse != '')">
        <xsl:attribute name="fdar-visibility">views: <xsl:value-of select="@view"/>; show: <xsl:value-of select="@show"/>; collapse: <xsl:value-of select="@collapse"/></xsl:attribute>
      </xsl:if>
      <xsl:attribute name="fdar-touch">rotate: <xsl:choose><xsl:when test="@rotate = 'true'">true</xsl:when><xsl:otherwise>false</xsl:otherwise></xsl:choose>; scale: <xsl:choose><xsl:when test="@scale = 'true'">true</xsl:when><xsl:otherwise>false</xsl:otherwise></xsl:choose>; translate: <xsl:choose><xsl:when test="@translate = 'true'">true</xsl:when><xsl:otherwise>false</xsl:otherwise></xsl:choose></xsl:attribute>
      <a-entity class="clickable" geometry="primitive: box; width: {$w}; height: {$h}; depth: {$d}">
        <xsl:call-template name="clickable-fill"/>
        <xsl:text> </xsl:text>
      </a-entity>
      <xsl:apply-templates />
    </a-entity>
  </xsl:template>

  <!-- EFFECT: approximated fire (billboard-free cone flames + point light) -->
  <xsl:template match="EFFECT">
    <xsl:if test="@type = 'fire' and not(@enabled = 'false')">
      <a-entity>
        <a-cone radius-bottom="0.15" radius-top="0.02" height="0.5" position="0 0.25 0" material="color: #ff6a00; emissive: #ff3300; emissiveIntensity: 1; transparent: true; opacity: 0.85; shader: flat" animation__flicker="property: material.opacity; from: 0.85; to: 0.45; dir: alternate; dur: 120; loop: true" animation__sway="property: scale; from: 1 1 1; to: 1.15 0.9 1.15; dir: alternate; dur: 180; loop: true"><xsl:text> </xsl:text></a-cone>
        <a-cone radius-bottom="0.08" radius-top="0.01" height="0.3" position="0 0.18 0" material="color: #ffd000; emissive: #ffaa00; emissiveIntensity: 1; transparent: true; opacity: 0.9; shader: flat" animation__flicker="property: material.opacity; from: 0.9; to: 0.6; dir: alternate; dur: 90; loop: true"><xsl:text> </xsl:text></a-cone>
        <a-light type="point" color="#ff8800" intensity="0.8" distance="2" position="0 0.3 0"><xsl:text> </xsl:text></a-light>
      </a-entity>
    </xsl:if>
  </xsl:template>

  <xsl:template match="VIEWER">
    <xsl:variable name="picUrl">
      <xsl:call-template name="localized-value">
        <xsl:with-param name="direct" select="@picture"/>
        <xsl:with-param name="container" select="METADATA/picture"/>
        <xsl:with-param name="fallbackLang" select="METADATA/@fallback"/>
      </xsl:call-template>
    </xsl:variable>
    <xsl:variable name="picUrlAbs"><xsl:call-template name="asset-url"><xsl:with-param name="ref" select="$picUrl"/></xsl:call-template></xsl:variable>
    <xsl:variable name="picW"><xsl:choose><xsl:when test="@w"><xsl:value-of select="@w"/></xsl:when><xsl:otherwise>1</xsl:otherwise></xsl:choose></xsl:variable>
    <xsl:variable name="picH"><xsl:choose><xsl:when test="@h"><xsl:value-of select="@h"/></xsl:when><xsl:otherwise>1</xsl:otherwise></xsl:choose></xsl:variable>

    <a-image src="{$picUrlAbs}" side="double" crossorigin="anonymous">
      <xsl:if test="@w"><xsl:attribute name="width"><xsl:value-of select="@w"/></xsl:attribute></xsl:if>
      <xsl:if test="@h"><xsl:attribute name="height"><xsl:value-of select="@h"/></xsl:attribute></xsl:if>
      
      <xsl:if test="LINK">
        <!-- NB: the fallback language comes from the VIEWER's own METADATA, not the LINK's -->
        <xsl:variable name="linkUrl">
          <xsl:call-template name="localized-value">
            <xsl:with-param name="direct" select="LINK/@refer"/>
            <xsl:with-param name="container" select="LINK/METADATA/refer"/>
            <xsl:with-param name="fallbackLang" select="METADATA/@fallback"/>
          </xsl:call-template>
        </xsl:variable>
        <xsl:attribute name="class">clickable</xsl:attribute>
        <xsl:call-template name="hover-outline-rect">
          <xsl:with-param name="w" select="$picW"/>
          <xsl:with-param name="h" select="$picH"/>
        </xsl:call-template>
        <xsl:attribute name="navigate-on-click">url: <xsl:value-of select="$linkUrl"/></xsl:attribute>
      </xsl:if>

      <xsl:choose>
        <xsl:when test="ancestor::TARGET or ancestor::IMGTARGET">
          <xsl:attribute name="scale">0.25 0.25 0.25</xsl:attribute>
        </xsl:when>
        <xsl:otherwise><xsl:attribute name="scale">5 5 5</xsl:attribute></xsl:otherwise>
      </xsl:choose>

      <xsl:variable name="refreshInterval">
        <xsl:choose><xsl:when test="@refresh"><xsl:value-of select="@refresh"/></xsl:when><xsl:otherwise>10</xsl:otherwise></xsl:choose>
      </xsl:variable>
      <xsl:attribute name="image-refresher">src: <xsl:value-of select="$picUrl"/>; interval: <xsl:value-of select="$refreshInterval"/></xsl:attribute>
    </a-image>
  </xsl:template>

  <xsl:template match="STREAMER">
    <xsl:variable name="videoUrl">
      <xsl:call-template name="localized-value">
        <xsl:with-param name="direct" select="@url"/>
        <xsl:with-param name="container" select="METADATA/url"/>
        <xsl:with-param name="fallbackLang" select="METADATA/@fallback"/>
      </xsl:call-template>
    </xsl:variable>
    <xsl:variable name="vWidth"><xsl:choose><xsl:when test="@w"><xsl:value-of select="@w"/></xsl:when><xsl:otherwise>1.6</xsl:otherwise></xsl:choose></xsl:variable>
    <xsl:variable name="vHeight"><xsl:choose><xsl:when test="@h"><xsl:value-of select="@h"/></xsl:when><xsl:otherwise>0.9</xsl:otherwise></xsl:choose></xsl:variable>
    <xsl:if test="$videoUrl != ''">
      <a-video src="#vid-{generate-id()}" width="{$vWidth}" height="{$vHeight}" class="clickable" crossorigin="anonymous">
        <xsl:attribute name="video-controller">status: <xsl:choose><xsl:when test="@status != ''"><xsl:value-of select="@status"/></xsl:when><xsl:otherwise>play</xsl:otherwise></xsl:choose>; position: <xsl:choose><xsl:when test="@position != ''"><xsl:value-of select="@position"/></xsl:when><xsl:otherwise>0</xsl:otherwise></xsl:choose>; showpos: <xsl:choose><xsl:when test="@showpos = 'true'">true</xsl:when><xsl:otherwise>false</xsl:otherwise></xsl:choose></xsl:attribute>
        <xsl:call-template name="hover-outline-rect">
          <xsl:with-param name="w" select="$vWidth"/>
          <xsl:with-param name="h" select="$vHeight"/>
        </xsl:call-template>
        <xsl:choose>
          <xsl:when test="ancestor::TARGET or ancestor::IMGTARGET">
            <xsl:attribute name="scale">0.25 0.25 0.25</xsl:attribute>
          </xsl:when>
          <xsl:otherwise><xsl:attribute name="scale">1 1 1</xsl:attribute></xsl:otherwise>
        </xsl:choose>
      </a-video>
    </xsl:if>
  </xsl:template>

  <!-- COUNTER: mechanical counter (padded digits on rollers, colored case) -->
  <xsl:template match="COUNTER">
    <xsl:variable name="instScale"><xsl:choose>
      <xsl:when test="ancestor::TARGET or ancestor::IMGTARGET">0.75 0.75 0.75</xsl:when>
      <xsl:otherwise>14 14 14</xsl:otherwise>
    </xsl:choose></xsl:variable>
    <a-entity scale="{$instScale}">
      <xsl:attribute name="fdar-counter">value: <xsl:value-of select="@value"/>; intdigits: <xsl:choose><xsl:when test="@intdigits != ''"><xsl:value-of select="@intdigits"/></xsl:when><xsl:otherwise>3</xsl:otherwise></xsl:choose>; fractdigits: <xsl:choose><xsl:when test="@fractdigits != ''"><xsl:value-of select="@fractdigits"/></xsl:when><xsl:otherwise>0</xsl:otherwise></xsl:choose>; intrgb: <xsl:value-of select="@intrgb"/>; fractrgb: <xsl:value-of select="@fractrgb"/>; wheelintrgb: <xsl:value-of select="@wheelintrgb"/>; wheelfractrgb: <xsl:value-of select="@wheelfractrgb"/>; casergb: <xsl:value-of select="@casergb"/>; commargb: <xsl:value-of select="@commargb"/></xsl:attribute>
      <xsl:text> </xsl:text>
    </a-entity>
  </xsl:template>

  <!-- VUMETER: pointer instrument (needle deflection 0..1, over/under lamp) -->
  <xsl:template match="VUMETER">
    <xsl:variable name="instScale"><xsl:choose>
      <xsl:when test="ancestor::TARGET or ancestor::IMGTARGET">0.75 0.75 0.75</xsl:when>
      <xsl:otherwise>14 14 14</xsl:otherwise>
    </xsl:choose></xsl:variable>
    <a-entity scale="{$instScale}">
      <xsl:attribute name="fdar-vumeter">value: <xsl:value-of select="@value"/>; label: <xsl:value-of select="@label"/>; labelmin: <xsl:value-of select="@labelmin"/>; labelmax: <xsl:value-of select="@labelmax"/></xsl:attribute>
      <xsl:text> </xsl:text>
    </a-entity>
  </xsl:template>

  <xsl:template match="TEXT">
    <xsl:variable name="txtVal">
      <xsl:choose>
        <xsl:when test="@value"><xsl:value-of select="@value"/></xsl:when>
        <xsl:when test="@label"><xsl:value-of select="@label"/></xsl:when>
        <xsl:otherwise>
          <xsl:call-template name="localized-value">
            <xsl:with-param name="direct" select="''"/>
            <xsl:with-param name="container" select="METADATA/label"/>
            <xsl:with-param name="fallbackLang" select="METADATA/@fallback"/>
          </xsl:call-template>
        </xsl:otherwise>
      </xsl:choose>
    </xsl:variable>

    <!-- Text sizing depends on the local unit scale. Marker/image-target
         content and screen-relative CAMERA content (with x/y/distance/scaleto,
         e.g. the Measuring Pro home view) are authored in mm-style units and
         need the small 0.75 factor. A plain CAMERA scene (the user's
         "Hello World": tz=100, no scaleto) is authored in large units, where
         a-text's width-derived glyphs would otherwise be sub-pixel — those
         keep the larger 50 factor so the text is legible. -->
    <xsl:variable name="textScale"><xsl:choose>
      <xsl:when test="ancestor::TARGET or ancestor::IMGTARGET or ancestor::CAMERA[@scaleto != '' or @distance != '' or @x != '' or @y != '']">0.75 0.75 0.75</xsl:when>
      <xsl:otherwise>4 4 4</xsl:otherwise>
    </xsl:choose></xsl:variable>

    <xsl:choose>
      <xsl:when test="LINK">
        <xsl:variable name="linkUrl">
          <xsl:call-template name="localized-value">
            <xsl:with-param name="direct" select="LINK/@refer"/>
            <xsl:with-param name="container" select="LINK/METADATA/refer"/>
            <xsl:with-param name="fallbackLang" select="LINK/METADATA/@fallback"/>
          </xsl:call-template>
        </xsl:variable>
        <xsl:variable name="lw"><xsl:choose><xsl:when test="LINK/@w"><xsl:value-of select="LINK/@w"/></xsl:when><xsl:otherwise>0</xsl:otherwise></xsl:choose></xsl:variable>
        <xsl:variable name="lh"><xsl:choose><xsl:when test="LINK/@h"><xsl:value-of select="LINK/@h"/></xsl:when><xsl:otherwise>0</xsl:otherwise></xsl:choose></xsl:variable>
        <xsl:variable name="ld"><xsl:choose><xsl:when test="LINK/@d"><xsl:value-of select="LINK/@d"/></xsl:when><xsl:otherwise>0</xsl:otherwise></xsl:choose></xsl:variable>
        <a-entity scale="{$textScale}">
          <a-entity class="clickable" fdar-fit-parent="w: {$lw}; h: {$lh}; d: {$ld}" geometry="primitive: box; width: 2; height: 1; depth: 0.01">
            <xsl:attribute name="fdar-area"><xsl:if test="LINK/@rgba or LINK/@rgb">color: <xsl:choose><xsl:when test="LINK/@rgba"><xsl:value-of select="LINK/@rgba"/></xsl:when><xsl:otherwise><xsl:value-of select="LINK/@rgb"/></xsl:otherwise></xsl:choose>; </xsl:if><xsl:if test="LINK/@alpha">alpha: <xsl:value-of select="LINK/@alpha"/>; </xsl:if><xsl:if test="LINK/@pulse">pulse: <xsl:value-of select="LINK/@pulse"/>; </xsl:if></xsl:attribute>
            <xsl:call-template name="hover-outline-rect">
              <xsl:with-param name="w" select="2 + number($lw)"/>
              <xsl:with-param name="h" select="1 + number($lh)"/>
            </xsl:call-template>
            <xsl:attribute name="navigate-on-click">url: <xsl:value-of select="$linkUrl"/></xsl:attribute>
            <xsl:text> </xsl:text>
          </a-entity>
          <a-text align="center" baseline="center" anchor="center" color="white" outlineColor="black" outlineWidth="0.1" side="double" fdar-label-fmt="">
            <xsl:call-template name="text-display-attrs">
              <xsl:with-param name="txtVal" select="$txtVal"/>
            </xsl:call-template>
            <xsl:text> </xsl:text>
          </a-text>
        </a-entity>
      </xsl:when>
      <xsl:otherwise>
        <a-text align="center" color="white" outlineColor="black" outlineWidth="0.1" side="double" fdar-label-fmt="">
          <xsl:call-template name="text-display-attrs">
            <xsl:with-param name="txtVal" select="$txtVal"/>
            <xsl:with-param name="scale" select="$textScale"/>
          </xsl:call-template>
          <xsl:text> </xsl:text>
        </a-text>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template match="SIGNAL">
    <xsl:variable name="hexColor"><xsl:choose><xsl:when test="starts-with(@rgb, '#')"><xsl:value-of select="@rgb"/></xsl:when><xsl:otherwise><xsl:value-of select="concat('#', @rgb)"/></xsl:otherwise></xsl:choose></xsl:variable>
    <xsl:variable name="wsKey"><xsl:if test="starts-with(@status, '@anim:')"><xsl:value-of select="substring-after(@status, '@anim:')"/></xsl:if></xsl:variable>
    
    <xsl:variable name="isOn">
      <xsl:choose>
        <xsl:when test="@status='true' or @status='wahr' or @status='on' or @status='enable' or @status='show'">true</xsl:when>
        <xsl:otherwise>false</xsl:otherwise>
      </xsl:choose>
    </xsl:variable>
    
    <xsl:variable name="rad">
      <xsl:choose>
        <xsl:when test="ancestor::TARGET or ancestor::IMGTARGET">0.0125</xsl:when>
        <xsl:otherwise>0.5</xsl:otherwise>
      </xsl:choose>
    </xsl:variable>

    <a-sphere radius="{$rad}" color="{$hexColor}">
      <xsl:attribute name="ws-signal">color: <xsl:value-of select="$hexColor"/>; key: <xsl:value-of select="$wsKey"/>; on: <xsl:value-of select="$isOn"/>;</xsl:attribute>
    </a-sphere>
  </xsl:template>

  <!-- ============================================================ -->
  <!-- COMPILATION: a catalog of AUGMENTATION scenes                -->
  <!-- Renders a menu page. Entry links point at the pre-generated  -->
  <!-- <entry>.html (xsltproc workflow); when that file is missing  -->
  <!-- the entry XML is transformed in the browser with the native  -->
  <!-- XSLTProcessor as a fallback.                                 -->
  <!-- ============================================================ -->
  <xsl:template match="/COMPILATION | /DIRECTORY">
    <xsl:text disable-output-escaping="yes">&lt;!DOCTYPE html&gt;&#10;</xsl:text>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title><xsl:value-of select="@name"/></title>
        <style><xsl:text disable-output-escaping="yes">
      body { margin: 0; min-height: 100vh; background: #1e1e1e; color: #ccc;
             font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
             display: flex; justify-content: center; }
      main { max-width: 640px; width: 100%; padding: 48px 24px; }
      h1 { color: #e0e0e0; font-size: 22px; margin: 0 0 12px; }
      .desc { color: #999; font-size: 14px; line-height: 1.6; white-space: pre-line;
              margin: 0 0 28px; }
      ul.entries { list-style: none; margin: 0; padding: 0; }
      ul.entries li { margin: 0 0 10px; }
      a.entry { display: block; background: #2d2d2d; border: 1px solid #3c3c3c;
                border-radius: 8px; padding: 14px 18px; color: #4fb3ff;
                text-decoration: none; font-size: 15px; transition: background .15s; }
      a.entry:hover { background: #37373d; }
      a.entry small { color: #777; display: block; font-size: 11px; margin-top: 3px; }
    </xsl:text></style>
      </head>
      <body>
        <main>
          <h1><xsl:value-of select="@name"/></h1>
          <xsl:variable name="desc">
            <xsl:call-template name="localized-value">
              <xsl:with-param name="direct" select="@desc"/>
              <xsl:with-param name="container" select="METADATA/desc"/>
              <xsl:with-param name="fallbackLang" select="METADATA/@fallback"/>
            </xsl:call-template>
          </xsl:variable>
          <xsl:if test="$desc != ''"><p class="desc"><xsl:value-of select="$desc"/></p></xsl:if>
          <ul class="entries">
            <xsl:for-each select="ENTRY">
              <xsl:variable name="base">
                <xsl:choose>
                  <xsl:when test="contains(@url, '.xml')"><xsl:value-of select="substring-before(@url, '.xml')"/></xsl:when>
                  <xsl:otherwise><xsl:value-of select="@url"/></xsl:otherwise>
                </xsl:choose>
              </xsl:variable>
              <xsl:variable name="entryName">
                <xsl:call-template name="localized-value">
                  <xsl:with-param name="direct" select="@name"/>
                  <xsl:with-param name="container" select="METADATA/name"/>
                  <xsl:with-param name="fallbackLang" select="METADATA/@fallback"/>
                </xsl:call-template>
              </xsl:variable>
              <xsl:variable name="entryDesc">
                <xsl:call-template name="localized-value">
                  <xsl:with-param name="direct" select="@desc"/>
                  <xsl:with-param name="container" select="METADATA/desc"/>
                  <xsl:with-param name="fallbackLang" select="METADATA/@fallback"/>
                </xsl:call-template>
              </xsl:variable>
              <li><a class="entry" href="{$base}.html" data-xml="{@url}">
                <xsl:choose>
                  <xsl:when test="$entryName != ''"><xsl:value-of select="$entryName"/></xsl:when>
                  <xsl:otherwise><xsl:value-of select="$base"/></xsl:otherwise>
                </xsl:choose>
                <small><xsl:choose>
                  <xsl:when test="$entryDesc != ''"><xsl:value-of select="$entryDesc"/></xsl:when>
                  <xsl:otherwise><xsl:value-of select="@url"/></xsl:otherwise>
                </xsl:choose></small>
              </a></li>
            </xsl:for-each>
          </ul>
        </main>
        <script><xsl:text disable-output-escaping="yes">
      // Prefer the pre-generated .html; fall back to transforming the .xml
      // in the browser (native XSLTProcessor ignores d-o-e, so script/style
      // bodies are unescaped and self-closing tags expanded afterwards).
      function resolveHref(h) {
        try { return new URL(h, document.baseURI).href; } catch (e) { return h; }
      }
      document.addEventListener('click', function (e) {
        var a = e.target.closest ? e.target.closest('a.entry') : null;
        if (!a) return;
        e.preventDefault();
        if (window.parent !== window) {
          // Editor preview: let the editor open the entry as a new tab
          window.parent.postMessage({ type: 'fdar-open-entry', url: a.getAttribute('data-xml') }, '*');
          return;
        }
        var href = resolveHref(a.getAttribute('href'));
        fetch(href, { method: 'HEAD' }).then(function (r) {
          if (r.ok) { window.location.href = href; return; }
          transformAndOpen(a.getAttribute('data-xml'));
        }).catch(function () { transformAndOpen(a.getAttribute('data-xml')); });
      });
      function fetchText(url) {
        return fetch(resolveHref(url)).then(function (r) {
          if (!r.ok) throw new Error(url + ': HTTP ' + r.status);
          return r.text();
        });
      }
      function fixMarkup(html) {
        var VOID = /^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/i;
        html = html.replace(/\s+xmlns(:[a-zA-Z0-9]+)?="[^"]*"/g, '');
        html = html.replace(/&lt;([a-zA-Z][a-zA-Z0-9-]*)(\s[^&gt;]*)?\s*\/&gt;/g, function (m, tag, attrs) {
          if (VOID.test(tag)) return m;
          return '&lt;' + tag + (attrs || '') + '&gt;&lt;/' + tag + '&gt;';
        });
        html = html.replace(/&lt;(script|style)([^&gt;]*)&gt;([\s\S]*?)&lt;\/\1&gt;/gi, function (m, tag, attrs, body) {
          var AMP = String.fromCharCode(38);
          body = body.replace(new RegExp(AMP + 'lt;', 'g'), '&lt;').replace(new RegExp(AMP + 'gt;', 'g'), '&gt;').replace(new RegExp(AMP + 'amp;', 'g'), AMP);
          return '&lt;' + tag + attrs + '&gt;' + body + '&lt;/' + tag + '&gt;';
        });
        return html;
      }
      function transformAndOpen(xmlUrl) {
        Promise.all([fetchText(xmlUrl), fetchText('aframe.xsl')]).then(function (parts) {
          var p = new DOMParser();
          var proc = new XSLTProcessor();
          proc.importStylesheet(p.parseFromString(parts[1], 'text/xml'));
          var doc = proc.transformToDocument(p.parseFromString(parts[0], 'text/xml'));
          var html = new XMLSerializer().serializeToString(doc.documentElement);
          html = fixMarkup(html);
          var baseHref = window.location.href.replace(/[^\/]*$/, '');
          html = html.replace(/&lt;head&gt;/i, '&lt;head&gt;&lt;base href="' + baseHref + '"&gt;');
          html = '&lt;!DOCTYPE html&gt;\n' + html;
          var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
          window.location.href = URL.createObjectURL(blob);
        }).catch(function (err) { alert('Failed to open entry: ' + err.message); });
      }
    </xsl:text></script>
      </body>
    </html>
  </xsl:template>

  <!-- PACK: a downloadable package; CONTENT entries link to their archives -->
  <xsl:template match="/PACK">
    <xsl:text disable-output-escaping="yes">&lt;!DOCTYPE html&gt;&#10;</xsl:text>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title><xsl:value-of select="@name"/></title>
        <style><xsl:text disable-output-escaping="yes">
      body { margin: 0; min-height: 100vh; background: #1e1e1e; color: #ccc;
             font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
             display: flex; justify-content: center; }
      main { max-width: 640px; width: 100%; padding: 48px 24px; }
      h1 { color: #e0e0e0; font-size: 22px; margin: 0 0 12px; }
      .desc { color: #999; font-size: 14px; line-height: 1.6; white-space: pre-line; margin: 0 0 28px; }
      ul.entries { list-style: none; margin: 0; padding: 0; }
      ul.entries li { margin: 0 0 10px; }
      a.entry { display: block; background: #2d2d2d; border: 1px solid #3c3c3c;
                border-radius: 8px; padding: 14px 18px; color: #4fb3ff;
                text-decoration: none; font-size: 15px; }
      a.entry:hover { background: #37373d; }
        </xsl:text></style>
      </head>
      <body>
        <main>
          <h1><xsl:value-of select="@name"/></h1>
          <xsl:if test="@desc != ''"><p class="desc"><xsl:value-of select="@desc"/></p></xsl:if>
          <ul class="entries">
            <xsl:for-each select="CONTENT">
              <li><a class="entry" href="{@file}" download=""><xsl:value-of select="@file"/></a></li>
            </xsl:for-each>
          </ul>
        </main>
      </body>
    </html>
  </xsl:template>

  <!-- ============================================================ -->
  <!-- Shared helpers                                               -->
  <!-- ============================================================ -->

  <!-- Resolve a possibly-localized value: a direct attribute wins, then the
       METADATA child matching the fallback language (default 'en'), then the
       first METADATA child. -->
  <xsl:template name="localized-value">
    <xsl:param name="direct"/>
    <xsl:param name="container"/>
    <xsl:param name="fallbackLang"/>
    <xsl:variable name="lang">
      <xsl:choose>
        <xsl:when test="$fallbackLang != ''"><xsl:value-of select="$fallbackLang"/></xsl:when>
        <xsl:otherwise>en</xsl:otherwise>
      </xsl:choose>
    </xsl:variable>
    <!-- Values are materialized through value-of before comparing: some engines
         (xslt-processor) return an empty string-value for CDATA-backed elements
         in comparisons while value-of still yields the content -->
    <xsl:variable name="localized"><xsl:value-of select="$container/*[local-name()=$lang]"/></xsl:variable>
    <xsl:variable name="first"><xsl:value-of select="$container/*[1]"/></xsl:variable>
    <xsl:choose>
      <xsl:when test="$direct != ''"><xsl:value-of select="$direct"/></xsl:when>
      <xsl:when test="$localized != ''"><xsl:value-of select="$localized"/></xsl:when>
      <xsl:when test="$first != ''"><xsl:value-of select="$first"/></xsl:when>
    </xsl:choose>
  </xsl:template>

  <!-- Rectangular hover-outline attribute, slightly larger than the target -->
  <xsl:template name="hover-outline-rect">
    <xsl:param name="w"/>
    <xsl:param name="h"/>
    <xsl:attribute name="hover-outline">type: rect; width: <xsl:value-of select="number($w) + 0.1"/>; height: <xsl:value-of select="number($h) + 0.1"/></xsl:attribute>
  </xsl:template>

  <!-- Interaction-area appearance (LINK/SWITCH/TOUCH): rgba wins over rgb,
       alpha/pulse pass through, defaults resolved in the fdar-area component -->
  <xsl:template name="clickable-fill">
    <xsl:attribute name="fdar-area"><xsl:if test="@rgba or @rgb">color: <xsl:choose><xsl:when test="@rgba"><xsl:value-of select="@rgba"/></xsl:when><xsl:otherwise><xsl:value-of select="@rgb"/></xsl:otherwise></xsl:choose>; </xsl:if><xsl:if test="@alpha">alpha: <xsl:value-of select="@alpha"/>; </xsl:if><xsl:if test="@pulse">pulse: <xsl:value-of select="@pulse"/>; </xsl:if></xsl:attribute>
  </xsl:template>

  <!-- Attributes common to every a-text: width, colors, optional scale and the
       static value or its @anim: websocket binding -->
  <xsl:template name="text-display-attrs">
    <xsl:param name="txtVal"/>
    <xsl:param name="scale" select="''"/>
    <xsl:if test="@width and @width != '0'"><xsl:attribute name="width"><xsl:value-of select="@width"/></xsl:attribute></xsl:if>
    <xsl:if test="@rgba or @backrgba">
      <xsl:attribute name="fdar-color"><xsl:if test="@rgba">rgba: <xsl:value-of select="@rgba"/>; </xsl:if><xsl:if test="@backrgba">backrgba: <xsl:value-of select="@backrgba"/>; </xsl:if></xsl:attribute>
    </xsl:if>
    <xsl:if test="$scale != ''"><xsl:attribute name="scale"><xsl:value-of select="$scale"/></xsl:attribute></xsl:if>
    <xsl:choose>
      <xsl:when test="starts-with($txtVal, '@anim:')">
        <xsl:attribute name="ws-value-updater">key: <xsl:value-of select="substring-after($txtVal, '@anim:')"/></xsl:attribute>
        <xsl:attribute name="value">---</xsl:attribute>
      </xsl:when>
      <xsl:otherwise><xsl:attribute name="value"><xsl:value-of select="$txtVal"/></xsl:attribute></xsl:otherwise>
    </xsl:choose>
  </xsl:template>
</xsl:stylesheet>