/* ==========================================================================
   Velora — particle helix (WebGL)
   Original implementation. Draws a soft, pointer-reactive double helix made
   of tens of thousands of particles. All motion is computed on the GPU in the
   vertex shader; the CPU only updates a handful of uniforms per frame.
   Pauses off-screen, respects prefers-reduced-motion, and falls back to a
   static CSS backdrop when WebGL is unavailable.
   ========================================================================== */
(() => {
  'use strict';

  const VERT = `
    attribute vec4 aData;   // x: t along axis, y: kind (0 strand A, 1 strand B, 2 rung, 3 dust), z: rung lerp, w: seed
    attribute vec3 aOffset; // gaussian scatter
    uniform vec2  uRes;
    uniform float uTime;
    uniform float uTurns;
    uniform float uRadius;
    uniform float uSize;
    uniform float uDpr;
    uniform vec2  uMouse;
    uniform float uMouseForce;
    uniform vec2  uP0; uniform vec2 uP1; uniform vec2 uP2; uniform vec2 uP3;
    varying float vAlpha;
    varying float vTone;

    vec2 bez(float t) {
      float u = 1.0 - t;
      return u*u*u*uP0 + 3.0*u*u*t*uP1 + 3.0*u*t*t*uP2 + t*t*t*uP3;
    }
    vec2 bezD(float t) {
      float u = 1.0 - t;
      return 3.0*u*u*(uP1-uP0) + 6.0*u*t*(uP2-uP1) + 3.0*t*t*(uP3-uP2);
    }

    void main() {
      float t = aData.x;
      float kind = aData.y;
      float seed = aData.w;

      vec2 axis = bez(t) * uRes;                 // pixels, y down
      vec2 tang = normalize(bezD(t) * uRes);
      vec2 nrm = vec2(-tang.y, tang.x);

      float theta = t * uTurns * 6.2831853 + uTime * 0.35;
      if (kind < 1.5) theta += aData.z;          // ribbon width around the strand
      float R = uRadius;

      vec3 a = vec3(axis + nrm * cos(theta) * R, sin(theta) * R);
      vec3 b = vec3(axis - nrm * cos(theta) * R, -sin(theta) * R);

      vec3 p;
      if (kind < 0.5) p = a;
      else if (kind < 1.5) p = b;
      else p = mix(a, b, aData.z);

      // breathing scatter + slow drift
      float wob = sin(uTime * 0.6 + seed * 40.0) * 0.18 + 1.0;
      p += aOffset * R * wob;
      p.y += sin(uTime * 0.25 + t * 9.0) * R * 0.08;

      // perspective
      float focal = R * 7.0;
      float persp = focal / (focal - p.z);
      vec2 center = uRes * 0.5;
      vec2 screen = center + (p.xy - center) * persp;

      // pointer repulsion
      vec2 d = screen - uMouse;
      float dist = length(d);
      float infl = exp(-(dist * dist) / (R * R * 3.2));
      screen += (dist > 0.001 ? d / dist : vec2(0.0)) * infl * uMouseForce * R * 0.9;

      vec2 clip = (screen / uRes) * 2.0 - 1.0;
      gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);

      float depth = clamp(p.z / R * 0.5 + 0.5, 0.0, 1.0);
      gl_PointSize = uSize * uDpr * persp * (0.6 + seed * 1.1) * (kind > 2.5 ? 0.75 : 1.0);
      vAlpha = (kind > 2.5 ? 0.45 : 1.0) * (0.5 + depth * 0.5) * (1.0 - infl * 0.35);
      vTone = clamp(seed * seed * 0.9 + (1.0 - depth) * 0.35 - 0.1, 0.0, 1.0);
    }
  `;

  const FRAG = `
    precision mediump float;
    uniform vec3 uColorA;
    uniform vec3 uColorB;
    varying float vAlpha;
    varying float vTone;
    void main() {
      vec2 c = gl_PointCoord - 0.5;
      float r = dot(c, c);
      if (r > 0.25) discard;
      float soft = smoothstep(0.25, 0.0, r);
      gl_FragColor = vec4(mix(uColorA, uColorB, vTone), vAlpha * soft);
    }
  `;

  const hexToRgb = (hex) => {
    const n = parseInt(String(hex || '#000').replace('#', '').slice(0, 6), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  };
  const gauss = () => {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  // Axis curves in normalized viewport coords (x right, y down)
  const PATHS = {
    right: [[0.80, -0.12], [1.08, 0.48], [0.50, 0.52], [0.40, 1.12]],
    center: [[0.62, -0.12], [0.95, 0.40], [0.15, 0.62], [0.42, 1.12]],
    diagonal: [[1.08, -0.05], [0.75, 0.30], [0.55, 0.70], [0.20, 1.10]]
  };

  class ParticleHelix extends HTMLElement {
    connectedCallback() {
      this.canvas = this.querySelector('canvas');
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const gl = this.canvas && (this.canvas.getContext('webgl', { antialias: false, alpha: true, premultipliedAlpha: false }) || this.canvas.getContext('experimental-webgl'));
      if (!gl) { this.classList.add('is-fallback'); return; }
      this.gl = gl;
      this.reduce = reduce;
      this.small = window.matchMedia('(max-width: 749px)').matches;
      this.coarse = window.matchMedia('(pointer: coarse)').matches;

      const density = parseFloat(this.dataset.density || '1');
      this.count = Math.round((this.small ? 14000 : 34000) * density);
      this.turns = parseFloat(this.dataset.turns || '2.2');
      this.speed = parseFloat(this.dataset.speed || '1');
      this.force = this.coarse ? 0 : parseFloat(this.dataset.force || '1');
      this.size = parseFloat(this.dataset.size || '2.2');
      this.path = PATHS[this.dataset.path] || PATHS.right;
      if (this.small) this.path = [[0.95, -0.08], [1.1, 0.35], [0.35, 0.45], [0.55, 1.1]];
      this.colorA = hexToRgb(this.dataset.colorA || '#1F5A45');
      this.colorB = hexToRgb(this.dataset.colorB || '#C9E265');

      if (!this.build()) { this.classList.add('is-fallback'); return; }

      this.mouse = { x: -9999, y: -9999, tx: -9999, ty: -9999 };
      this.time = Math.random() * 20;
      this.last = performance.now();
      this.visible = true;

      this.onResize = () => this.resize();
      window.addEventListener('resize', this.onResize, { passive: true });
      this.resize();

      if (this.force > 0) {
        const host = this.closest('section') || this;
        host.addEventListener('pointermove', (e) => {
          const r = this.canvas.getBoundingClientRect();
          this.mouse.tx = e.clientX - r.left;
          this.mouse.ty = e.clientY - r.top;
        }, { passive: true });
        host.addEventListener('pointerleave', () => { this.mouse.tx = -9999; this.mouse.ty = -9999; });
      }

      if ('IntersectionObserver' in window) {
        this.io = new IntersectionObserver(([entry]) => {
          this.visible = entry.isIntersecting;
          if (this.visible && !this.raf && !this.reduce) this.loop();
        });
        this.io.observe(this);
      }

      this.classList.add('is-ready');
      if (reduce) this.draw(0); else this.loop();
    }

    disconnectedCallback() {
      cancelAnimationFrame(this.raf);
      if (this.io) this.io.disconnect();
      window.removeEventListener('resize', this.onResize);
    }

    build() {
      const gl = this.gl;
      const compile = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
      };
      const vs = compile(gl.VERTEX_SHADER, VERT);
      const fs = compile(gl.FRAGMENT_SHADER, FRAG);
      if (!vs || !fs) return false;
      const prog = gl.createProgram();
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
      gl.useProgram(prog);
      this.prog = prog;

      const n = this.count;
      const data = new Float32Array(n * 4);
      const offs = new Float32Array(n * 3);
      const rungs = 26;
      for (let i = 0; i < n; i++) {
        const r = Math.random();
        let kind, t, lerp = 0;
        if (r < 0.40) { kind = 0; t = Math.random(); }
        else if (r < 0.80) { kind = 1; t = Math.random(); }
        else if (r < 0.92) {
          kind = 2;
          t = (Math.floor(Math.random() * rungs) + 0.5) / rungs + gauss() * 0.002;
          lerp = Math.random();
        } else { kind = 3; t = Math.random(); }
        // Most particles hug the strand; a long tail drifts outward like dust
        let spread;
        if (kind < 1.5) { lerp = (Math.random() - 0.5) * 0.5; spread = 0.035 + Math.pow(Math.random(), 4) * 0.35; }
        else if (kind < 2.5) spread = 0.025 + Math.pow(Math.random(), 4) * 0.08;
        else spread = 0.25 + Math.random() * 0.6;
        data.set([t * 1.1 - 0.05, kind, lerp, Math.random()], i * 4);
        offs.set([gauss() * spread, gauss() * spread, gauss() * spread], i * 3);
      }
      const bind = (arr, name, size) => {
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(prog, name);
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
      };
      bind(data, 'aData', 4);
      bind(offs, 'aOffset', 3);

      this.u = {};
      ['uRes', 'uTime', 'uTurns', 'uRadius', 'uSize', 'uDpr', 'uMouse', 'uMouseForce', 'uP0', 'uP1', 'uP2', 'uP3', 'uColorA', 'uColorB']
        .forEach((k) => { this.u[k] = gl.getUniformLocation(prog, k); });

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.clearColor(0, 0, 0, 0);
      return true;
    }

    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = this.canvas.clientWidth;
      const h = this.canvas.clientHeight;
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
      this.dpr = dpr;
      this.w = w;
      this.h = h;
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      if (this.reduce) this.draw(0);
    }

    draw(dt) {
      const gl = this.gl;
      const u = this.u;
      this.time += dt * this.speed;
      const m = this.mouse;
      m.x += (m.tx - m.x) * 0.08;
      m.y += (m.ty - m.y) * 0.08;
      if (m.tx < -9000) { m.x = m.tx; m.y = m.ty; }

      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(u.uRes, this.w, this.h);
      gl.uniform1f(u.uTime, this.time);
      gl.uniform1f(u.uTurns, this.turns);
      gl.uniform1f(u.uRadius, Math.min(this.w, this.h) * (this.small ? 0.24 : 0.24));
      gl.uniform1f(u.uSize, this.size);
      gl.uniform1f(u.uDpr, this.dpr);
      gl.uniform2f(u.uMouse, m.x, m.y);
      gl.uniform1f(u.uMouseForce, this.force);
      gl.uniform2fv(u.uP0, this.path[0]);
      gl.uniform2fv(u.uP1, this.path[1]);
      gl.uniform2fv(u.uP2, this.path[2]);
      gl.uniform2fv(u.uP3, this.path[3]);
      gl.uniform3fv(u.uColorA, this.colorA);
      gl.uniform3fv(u.uColorB, this.colorB);
      gl.drawArrays(gl.POINTS, 0, this.count);
    }

    loop() {
      this.raf = requestAnimationFrame((now) => {
        const dt = Math.min(0.05, (now - this.last) / 1000);
        this.last = now;
        this.draw(dt);
        if (this.visible && !document.hidden) this.loop();
        else this.raf = null;
      });
    }
  }

  if (!customElements.get('particle-helix')) customElements.define('particle-helix', ParticleHelix);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) document.querySelectorAll('particle-helix.is-ready').forEach((el) => {
      if (!el.raf && el.visible && !el.reduce) { el.last = performance.now(); el.loop(); }
    });
  });
})();
