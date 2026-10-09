/* ==========================================================================
   Little Linden hero lab — shared runtime
   - WebGL renderer bootstrap (DPR cap, ACES tone mapping, sRGB)
   - smoothed pointer (mouse / touch / idle auto-drift on touch devices)
   - render loop that pauses off-screen / in background tabs
   - GSAP intro: blur reveal of copy + canvas
   - foil product card: 3D tilt + spotlight + warm foil
   - pointer / scroll parallax on [data-depth]
   - animated line icons (stroke draw) + neutral counters (GSAP)
   - prefers-reduced-motion + no-WebGL fallbacks
   - full cleanup on pagehide: rAF, listeners, geometries, materials, textures, renderer
   ========================================================================== */
import * as THREE from 'three';
import gsap from 'gsap';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { DEMOS } from './demos.js';

export { THREE, gsap };

export const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const coarsePointer = window.matchMedia('(hover: none), (pointer: coarse)').matches;
export const isSmall = () => window.innerWidth < 768;

export function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (_) { return false; }
}

export function createRenderer(canvas, { alpha = true, shadows = false, toneMapping = true } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isSmall(), alpha, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSmall() ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  if (toneMapping) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
  }
  if (shadows) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }
  return renderer;
}

/* ---------- Pointer ---------- */
export class Pointer {
  constructor(target, signal) {
    this.target = target;
    this.x = 0; this.y = 0;      // smoothed, -1..1 (y up)
    this.tx = 0; this.ty = 0;    // raw target
    this.px = 0; this.py = 0;    // pixels inside target
    this.active = false;
    this.lastMove = 0;
    const move = (e) => {
      const r = target.getBoundingClientRect();
      this.px = e.clientX - r.left;
      this.py = e.clientY - r.top;
      this.tx = (this.px / r.width) * 2 - 1;
      this.ty = -((this.py / r.height) * 2 - 1);
      this.active = true;
      this.lastMove = performance.now();
    };
    target.addEventListener('pointermove', move, { passive: true, signal });
    target.addEventListener('pointerdown', move, { passive: true, signal });
    target.addEventListener('pointerleave', () => { this.active = false; }, { signal });
  }
  update(t, ease = 0.06) {
    // On touch devices (or when idle) drift gently so tilt/parallax still read.
    if (!this.active && (coarsePointer || performance.now() - this.lastMove > 2500)) {
      this.tx = Math.sin(t * 0.35) * 0.45;
      this.ty = Math.cos(t * 0.27) * 0.3;
    }
    this.x += (this.tx - this.x) * ease;
    this.y += (this.ty - this.y) * ease;
  }
  /** Pointer position in pixels from the smoothed value. */
  pixels(width, height) {
    return [(this.x * 0.5 + 0.5) * width, (1 - (this.y * 0.5 + 0.5)) * height];
  }
}

/* ---------- Foil card: tilt + spotlight ---------- */
function bindFoilCard(card, pointer, signal) {
  if (!card) return () => {};
  // Tween plain numbers and write the CSS custom properties ourselves (with units).
  const tilt = { rx: 0, ry: 0 };
  const apply = () => {
    card.style.setProperty('--rx', tilt.rx.toFixed(2) + 'deg');
    card.style.setProperty('--ry', tilt.ry.toFixed(2) + 'deg');
  };
  const rx = gsap.quickTo(tilt, 'rx', { duration: 0.8, ease: 'power3.out', onUpdate: apply });
  const ry = gsap.quickTo(tilt, 'ry', { duration: 0.8, ease: 'power3.out', onUpdate: apply });
  let hovering = false;
  card.addEventListener('pointerenter', () => { hovering = true; }, { signal });
  card.addEventListener('pointerleave', () => { hovering = false; }, { signal });
  card.addEventListener('pointermove', (e) => {
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    card.style.setProperty('--px', (x * 100).toFixed(1) + '%');
    card.style.setProperty('--py', (y * 100).toFixed(1) + '%');
    rx((0.5 - y) * 14);
    ry((x - 0.5) * 18);
  }, { signal });
  if (coarsePointer) card.style.setProperty('--spot', '0.7');
  // When not hovered, the card follows the global pointer subtly.
  return () => {
    if (hovering) return;
    rx(pointer.y * 4);
    ry(pointer.x * 7);
    card.style.setProperty('--px', ((pointer.x * 0.5 + 0.5) * 100).toFixed(1) + '%');
    card.style.setProperty('--py', ((1 - (pointer.y * 0.5 + 0.5)) * 100).toFixed(1) + '%');
  };
}

/* ---------- Parallax ---------- */
function bindParallax(root, pointer) {
  const items = [...root.querySelectorAll('[data-depth]')].map((el) => ({
    depth: parseFloat(el.dataset.depth) || 0,
    x: gsap.quickTo(el, 'x', { duration: 1, ease: 'power3.out' }),
    y: gsap.quickTo(el, 'y', { duration: 1, ease: 'power3.out' })
  }));
  return (scroll) => {
    for (const it of items) {
      it.x(pointer.x * it.depth * 24);
      it.y(-pointer.y * it.depth * 16 - scroll * it.depth * 120);
    }
  };
}

/* ---------- Demo switcher (prototype-only UI) ---------- */
function mountDemoBar(slug) {
  const i = DEMOS.findIndex((d) => d.slug === slug);
  if (i < 0 || document.querySelector('.demo-bar')) return;
  const prev = DEMOS[(i - 1 + DEMOS.length) % DEMOS.length];
  const next = DEMOS[(i + 1) % DEMOS.length];
  const bar = document.createElement('nav');
  bar.className = 'demo-bar';
  bar.setAttribute('aria-label', 'Demo switcher');
  bar.innerHTML = `
    <a href="../${prev.slug}/" aria-label="Previous demo: ${prev.name}">←</a>
    <a href="../../index.html" aria-label="All demos (gallery)">☰</a>
    <span class="demo-bar__label"><b>${String(i + 1).padStart(2, '0')}</b> ${DEMOS[i].name}</span>
    <a href="../${next.slug}/" aria-label="Next demo: ${next.name}">→</a>`;
  document.body.appendChild(bar);
}

/* ---------- Boot ---------- */
/**
 * @param {object} opts
 * @param {string} opts.slug     demo slug (for the switcher bar)
 * @param {function} opts.setup  ({ renderer, canvas, hero, pointer, width, height }) => scene controller
 *   controller: { render(t, dt, state), resize(w, h), intro?(timeline) }
 * @param {object} [opts.renderer] options for createRenderer
 */
export function boot({ slug, setup, renderer: rendererOpts = {} }) {
  document.documentElement.classList.add('js');
  // Advance animations by real time even on slow devices, so the headline/CTA
  // reveal always finishes on schedule instead of being stretched by lag smoothing.
  gsap.ticker.lagSmoothing(0);
  const hero = document.querySelector('.ll-hero');
  const canvas = hero.querySelector('.ll-hero__canvas');
  const ac = new AbortController();               // removes every listener on cleanup
  const signal = ac.signal;
  const pointer = new Pointer(hero, signal);
  const cardUpdaters = [...hero.querySelectorAll('.foil-card')].map((c) => bindFoilCard(c, pointer, signal));
  const updateCard = () => cardUpdaters.forEach((u) => u());
  const updateParallax = bindParallax(hero, pointer);
  if (hero.dataset.demo) mountDemoBar(slug);   // prototype switcher only on demo pages

  const reveal = [...hero.querySelectorAll('[data-reveal]')];
  const drawPaths = [...hero.querySelectorAll('[data-draw] path, [data-draw] circle, [data-draw] rect')];
  const counters = [...hero.querySelectorAll('[data-count-to]')];
  const intro = gsap.timeline({ defaults: { ease: 'expo.out' } });

  let controller = null;
  let renderer = null;

  if (hasWebGL()) {
    try {
      renderer = createRenderer(canvas, rendererOpts);
      const { width, height } = hero.getBoundingClientRect();
      renderer.setSize(width, height, false);
      controller = setup({ renderer, canvas, hero, pointer, width, height, small: isSmall(), reduced: reducedMotion, signal });
    } catch (err) {
      console.error('[hero] WebGL scene failed, using fallback', err);
      controller = null;
    }
  }
  if (!controller) hero.classList.add('no-webgl');

  // Intro: canvas focus-pull + staggered blur reveal of copy
  if (reducedMotion) {
    gsap.set(reveal, { opacity: 1 });
    counters.forEach((el) => { el.textContent = el.dataset.countTo; });
  } else {
    // Line icons draw themselves in; neutral counters count up (never fabricated stats)
    drawPaths.forEach((p) => {
      let len = 100;
      try { len = p.getTotalLength() || 100; } catch (_) { /* hidden (display:none) icons have no length */ }
      gsap.set(p, { strokeDasharray: len, strokeDashoffset: len });
    });
    intro.to(drawPaths, { strokeDashoffset: 0, duration: 1.6, stagger: 0.04, ease: 'power2.inOut' }, 0.9);
    counters.forEach((el) => {
      const o = { v: 0 };
      intro.to(o, { v: parseFloat(el.dataset.countTo) || 0, duration: 1.6, ease: 'power2.out', onUpdate: () => { el.textContent = Math.round(o.v); } }, 1.0);
    });
    if (controller) intro.fromTo(canvas, { opacity: 0, filter: 'blur(24px)', scale: 1.06 }, { opacity: 1, filter: 'blur(0px)', scale: 1, duration: 2.2, clearProps: 'filter,transform' }, 0);
    intro.fromTo(reveal,
      { opacity: 0, y: 34, filter: 'blur(14px)' },
      { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.4, stagger: 0.09, clearProps: 'filter' }, 0.35);
    if (controller && controller.intro) controller.intro(intro);
  }

  if (!controller) return;

  // Resize
  const resize = () => {
    const { width, height } = hero.getBoundingClientRect();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSmall() ? 1.5 : 2));
    renderer.setSize(width, height, false);
    controller.resize && controller.resize(width, height);
    if (reducedMotion) controller.render(0, 0, { scroll: 0 });
  };
  window.addEventListener('resize', resize, { passive: true, signal });

  // Loop (paused when hero off-screen or tab hidden)
  let visible = true;
  let raf = 0;
  let last = performance.now();
  let t = 0;
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;
    pointer.update(t);
    const rect = hero.getBoundingClientRect();
    const scroll = Math.min(1, Math.max(0, -rect.top / rect.height));
    updateCard();
    updateParallax(scroll);
    controller.render(t, dt, { scroll });
    raf = visible && !document.hidden ? requestAnimationFrame(frame) : 0;
  };
  const start = () => { if (!raf && !reducedMotion) { last = performance.now(); raf = requestAnimationFrame(frame); } };

  let io = null;
  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); });
    io.observe(hero);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); }, { signal });

  // Cleanup: stop the loop, drop listeners and free every GPU resource
  const destroy = () => {
    cancelAnimationFrame(raf);
    raf = 0;
    visible = false;
    ac.abort();
    if (io) io.disconnect();
    intro.kill();
    if (controller.dispose) controller.dispose();
    if (controller.scene) disposeScene(controller.scene);
    renderer.dispose();
    window.__hero = null;
  };
  window.addEventListener('pagehide', destroy, { once: true });

  if (reducedMotion) controller.render(1.5, 0, { scroll: 0 });
  else start();

  // Expose for debugging / automated checks
  window.__hero = { renderer, controller, pointer, destroy };
}

/** Dispose geometries, materials and textures of a scene graph. */
export function disposeScene(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    mats.forEach((m) => {
      Object.values(m).forEach((v) => { if (v && v.isTexture) v.dispose(); });
      if (m.uniforms) Object.values(m.uniforms).forEach((u) => { if (u && u.value && u.value.isTexture) u.value.dispose(); });
      m.dispose();
    });
  });
  if (root.environment) root.environment.dispose();
}

/* ---------- Small helpers shared by demos ---------- */
/** Image-based lighting so metals (brass) and glazes get believable reflections. */
export function addEnvironment(renderer, scene, intensity = 0.6) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const env = pmrem.fromScene(room, 0.04).texture;
  room.dispose();                                  // free the temporary room geometry
  scene.environment = env;
  if ('environmentIntensity' in scene) scene.environmentIntensity = intensity;
  pmrem.dispose();
  return env;
}

export const PALETTE = {
  ivory: new THREE.Color('#FAF7F2'),
  cream: new THREE.Color('#F1E8DC'),
  sage: new THREE.Color('#A9B5A0'),
  rose: new THREE.Color('#D9B2AE'),
  taupe: new THREE.Color('#B7A99A'),
  charcoal: new THREE.Color('#282826')
};

/** Simplex-style 3D noise (Ashima / Stefan Gustavson, MIT) for GLSL shaders. */
export const GLSL_NOISE = /* glsl */`
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

/** Full-screen triangle for background shaders. */
export function fullscreenQuad(material) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  return mesh;
}

/** Camera framing helper: pulls the camera back on portrait screens so the product stays in frame. */
export function frameCamera(camera, width, height, { desktopZ = 7, mobileZ = 10, desktopX = 0, mobileX = 0 } = {}) {
  camera.aspect = width / height;
  const portrait = width / height < 0.9;
  camera.position.z = portrait ? mobileZ : desktopZ;
  camera.userData.offsetX = portrait ? mobileX : desktopX;
  camera.updateProjectionMatrix();
  return portrait;
}
