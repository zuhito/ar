<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="xml" encoding="UTF-8" indent="yes" omit-xml-declaration="yes" />
  <xsl:strip-space elements="*" />

  <xsl:template match="/AUGMENTATION">
    <xsl:text disable-output-escaping="yes">&lt;!DOCTYPE html&gt;&#10;</xsl:text>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>AR App</title>
        <script src="https://aframe.io/releases/1.7.1/aframe.min.js"><xsl:text> </xsl:text></script>
        
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
        
        <script>
          <xsl:text disable-output-escaping="yes">&#10;      console.log('A-Frame Custom Components Initialized');</xsl:text>

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
            if (self.items.length &gt; 0) setActive(0);
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
            <xsl:text disable-output-escaping="yes">&#10;      AFRAME.registerComponent('ar-cursor-fix', {
        init: function () {
          var sc = this.el;
          sc.addEventListener('loaded', function () {
            setTimeout(function () {
              var cc = sc.components.cursor;
              if (!cc) { var el = sc.querySelector('[cursor]'); if (el) cc = el.components.cursor; }
              if (!cc) return;
              var P = {ox:2, oy:-5, sx:2.2, sy:2.1};
              function fix(evt) {
                var c = sc.canvas; if (!c) return evt;
                var r = c.getBoundingClientRect(), cx = r.left+r.width/2, cy = r.top+r.height/2;
                return new MouseEvent(evt.type, {clientX:cx+(evt.clientX-cx)*P.sx+P.ox, clientY:cy+(evt.clientY-cy)*P.sy+P.oy, bubbles:true, cancelable:true});
              }
              if (cc.onMouseMove) { var om=cc.onMouseMove.bind(cc); cc.onMouseMove=function(e){om(fix(e));}; }
              if (cc.onCursorDown) { var od=cc.onCursorDown.bind(cc); cc.onCursorDown=function(e){od(fix(e));}; }
              if (cc.onCursorUp) { var ou=cc.onCursorUp.bind(cc); cc.onCursorUp=function(e){ou(fix(e));}; }
            }, 2500);
          });
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

          <xsl:if test="//NODE[@view != ''] or @viewlist or @views or //*[starts-with(@show, '@anim:')] or //*[starts-with(@collapse, '@anim:')]">
            <xsl:text disable-output-escaping="yes">&#10;      // View system: fdar-visibility nodes toggle with the current view and
      // @anim: bound show/collapse variables; @view: links call fdarSetView
      window.fdarVars = {};
      window.fdarCurrentView = '</xsl:text><xsl:value-of select="substring-before(concat(@viewlist, @views, ','), ',')"/><xsl:text disable-output-escaping="yes">';
      window.fdarSetView = function (name) {
        window.fdarCurrentView = name;
        window.dispatchEvent(new CustomEvent('fdar-view-change', { detail: { view: name } }));
      };
      window.addEventListener('fdar-variable-update', function (e) {
        window.fdarVars[e.detail.key] = e.detail.value;
      });
      window.fdarTruthy = function (v) {
        var s = String(v).toLowerCase();
        return s === 'true' || s === 'wahr' || s === 'on' || s === 'enable' || s === 'show' || s === '1';
      };
      window.fdarHiddenChain = function (el) {
        var o = el.object3D;
        while (o) { if (o.visible === false) return true; o = o.parent; }
        return false;
      };
      AFRAME.registerComponent('fdar-visibility', {
        schema: {
          views: {type: 'string', default: ''},
          show: {type: 'string', default: ''},
          collapse: {type: 'string', default: ''}
        },
        init: function () {
          var self = this;
          this.viewList = this.data.views ? this.data.views.split(',') : null;
          window.addEventListener('fdar-view-change', function () { self.apply(); });
          window.addEventListener('fdar-variable-update', function (e) {
            if (e.detail.key === self.data.show || e.detail.key === self.data.collapse) self.apply();
          });
          this.apply();
        },
        apply: function () {
          var visible = true;
          if (this.viewList &amp;&amp; this.viewList.indexOf(window.fdarCurrentView) === -1) visible = false;
          if (visible &amp;&amp; this.data.show) {
            var v = window.fdarVars[this.data.show];
            if (v !== undefined &amp;&amp; !window.fdarTruthy(v)) visible = false;
          }
          if (visible &amp;&amp; this.data.collapse) {
            var c = window.fdarVars[this.data.collapse];
            if (c !== undefined &amp;&amp; window.fdarTruthy(c)) visible = false;
          }
          this.el.setAttribute('visible', visible);
        }
      });</xsl:text>
          </xsl:if>

          <xsl:if test="//VALUESERVER/@predefined">
            <xsl:text disable-output-escaping="yes">&#10;      // Initial variable values from VALUESERVER/@predefined (JSON)
      document.addEventListener('DOMContentLoaded', function () {
        setTimeout(function () {
          var data = {};</xsl:text>
            <xsl:for-each select="//VALUESERVER/@predefined">
              <xsl:text disable-output-escaping="yes">&#10;          try { Object.assign(data, </xsl:text><xsl:value-of select="."/><xsl:text disable-output-escaping="yes">); } catch (e) { console.warn('predefined parse failed', e); }</xsl:text>
            </xsl:for-each>
            <xsl:text disable-output-escaping="yes">&#10;          Object.keys(data).forEach(function (k) {
            window.dispatchEvent(new CustomEvent('fdar-variable-update', { detail: { key: k, value: data[k] } }));
          });
        }, 800);
      });</xsl:text>
          </xsl:if>

          <xsl:if test="//SWITCH or //LINK or //STREAMER or //DISPLAY[starts-with(@text, '@video:')]">
            <xsl:text disable-output-escaping="yes">&#10;      AFRAME.registerComponent('hover-outline', {
        schema: { 
          type: { type: 'string', default: 'circle' },
          width: { type: 'number', default: 1.2 },
          height: { type: 'number', default: 1.2 }
        },
        init: function () {
          this.el.addEventListener('mouseenter', () =&gt; {
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
            if (this.outline) {
              this.el.removeChild(this.outline);
              this.outline = null;
            }
          });
        }
      });</xsl:text>
          </xsl:if>

          <xsl:if test="//@rgba | //@rgb | //@tint | //@backrgba">
            <xsl:text disable-output-escaping="yes">&#10;      AFRAME.registerComponent('fdar-color', {
        schema: { 
          rgba: {type: 'string', default: ''},
          tint: {type: 'string', default: ''} 
        },
        init: function () { this.applyColor(); },
        update: function () { this.applyColor(); },
        applyColor: function() {
          var parseHex = function(hex) {
            if(!hex) return null;
            if(hex.startsWith('#')) hex = hex.substring(1);
            var r = hex.length &gt;= 6 ? hex.substring(0,6) : hex.substring(0,3);
            var a = 'ff';
            if(hex.length === 8) a = hex.substring(6,8);
            else if(hex.length === 4) a = hex.substring(3,4) + hex.substring(3,4);
            return { color: '#' + r, opacity: parseInt(a, 16) / 255 };
          };

          var main = parseHex(this.data.rgba) || parseHex(this.data.tint);
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
        schema: { url: {type: 'string', default: ''}, key: {type: 'string', default: ''} },
        init: function () { 
          var rawKey = this.data.key;
          this.animKey = rawKey.includes(':') ? rawKey.split(':')[0] : rawKey;
          
          window.addEventListener('fdar-variable-update', (e) =&gt; {
            if (e.detail.key === this.animKey) {
              this.el.setAttribute('value', e.detail.value);
            }
          });

          if (this.data.url) this.connect(); 
        },
        connect: function () {
          const el = this.el; const self = this;
          this.socket = new WebSocket(this.data.url);
          this.socket.onopen = () =&gt; { window.updateWsStatus(true); };
          this.socket.onmessage = (event) =&gt; {
            try { 
              const data = JSON.parse(event.data); 
              if (data[self.animKey] !== undefined) el.setAttribute('value', data[self.animKey]); 
            } catch (e) {}
          };
          this.socket.onclose = () =&gt; { window.updateWsStatus(false); setTimeout(() =&gt; { self.connect(); }, 3000); };
          this.socket.onerror = () =&gt; { this.socket.close(); };
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

          <xsl:if test="//SIGNAL">
            <xsl:text disable-output-escaping="yes">&#10;      AFRAME.registerComponent('ws-signal', {
        schema: {
          url: {type: 'string', default: ''},
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
              const val = String(e.detail.value).toLowerCase();
              this.isOn = (val === 'true' || val === 'wahr' || val === 'on' || val === 'enable' || val === 'show' || val === '1');
              this.updateVisual();
            }
          });

          if (this.data.url &amp;&amp; this.animKey) {
            this.connect();
          }
          this.updateVisual();
        },
        connect: function () {
          const self = this;
          this.socket = new WebSocket(this.data.url);
          this.socket.onopen = () =&gt; { window.updateWsStatus(true); };
          this.socket.onmessage = (event) =&gt; {
            try {
              const data = JSON.parse(event.data);
              if (data[self.animKey] !== undefined) {
                const val = String(data[self.animKey]).toLowerCase();
                self.isOn = (val === 'true' || val === 'wahr' || val === 'on' || val === 'enable' || val === 'show' || val === '1');
                self.updateVisual();
              }
            } catch(e) { }
          };
          this.socket.onclose = () =&gt; { window.updateWsStatus(false); setTimeout(() =&gt; { self.connect(); }, 3000); };
          this.socket.onerror = () =&gt; { this.socket.close(); };
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
          url: {type: 'string', default: ''},
          transmitKey: {type: 'string', default: ''},
          on: {type: 'boolean', default: false},
          onvalue: {type: 'string', default: 'true'},
          offvalue: {type: 'string', default: 'false'},
          pressedvalue: {type: 'string', default: ''},
          unpressedvalue: {type: 'string', default: ''}
        },
        init: function () {
          this.isOn = this.data.on;
          this.socket = null;
          
          if (this.data.url) {
            this.connect();
          }
          
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
          if (this.socket &amp;&amp; this.socket.readyState === WebSocket.OPEN) {
            const payload = {};
            payload[this.data.transmitKey] = valStr;
            this.socket.send(JSON.stringify(payload));
          }
        },
        connect: function () {
          this.socket = new WebSocket(this.data.url);
          this.socket.onopen = () =&gt; { window.updateWsStatus(true); };
          this.socket.onclose = () =&gt; { window.updateWsStatus(false); setTimeout(() =&gt; { this.connect(); }, 3000); };
          this.socket.onerror = () =&gt; { this.socket.close(); };
        }
      });</xsl:text>
          </xsl:if>

          <xsl:if test="//STREAMER or //DISPLAY[starts-with(@text, '@video:')]">
            <xsl:text disable-output-escaping="yes">&#10;      AFRAME.registerComponent('video-controller', {
        init: function () {
          const el = this.el;
          const videoId = el.getAttribute('src');
          if(!videoId || !videoId.startsWith('#')) return;
          const video = document.querySelector(videoId);
          if(video) {
            video.addEventListener('loadeddata', () =&gt; { video.play().catch(e =&gt; {}); });
            el.addEventListener('click', () =&gt; { video.muted = false; if (video.paused) { video.play(); } else { video.pause(); } });
          }
        }
      });</xsl:text>
          </xsl:if>

          <xsl:if test="//VIEWER[@refresh]">
            <xsl:text disable-output-escaping="yes">&#10;      AFRAME.registerComponent('image-refresher', {
        schema: { src: {type: 'string'}, interval: {type: 'number', default: 5} },
        init: function () {
          if (this.data.interval &gt; 0) {
            this.timer = setInterval(() =&gt; {
              const originalSrc = this.data.src; 
              const separator = originalSrc.includes('?') ? '&amp;' : '?';
              const newSrc = originalSrc + separator + 't=' + Date.now();
              const loader = new THREE.TextureLoader(); loader.setCrossOrigin('anonymous');
              loader.load(newSrc, (texture) =&gt; {
                const mesh = this.el.getObject3D('mesh');
                if (mesh &amp;&amp; mesh.material) { if (mesh.material.map) mesh.material.map.dispose(); mesh.material.map = texture; mesh.material.needsUpdate = true; }
              });
            }, this.data.interval * 1000);
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
        <xsl:text disable-output-escaping="yes">&#10;    </xsl:text></script>
      </head>

      <body style="margin: 0; overflow: hidden;">
        <xsl:if test="//VALUESERVER/WEBSOCKET">
          <div id="ws-status-overlay">
            <div id="ws-status-dot"><xsl:text> </xsl:text></div>
            <span id="ws-status-label">WebSocket</span>
          </div>
        </xsl:if>

        
        <a-scene vr-mode-ui="enabled: false">
          <xsl:choose>
            <xsl:when test="TARGETBASE or IMGTARGET or TARGET">
              <xsl:attribute name="embedded">embedded</xsl:attribute>
              <xsl:attribute name="arjs">sourceType: webcam; debugUIEnabled: false;</xsl:attribute>
            </xsl:when>
            <xsl:otherwise>
              <xsl:attribute name="background">color: #333333</xsl:attribute>
            </xsl:otherwise>
          </xsl:choose>

          <xsl:if test="//LINK or //SWITCH or //STREAMER or //DISPLAY[starts-with(@text, '@video:')]">
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
                <xsl:if test="$vUrl != ''">
                  <video id="vid-{generate-id()}" src="{$vUrl}" preload="auto" crossorigin="anonymous" playsinline="" webkit-playsinline="" muted="true">
                    <xsl:if test="@loop = 'true' or self::DISPLAY"><xsl:attribute name="loop">true</xsl:attribute></xsl:if>
                    <xsl:text> </xsl:text>
                  </video>
                </xsl:if>
              </xsl:for-each>
            </a-assets>
          </xsl:if>

          <!-- Applied per-kind (not as one union) so output order is identical
               across XSLT engines when a scene mixes markers and camera content -->
          <xsl:apply-templates select="TARGETBASE" />
          <xsl:apply-templates select="IMGTARGET" />
          <xsl:apply-templates select="TARGET" />
          <xsl:apply-templates select="CAMERA" />

          <xsl:if test="not(CAMERA)">
            <a-entity camera="camera">
              <xsl:text> </xsl:text>
            </a-entity>
          </xsl:if>
        </a-scene>
      </body>
    </html>
  </xsl:template>

  <xsl:template match="TARGETBASE"><a-entity class="targetbase" dataset="{@file}"><xsl:apply-templates /></a-entity></xsl:template>
  
  <xsl:template match="CAMERA">
    <a-camera near="0.001">
      <xsl:apply-templates />
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
    <a-marker type="pattern" url="{$pattUrl}.patt" smooth="true" smoothCount="10" smoothTolerance="0.01" smoothThreshold="5">
      <a-entity rotation="0 0 0" scale="{$scaleFactor} {$scaleFactor} {$scaleFactor}">
        <a-entity position="0 0.005 {0 - number($markerSize)}">
          <xsl:apply-templates />
        </a-entity>
      </a-entity>
    </a-marker>
  </xsl:template>

  <xsl:template match="NODE">
    <xsl:variable name="tx"><xsl:choose><xsl:when test="@tx"><xsl:value-of select="@tx"/></xsl:when><xsl:otherwise>0</xsl:otherwise></xsl:choose></xsl:variable>
    <xsl:variable name="ty"><xsl:choose><xsl:when test="@ty"><xsl:value-of select="@ty"/></xsl:when><xsl:otherwise>0</xsl:otherwise></xsl:choose></xsl:variable>
    <xsl:variable name="tz">
      <xsl:choose>
        <xsl:when test="@tz"><xsl:value-of select="0 - number(@tz)"/></xsl:when>
        <xsl:otherwise>0</xsl:otherwise>
      </xsl:choose>
    </xsl:variable>
    <xsl:variable name="rx"><xsl:choose><xsl:when test="@rx"><xsl:value-of select="0 - number(@rx)"/></xsl:when><xsl:otherwise>0</xsl:otherwise></xsl:choose></xsl:variable>
    <xsl:variable name="ry"><xsl:choose><xsl:when test="@ry"><xsl:value-of select="0 - number(@ry)"/></xsl:when><xsl:otherwise>0</xsl:otherwise></xsl:choose></xsl:variable>
    <xsl:variable name="rz"><xsl:choose><xsl:when test="@rz"><xsl:value-of select="@rz"/></xsl:when><xsl:otherwise>0</xsl:otherwise></xsl:choose></xsl:variable>
    
    <xsl:variable name="sxyz"><xsl:choose><xsl:when test="@sxyz"><xsl:value-of select="@sxyz"/></xsl:when><xsl:otherwise>1</xsl:otherwise></xsl:choose></xsl:variable>
    <xsl:variable name="sx"><xsl:choose><xsl:when test="@sx"><xsl:value-of select="@sx"/></xsl:when><xsl:otherwise>1</xsl:otherwise></xsl:choose></xsl:variable>
    <xsl:variable name="sy"><xsl:choose><xsl:when test="@sy"><xsl:value-of select="@sy"/></xsl:when><xsl:otherwise>1</xsl:otherwise></xsl:choose></xsl:variable>
    <xsl:variable name="sz"><xsl:choose><xsl:when test="@sz"><xsl:value-of select="@sz"/></xsl:when><xsl:otherwise>1</xsl:otherwise></xsl:choose></xsl:variable>

    <a-entity position="{$tx} {$ty} {$tz}" rotation="{$rx} {$ry} {$rz}" scale="{number($sxyz) * number($sx)} {number($sxyz) * number($sy)} {number($sxyz) * number($sz)}">
      <xsl:if test="(@view and @view != '') or starts-with(@show, '@anim:') or starts-with(@collapse, '@anim:')">
        <xsl:attribute name="fdar-visibility">views: <xsl:value-of select="@view"/>; show: <xsl:value-of select="substring-after(@show, '@anim:')"/>; collapse: <xsl:value-of select="substring-after(@collapse, '@anim:')"/></xsl:attribute>
      </xsl:if>

      <xsl:for-each select="ANIMATION">
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
              <xsl:otherwise>50 50 50</xsl:otherwise>
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
    <xsl:variable name="wsUrl">
      <xsl:choose>
        <xsl:when test="$transmitterId != ''"><xsl:value-of select="//VALUESERVER/WEBSOCKET[@transmitter=$transmitterId]/@url" /></xsl:when>
        <xsl:otherwise><xsl:value-of select="//VALUESERVER/WEBSOCKET[1]/@url" /></xsl:otherwise>
      </xsl:choose>
    </xsl:variable>

    <xsl:variable name="isOn">
      <xsl:choose>
        <xsl:when test="@on='true' or @on='wahr' or @on='on' or @on='enable' or @on='show' or @on='1'">true</xsl:when>
        <xsl:otherwise>false</xsl:otherwise>
      </xsl:choose>
    </xsl:variable>

    <a-entity geometry="primitive: box; width: {$w}; height: {$h}; depth: {$d}" class="clickable">
      <xsl:call-template name="hover-outline-rect">
        <xsl:with-param name="w" select="$w"/>
        <xsl:with-param name="h" select="$h"/>
      </xsl:call-template>
      <xsl:attribute name="fdar-switch">transmitKey: <xsl:value-of select="$transmitKey"/>; url: <xsl:value-of select="$wsUrl"/>; on: <xsl:value-of select="$isOn"/>;<xsl:if test="@onvalue != ''"> onvalue: <xsl:value-of select="@onvalue"/>;</xsl:if><xsl:if test="@offvalue != ''"> offvalue: <xsl:value-of select="@offvalue"/>;</xsl:if><xsl:if test="@pressedvalue != ''"> pressedvalue: <xsl:value-of select="@pressedvalue"/>;</xsl:if><xsl:if test="@unpressedvalue != ''"> unpressedvalue: <xsl:value-of select="@unpressedvalue"/>;</xsl:if></xsl:attribute>
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
        <xsl:attribute name="class">clickable</xsl:attribute>
        <xsl:attribute name="hover-outline">type: circle</xsl:attribute>
        <xsl:attribute name="navigate-on-click">url: <xsl:value-of select="$linkUrl"/></xsl:attribute>
      </xsl:if>

      <xsl:choose>
        <xsl:when test="@file = 'planexy' or @file = 'fdar_white'">
          <xsl:attribute name="geometry">primitive: plane; width: 1; height: 1</xsl:attribute>
          <xsl:attribute name="rotation">-90 0 0</xsl:attribute>
          <xsl:variable name="matSrc">
            <xsl:choose>
              <xsl:when test="@texture"><xsl:value-of select="concat('src: url(', @texture, '); transparent: true; side: double; shader: flat')"/></xsl:when>
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
              <xsl:attribute name="material">src: url(<xsl:value-of select="@texture"/>)</xsl:attribute>
            </xsl:when>
          </xsl:choose>
        </xsl:when>

        <xsl:when test="contains(@file, '.glb') or contains(@file, '.gltf') or @filetype='glb' or @filetype='gltf'">
          <xsl:attribute name="gltf-model"><xsl:value-of select="@file"/></xsl:attribute>
          <xsl:variable name="clip"><xsl:choose><xsl:when test="@clip"><xsl:value-of select="@clip"/></xsl:when><xsl:otherwise>*</xsl:otherwise></xsl:choose></xsl:variable>
          <xsl:variable name="loop"><xsl:choose><xsl:when test="@playmode = 'loop'">repeat</xsl:when><xsl:when test="@playmode = 'pingpong'">pingpong</xsl:when><xsl:when test="@play = 'true'">repeat</xsl:when><xsl:otherwise>repeat</xsl:otherwise></xsl:choose></xsl:variable>
          <xsl:attribute name="animation-mixer">clip: <xsl:value-of select="$clip"/>; loop: <xsl:value-of select="$loop"/>;</xsl:attribute>
        </xsl:when>
        
        <xsl:otherwise>
          <xsl:attribute name="obj-model">
            <xsl:text>obj: url(</xsl:text><xsl:value-of select="@file"/><xsl:text>)</xsl:text>
          </xsl:attribute>

          <xsl:choose>
            <xsl:when test="@texture and @alpha">
              <xsl:attribute name="material">src: url(<xsl:value-of select="@texture"/>); opacity: <xsl:value-of select="number(@alpha) div 100"/>; transparent: true</xsl:attribute>
            </xsl:when>
            <xsl:when test="@texture">
              <xsl:attribute name="material">src: url(<xsl:value-of select="@texture"/>)</xsl:attribute>
            </xsl:when>
            <xsl:when test="@alpha">
              <xsl:attribute name="material">opacity: <xsl:value-of select="number(@alpha) div 100"/>; transparent: true</xsl:attribute>
            </xsl:when>
          </xsl:choose>
          
          <xsl:attribute name="scale">1 1 1</xsl:attribute>
        </xsl:otherwise>
      </xsl:choose>
      <xsl:text> </xsl:text>
    </a-entity>
  </xsl:template>

  <xsl:template match="VIEWER">
    <xsl:variable name="picUrl">
      <xsl:call-template name="localized-value">
        <xsl:with-param name="direct" select="@picture"/>
        <xsl:with-param name="container" select="METADATA/picture"/>
        <xsl:with-param name="fallbackLang" select="METADATA/@fallback"/>
      </xsl:call-template>
    </xsl:variable>
    <xsl:variable name="picW"><xsl:choose><xsl:when test="@w"><xsl:value-of select="@w"/></xsl:when><xsl:otherwise>1</xsl:otherwise></xsl:choose></xsl:variable>
    <xsl:variable name="picH"><xsl:choose><xsl:when test="@h"><xsl:value-of select="@h"/></xsl:when><xsl:otherwise>1</xsl:otherwise></xsl:choose></xsl:variable>

    <a-image src="{$picUrl}" side="double" crossorigin="anonymous">
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
        <xsl:otherwise><xsl:attribute name="scale">1 1 1</xsl:attribute></xsl:otherwise>
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
      <a-video src="#vid-{generate-id()}" width="{$vWidth}" height="{$vHeight}" class="clickable" crossorigin="anonymous" video-controller="">
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

  <!-- [FIX #8] TEXT+LINK: a-plane hitbox separated from a-text for reliable click -->
  <xsl:template match="TEXT | COUNTER | VUMETER">
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

    <xsl:variable name="wsUrl" select="//VALUESERVER/WEBSOCKET[1]/@url" />

    <xsl:variable name="textScale"><xsl:choose>
      <xsl:when test="ancestor::TARGET or ancestor::IMGTARGET">0.75 0.75 0.75</xsl:when>
      <xsl:otherwise>50 50 50</xsl:otherwise>
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
        <a-entity scale="{$textScale}">
          <a-plane class="clickable" material="color: #0088ff; opacity: 0.15; transparent: true; side: double; depthWrite: false; depthTest: false" position="0 0 0.05">
            <xsl:attribute name="width"><xsl:value-of select="2 + number($lw)"/></xsl:attribute>
            <xsl:attribute name="height"><xsl:value-of select="1 + number($lh)"/></xsl:attribute>
            <xsl:call-template name="hover-outline-rect">
              <xsl:with-param name="w" select="2 + number($lw)"/>
              <xsl:with-param name="h" select="1 + number($lh)"/>
            </xsl:call-template>
            <xsl:attribute name="navigate-on-click">url: <xsl:value-of select="$linkUrl"/></xsl:attribute>
            <xsl:text> </xsl:text>
          </a-plane>
          <a-text align="center" baseline="center" anchor="center" color="white" outlineColor="black" outlineWidth="0.1" side="double">
            <xsl:call-template name="text-display-attrs">
              <xsl:with-param name="txtVal" select="$txtVal"/>
              <xsl:with-param name="wsUrl" select="$wsUrl"/>
            </xsl:call-template>
            <xsl:text> </xsl:text>
          </a-text>
        </a-entity>
      </xsl:when>
      <xsl:otherwise>
        <a-text align="center" color="white" outlineColor="black" outlineWidth="0.1" side="double">
          <xsl:call-template name="text-display-attrs">
            <xsl:with-param name="txtVal" select="$txtVal"/>
            <xsl:with-param name="wsUrl" select="$wsUrl"/>
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
    
    <xsl:variable name="wsUrl" select="//VALUESERVER/WEBSOCKET[1]/@url" />
    
    <xsl:variable name="isOn">
      <xsl:choose>
        <xsl:when test="@status='true' or @status='wahr' or @status='on' or @status='enable' or @status='show' or @status='1'">true</xsl:when>
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
      <xsl:attribute name="ws-signal">color: <xsl:value-of select="$hexColor"/>; key: <xsl:value-of select="$wsKey"/>; url: <xsl:value-of select="$wsUrl"/>; on: <xsl:value-of select="$isOn"/>;</xsl:attribute>
    </a-sphere>
  </xsl:template>

  <!-- ============================================================ -->
  <!-- COMPILATION: a catalog of AUGMENTATION scenes                -->
  <!-- Renders a menu page. Entry links point at the pre-generated  -->
  <!-- <entry>.html (xsltproc workflow); when that file is missing  -->
  <!-- the entry XML is transformed in the browser with the native  -->
  <!-- XSLTProcessor as a fallback.                                 -->
  <!-- ============================================================ -->
  <xsl:template match="/COMPILATION">
    <xsl:text disable-output-escaping="yes">&lt;!DOCTYPE html&gt;&#10;</xsl:text>
    <html>
      <head>
        <meta charset="utf-8" />
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
              <xsl:with-param name="direct" select="''"/>
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
              <li><a class="entry" href="{$base}.html" data-xml="{@url}">
                <xsl:value-of select="$base"/>
                <small><xsl:value-of select="@url"/></small>
              </a></li>
            </xsl:for-each>
          </ul>
        </main>
        <script><xsl:text disable-output-escaping="yes">
      // Prefer the pre-generated .html; fall back to transforming the .xml
      // in the browser (native XSLTProcessor ignores d-o-e, so script/style
      // bodies are unescaped and self-closing tags expanded afterwards).
      document.addEventListener('click', function (e) {
        var a = e.target.closest ? e.target.closest('a.entry') : null;
        if (!a) return;
        e.preventDefault();
        var href = a.getAttribute('href');
        fetch(href, { method: 'HEAD' }).then(function (r) {
          if (r.ok) { window.location.href = href; return; }
          transformAndOpen(a.getAttribute('data-xml'));
        }).catch(function () { transformAndOpen(a.getAttribute('data-xml')); });
      });
      function fetchText(url) {
        return fetch(url).then(function (r) {
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

  <!-- Fill for clickable boxes: rgba/rgb color if given, otherwise invisible -->
  <xsl:template name="clickable-fill">
    <xsl:choose>
      <xsl:when test="@rgba or @rgb">
        <xsl:attribute name="fdar-color">rgba: <xsl:choose><xsl:when test="@rgba"><xsl:value-of select="@rgba"/></xsl:when><xsl:otherwise><xsl:value-of select="@rgb"/></xsl:otherwise></xsl:choose></xsl:attribute>
      </xsl:when>
      <xsl:otherwise>
        <xsl:attribute name="material">opacity: 0; transparent: true; depthWrite: false</xsl:attribute>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <!-- Attributes common to every a-text: width, colors, optional scale and the
       static value or its @anim: websocket binding -->
  <xsl:template name="text-display-attrs">
    <xsl:param name="txtVal"/>
    <xsl:param name="wsUrl"/>
    <xsl:param name="scale" select="''"/>
    <xsl:if test="@width and @width != '0'"><xsl:attribute name="width"><xsl:value-of select="@width"/></xsl:attribute></xsl:if>
    <xsl:if test="@rgba or @backrgba">
      <xsl:attribute name="fdar-color"><xsl:if test="@rgba">rgba: <xsl:value-of select="@rgba"/>; </xsl:if><xsl:if test="@backrgba">backrgba: <xsl:value-of select="@backrgba"/>; </xsl:if></xsl:attribute>
    </xsl:if>
    <xsl:if test="$scale != ''"><xsl:attribute name="scale"><xsl:value-of select="$scale"/></xsl:attribute></xsl:if>
    <xsl:choose>
      <xsl:when test="starts-with($txtVal, '@anim:')">
        <xsl:attribute name="ws-value-updater">key: <xsl:value-of select="substring-after($txtVal, '@anim:')"/>; url: <xsl:value-of select="$wsUrl"/></xsl:attribute>
        <xsl:attribute name="value">---</xsl:attribute>
      </xsl:when>
      <xsl:otherwise><xsl:attribute name="value"><xsl:value-of select="$txtVal"/></xsl:attribute></xsl:otherwise>
    </xsl:choose>
  </xsl:template>
</xsl:stylesheet>