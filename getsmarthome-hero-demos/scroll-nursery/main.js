// Scroll-driven 3D room tour — "Nursery" (prototype)
// ---------------------------------------------------------------------------
// How it works
// - The page is a normal long document: one full-height <section data-stop> per
//   stop. The WebGL canvas is a fixed, decorative backdrop (aria-hidden).
// - Scroll position is mapped to a "stop space" value f (0 … N-1) from the real
//   section offsets, eased so the camera holds still while a card is read and
//   moves between stops. A Catmull-Rom curve runs through the camera positions
//   and another through the look-at targets; f picks the point on both.
// - GSAP ScrollTrigger handles the blur-to-clear card reveals, the snap to
//   stops (mouse/trackpad only) and refresh on layout changes.
// - The featured corner of each stop gets a soft additive glow, weighted by how
//   close the camera is to that stop.
// - Reduced motion: no camera travel — the view cuts to the active stop, no
//   ambient animation, no card blur. No WebGL: the copy reads as a plain page.
// - Everything is procedural (no model files). Replace with GLB product models
//   for production.
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createRenderer, hasWebGL, reducedMotion, coarsePointer, isSmall, addEnvironment } from '../shared/core.js';
import { makeLamp, materials } from '../shared/products.js';

gsap.registerPlugin(ScrollTrigger);
gsap.ticker.lagSmoothing(0);
document.documentElement.classList.add('js');

const H = 3;           // room height
const BACK = -3.5;     // back wall inner face (z)
const LEFT = -4;       // left wall inner face (x)
const RIGHT = 4;       // right wall inner face (x)
const WIN = { x: -1.4, y: 1.65, w: 1.5, h: 1.6 };

// Camera stops: position, look-at target, and which side the HTML card sits on
// (desktop) so the featured corner is framed on the opposite side.
const STOPS = [
  { pos: [0.5, 2.15, 7.4], look: [-0.1, 1.0, -1.2], side: 0 },    // intro: dollhouse view
  { pos: [1.0, 1.55, -0.35], look: [2.35, 1.15, -3.1], side: 1 },  // 01 lighting (dresser)
  { pos: [-0.2, 1.3, -0.55], look: [-1.35, 0.85, -3.1], side: -1 }, // 02 air (window corner)
  { pos: [-0.7, 1.45, 0.8], look: [-3.9, 1.3, 0.3], side: 1 },     // 03 storage (left wall)
  { pos: [0.15, 1.3, 3.1], look: [2.75, 0.7, 1.55], side: -1 },    // 04 reading nook
  { pos: [-0.3, 2.7, 6.3], look: [0.3, 0.55, -0.8], side: 0 }      // outro
];
const N = STOPS.length;

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------------------
// Canvas textures (procedural placeholders)
// ---------------------------------------------------------------------------
function canvasTex(w, h, draw, { repeat = null } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}

const rand = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();

const planks = () => canvasTex(1024, 1024, (g, w, h) => {
  const n = 8;
  for (let i = 0; i < n; i++) {
    const tone = 196 + rand() * 22;
    g.fillStyle = `rgb(${tone + 22}, ${tone - 4}, ${tone - 46})`;
    g.fillRect((i * w) / n, 0, w / n, h);
    for (let k = 0; k < 26; k++) {            // grain
      g.strokeStyle = `rgba(120, 80, 45, ${0.03 + rand() * 0.05})`;
      g.lineWidth = 1 + rand() * 2;
      const x = (i * w) / n + rand() * (w / n);
      g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 8, h * 0.3, x - 8, h * 0.7, x + 4, h); g.stroke();
    }
    const cut = rand() * h;                    // plank end joint
    g.fillStyle = 'rgba(90, 60, 35, .35)'; g.fillRect((i * w) / n, cut, w / n, 2);
    g.fillStyle = 'rgba(90, 60, 35, .45)'; g.fillRect((i * w) / n, 0, 2, h);
  }
}, { repeat: [2, 2] });

const rugTex = () => canvasTex(1024, 1024, (g, w) => {
  const c = w / 2;
  g.fillStyle = '#F1E4D2'; g.beginPath(); g.arc(c, c, c, 0, Math.PI * 2); g.fill();
  [['#D9A47F', 0.86, 0.8], ['#F1E4D2', 0.78, 0], ['#E7C9AE', 0.5, 0.42], ['#F6ECDF', 0.4, 0]].forEach(([col, r]) => {
    g.fillStyle = col; g.beginPath(); g.arc(c, c, c * r, 0, Math.PI * 2); g.fill();
  });
  g.fillStyle = '#C98F6B';                      // scallop dots
  for (let i = 0; i < 36; i++) { const a = (i / 36) * Math.PI * 2; g.beginPath(); g.arc(c + Math.cos(a) * c * 0.64, c + Math.sin(a) * c * 0.64, 12, 0, Math.PI * 2); g.fill(); }
  g.strokeStyle = 'rgba(120, 80, 50, .25)'; g.lineWidth = 3;
  for (let r = 0.1; r < 1; r += 0.035) { g.beginPath(); g.arc(c, c, c * r, 0, Math.PI * 2); g.stroke(); }
});

const skyTex = () => canvasTex(256, 512, (g, w, h) => {
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, '#F9E7CC'); grd.addColorStop(0.55, '#FFF6E8'); grd.addColorStop(1, '#F3D5B0');
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(169, 181, 160, .55)';     // distant tree line
  for (let i = 0; i < 14; i++) { g.beginPath(); g.arc((i / 13) * w, h * 0.8, 20 + rand() * 26, 0, Math.PI * 2); g.fill(); }
});

const artTex = (kind) => canvasTex(512, 640, (g, w, h) => {
  g.fillStyle = '#FBF5EC'; g.fillRect(0, 0, w, h);
  g.lineWidth = 10; g.lineCap = 'round';
  if (kind === 'moon') {
    g.fillStyle = '#E2B48F'; g.beginPath(); g.arc(w * 0.52, h * 0.45, 130, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#FBF5EC'; g.beginPath(); g.arc(w * 0.62, h * 0.4, 118, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#C9A46B'; [[0.25, 0.25], [0.78, 0.7], [0.3, 0.72]].forEach(([x, y]) => { g.beginPath(); g.arc(w * x, h * y, 8, 0, Math.PI * 2); g.fill(); });
  } else if (kind === 'arches') {
    ['#C98F6B', '#E2B48F', '#A9B5A0'].forEach((col, i) => {
      g.strokeStyle = col; g.lineWidth = 34;
      g.beginPath(); g.arc(w / 2, h * 0.72, 190 - i * 50, Math.PI, 0); g.stroke();
    });
  } else {
    g.fillStyle = '#A9B5A0'; g.beginPath(); g.ellipse(w * 0.35, h * 0.85, 300, 170, 0, Math.PI, 0); g.fill();
    g.fillStyle = '#C9B48F'; g.beginPath(); g.ellipse(w * 0.75, h * 0.9, 260, 150, 0, Math.PI, 0); g.fill();
    g.fillStyle = '#E2B48F'; g.beginPath(); g.arc(w * 0.62, h * 0.32, 70, 0, Math.PI * 2); g.fill();
  }
});

const wovenTex = (a = '#D8BC94', b = '#C4A276') => canvasTex(256, 128, (g, w, h) => {
  g.fillStyle = a; g.fillRect(0, 0, w, h);
  g.fillStyle = b;
  for (let y = 0; y < h; y += 16) for (let x = (y / 16) % 2 ? 0 : 16; x < w; x += 32) g.fillRect(x, y, 16, 16);
  g.fillStyle = 'rgba(80, 50, 30, .18)';
  for (let y = 0; y < h; y += 16) g.fillRect(0, y, w, 2);
}, { repeat: [4, 1] });

const grilleTex = () => canvasTex(128, 256, (g, w, h) => {
  g.fillStyle = '#F4EEE6'; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(80, 60, 45, .28)';
  for (let y = 40; y < h - 30; y += 9) g.fillRect(14, y, w - 28, 3);
});

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
const M = {
  wall: new THREE.MeshStandardMaterial({ color: '#EFE4D6', roughness: 0.95 }),
  arch: new THREE.MeshStandardMaterial({ color: '#E6CBB1', roughness: 0.95 }),
  trim: new THREE.MeshStandardMaterial({ color: '#F7F0E6', roughness: 0.6 }),
  paint: new THREE.MeshStandardMaterial({ color: '#F4ECE1', roughness: 0.5 }),
  drawer: new THREE.MeshStandardMaterial({ color: '#EEE3D5', roughness: 0.5 }),
  oak: new THREE.MeshStandardMaterial({ color: '#C79E74', roughness: 0.6 }),
  walnut: materials.walnut(),
  brass: materials.brass(),
  boucle: materials.fabric('#DCC7AC'),
  throw: materials.fabric('#EBDDCB'),
  pillow: materials.fabric('#C98F6B'),
  sage: materials.fabric('#A9B5A0'),
  leaf: new THREE.MeshStandardMaterial({ color: '#8E9C7E', roughness: 0.8, side: THREE.DoubleSide }),
  pot: materials.ceramic('#E6D3BF'),
  glow: new THREE.MeshStandardMaterial({ color: '#FFF1DC', emissive: '#FFD9A8', emissiveIntensity: 0.9, roughness: 0.6 })
};

const shadowed = (o) => { o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };
const rbox = (w, h, d, r, mat) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), mat);
const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };

function makeDresser() {
  const g = new THREE.Group();
  g.add(at(rbox(1.6, 0.92, 0.55, 0.04, M.paint), 0, 0.6, 0));
  g.add(at(rbox(1.66, 0.05, 0.6, 0.02, M.oak), 0, 1.08, 0.01));
  for (let i = 0; i < 3; i++) {
    const y = 0.32 + i * 0.28;
    g.add(at(rbox(1.48, 0.24, 0.04, 0.015, M.drawer), 0, y, 0.285));
    [-0.4, 0.4].forEach((x) => g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.025, 16, 12), M.brass), x, y, 0.315)));
  }
  [[-0.72, -0.22], [0.72, -0.22], [-0.72, 0.22], [0.72, 0.22]].forEach(([x, z]) => {
    g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.022, 0.16, 12), M.oak), x, 0.08, z));
  });
  return shadowed(g);
}

function makeCloudLight() {
  const g = new THREE.Group();
  [[0, 0, 0.5], [-0.42, -0.1, 0.36], [0.44, -0.08, 0.4], [0.15, 0.24, 0.38], [-0.2, 0.2, 0.3]].forEach(([x, y, r]) => {
    const s = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 20), M.glow);
    s.position.set(x, y, 0);
    s.scale.z = 0.7;
    g.add(s);
  });
  const light = new THREE.PointLight('#ffd29b', 1.2, 2.6, 2);
  light.position.set(0, 0, 0.6);
  g.add(light);
  g.userData.light = light;
  return g;
}

function makeFrame(tex, w, h) {
  const g = new THREE.Group();
  g.add(rbox(w + 0.08, h + 0.08, 0.04, 0.01, M.oak));
  g.add(at(new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 })), 0, 0, 0.022));
  return shadowed(g);
}

function makeHumidifier() {
  const g = new THREE.Group();
  const pts = [[0.001, 0], [0.15, 0], [0.165, 0.03], [0.17, 0.22], [0.15, 0.32], [0.08, 0.36], [0.05, 0.38], [0.001, 0.38]].map(([r, y]) => new THREE.Vector2(r, y));
  g.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 64), materials.glaze('#F7F2EA')));
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.168, 0.008, 8, 64), M.brass);
  band.rotation.x = Math.PI / 2; band.position.y = 0.08;
  g.add(band);
  shadowed(g);
  // Mist: soft rising particles (ShaderMaterial points)
  const COUNT = 70;
  const seeds = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) { seeds[i * 3] = rand(); seeds[i * 3 + 1] = rand(); seeds[i * 3 + 2] = rand(); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seeds, 3));
  const mist = new THREE.Points(geo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uPx: { value: Math.min(window.devicePixelRatio || 1, 2) } },
    vertexShader: /* glsl */`
      attribute vec3 seed; uniform float uTime, uPx; varying float vA;
      void main(){
        float k = fract(uTime * 0.16 + seed.x);
        vec3 p = vec3((seed.y - 0.5) * 0.06 + sin(k * 6.0 + seed.z * 6.28) * 0.07 * k, 0.4 + k * 0.75, (seed.z - 0.5) * 0.06 + cos(k * 5.0 + seed.y * 6.28) * 0.06 * k);
        vA = smoothstep(0.0, 0.15, k) * (1.0 - k);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = (40.0 + 90.0 * k) * uPx / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      varying float vA;
      void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(1.0, 0.98, 0.95), smoothstep(0.5, 0.0, d) * vA * 0.32); }`
  }));
  mist.frustumCulled = false;
  g.add(mist);
  g.userData.mist = mist;
  return g;
}

function makePurifier() {
  const g = new THREE.Group();
  const body = rbox(0.32, 0.58, 0.32, 0.06, new THREE.MeshStandardMaterial({ map: grilleTex(), roughness: 0.55 }));
  body.position.y = 0.29;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.012, 48), new THREE.MeshBasicMaterial({ color: '#ffd9a8' }));
  top.position.y = 0.585;
  g.add(body, top);
  return shadowed(g);
}

function makeSideTable() {
  const g = new THREE.Group();
  g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.04, 64), M.oak), 0, 0.62, 0));
  g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.6, 24), M.oak), 0, 0.31, 0));
  g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.03, 48), M.oak), 0, 0.015, 0));
  return shadowed(g);
}

function makePlant(scale = 1) {
  const g = new THREE.Group();
  const pts = [[0.001, 0], [0.16, 0], [0.2, 0.05], [0.22, 0.34], [0.2, 0.36]].map(([r, y]) => new THREE.Vector2(r, y));
  g.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 48), M.pot));
  const leafGeo = new THREE.SphereGeometry(0.5, 20, 12);
  leafGeo.scale(0.16, 0.55, 0.03);
  leafGeo.translate(0, 0.27, 0);
  for (let i = 0; i < 11; i++) {
    const l = new THREE.Mesh(leafGeo, M.leaf);
    l.position.y = 0.32;
    l.rotation.set(0.35 + rand() * 0.5, i * 2.4, (rand() - 0.5) * 0.5);
    l.scale.setScalar(0.8 + rand() * 0.6);
    g.add(l);
  }
  g.scale.setScalar(scale);
  return shadowed(g);
}

function makeCurtain(w, h) {
  const geo = new THREE.PlaneGeometry(w, h, 36, 1);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 26) * 0.035);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#F4E9DA', roughness: 0.95, side: THREE.DoubleSide }));
  m.castShadow = true;
  return m;
}

function makeBasket(r, h, tex) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, side: THREE.DoubleSide });
  g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.88, h, 48, 1, true), mat), 0, h / 2, 0));
  g.add(at(new THREE.Mesh(new THREE.CircleGeometry(r * 0.88, 48).rotateX(-Math.PI / 2), mat), 0, 0.005, 0));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.018, 8, 48), new THREE.MeshStandardMaterial({ color: '#B98F62', roughness: 0.8 }));
  rim.rotation.x = Math.PI / 2; rim.position.y = h;
  g.add(rim);
  return shadowed(g);
}

function makeShelves() {
  const g = new THREE.Group();   // local: wall at x=0, shelves along z, items toward +x
  [1.2, 1.78].forEach((y) => g.add(at(rbox(0.3, 0.045, 1.7, 0.01, M.oak), 0.15, y, 0)));
  // books
  const spines = ['#C98F6B', '#E2C9A8', '#A9B5A0', '#E8B9A3', '#D9C6AE', '#8E9C7E', '#E6D3BF'];
  let z = -0.78;
  spines.forEach((c, i) => {
    const hgt = 0.2 + (i % 3) * 0.04;
    const b = rbox(0.2, hgt, 0.05, 0.008, new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }));
    b.position.set(0.14, 1.78 + 0.0225 + hgt / 2, z);
    if (i === spines.length - 1) { b.rotation.x = -0.25; b.position.z += 0.04; }
    g.add(b);
    z += 0.058;
  });
  // baskets on the lower shelf
  g.add(at(makeBasket(0.13, 0.17, wovenTex()), 0.15, 1.2225, -0.55));
  g.add(at(makeBasket(0.12, 0.15, wovenTex('#EADBC8', '#D7C2A6')), 0.15, 1.2225, -0.25));
  // stacked play blocks
  const blockCols = ['#E8B9A3', '#A9B5A0', '#E2C9A8', '#C98F6B'];
  [[0.12, 0.05, 0.12, 0.25], [0.12, 0.05, 0.25, -0.2], [0.12, 0.17, 0.18, 0.4]].forEach(([x, y, zz, rot], i) => {
    const b = rbox(0.11, 0.11, 0.11, 0.015, materials.fabric(blockCols[i]));
    b.position.set(x, 1.2225 + y, zz + 0.1); b.rotation.y = rot;
    g.add(b);
  });
  // ring stacker toy
  const stack = new THREE.Group();
  stack.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 12), M.oak), 0, 0.11, 0));
  ['#C98F6B', '#E2C9A8', '#A9B5A0', '#E8B9A3'].forEach((c, i) => {
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.06 - i * 0.01, 0.022, 12, 32), materials.fabric(c));
    t.rotation.x = Math.PI / 2; t.position.y = 0.03 + i * 0.042;
    stack.add(t);
  });
  stack.position.set(0.15, 1.2225, 0.68);
  g.add(stack);
  // small plant on the top shelf
  g.add(at(makePlant(0.5), 0.15, 1.8025, 0.55));
  return shadowed(g);
}

function makeArmchair() {
  const g = new THREE.Group();   // local: front faces +z
  g.add(at(rbox(1.0, 0.36, 0.86, 0.08, M.boucle), 0, 0.3, 0));
  g.add(at(rbox(0.8, 0.14, 0.68, 0.06, M.boucle), 0, 0.53, 0.06));
  g.add(at(rbox(1.0, 0.7, 0.2, 0.09, M.boucle), 0, 0.68, -0.34));
  [-0.48, 0.48].forEach((x) => g.add(at(rbox(0.18, 0.5, 0.86, 0.08, M.boucle), x, 0.48, 0)));
  [[-0.4, -0.32], [0.4, -0.32], [-0.4, 0.32], [0.4, 0.32]].forEach(([x, z]) => g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.12, 12), M.walnut), x, 0.06, z)));
  const pillow = new THREE.Mesh(new THREE.SphereGeometry(0.22, 32, 20), M.pillow);
  pillow.scale.set(1, 1, 0.42); pillow.position.set(0.12, 0.78, -0.18); pillow.rotation.z = 0.2;
  g.add(pillow);
  // draped throw over the left arm
  const geo = new THREE.PlaneGeometry(0.5, 1.0, 12, 24);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    const a = (y + 0.5) * Math.PI * 0.9;
    p.setXYZ(i, x + Math.sin(y * 18) * 0.012, Math.sin(a) * 0.3, Math.cos(a) * 0.3);
  }
  geo.computeVertexNormals();
  const thr = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#EBDDCB', roughness: 0.95, side: THREE.DoubleSide }));
  thr.rotation.set(0, Math.PI / 2, Math.PI / 2);
  thr.position.set(-0.48, 0.42, 0.12);
  g.add(thr);
  return shadowed(g);
}

function makeFloorLamp() {
  const g = new THREE.Group();
  g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.03, 48), M.walnut), 0, 0.015, 0));
  g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1.45, 12), M.brass), 0, 0.74, 0));
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.26, 0.32, 48, 1, true), materials.linen('#ffb768', 1.1));
  shade.position.y = 1.5;
  g.add(shade);
  const light = new THREE.PointLight('#ffbf80', 1.4, 3.5, 2);
  light.position.y = 1.42;
  g.add(light);
  return shadowed(g);
}

// Soft additive "featured" glow disk (horizontal by default)
function makeGlow(radius) {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uStrength: { value: 0 }, uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`
      varying vec2 vUv; uniform float uStrength, uTime;
      void main(){
        float d = length(vUv - 0.5) * 2.0;
        float pool = smoothstep(1.0, 0.0, d) * 0.55;
        float r = fract(uTime * 0.22);
        float ring = smoothstep(0.035, 0.0, abs(d - r * 0.95)) * (1.0 - r) * 0.8;
        gl_FragColor = vec4(vec3(1.0, 0.78, 0.52) * (pool + ring) * uStrength, 1.0);
      }`
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), mat);
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 2;
  return m;
}

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------
function buildRoom(renderer, small) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#F2E8DC');
  scene.fog = new THREE.Fog('#F2E8DC', 12, 24);
  addEnvironment(renderer, scene, 0.28);

  // Light: warm sky fill + low sun streaming through the window (casts shadows)
  scene.add(new THREE.HemisphereLight('#fff4e6', '#c9a888', 0.75));
  const sunFrom = new THREE.Vector3(-3.4, 4.6, -9.5);
  const sunTo = new THREE.Vector3(-0.5, 0, 0.7);
  const sun = new THREE.DirectionalLight('#ffd6a0', 3.2);
  sun.position.copy(sunFrom);
  sun.target.position.copy(sunTo);
  sun.castShadow = true;
  sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 2, far: 22 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 4;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight('#ffe9d2', 0.55);
  fill.position.set(3, 4, 8);
  scene.add(fill);

  // Floor, walls (back wall is built around the window opening)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(RIGHT - LEFT + 0.3, 7.3), new THREE.MeshStandardMaterial({ map: planks(), roughness: 0.62 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = 0.1;
  floor.receiveShadow = true;
  scene.add(floor);

  const T = 0.15;
  const wall = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M.wall); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; scene.add(m); return m; };
  const wl = WIN.x - WIN.w / 2, wr = WIN.x + WIN.w / 2, wb = WIN.y - WIN.h / 2, wt = WIN.y + WIN.h / 2;
  const bz = BACK - T / 2;
  wall(wl - (LEFT - T), H, T, (LEFT - T + wl) / 2, H / 2, bz);
  wall(RIGHT + T - wr, H, T, (wr + RIGHT + T) / 2, H / 2, bz);
  wall(WIN.w, wb, T, WIN.x, wb / 2, bz);
  wall(WIN.w, H - wt, T, WIN.x, (wt + H) / 2, bz);
  wall(T, H, 7.1, LEFT - T / 2, H / 2, 0.05);
  wall(T, H, 7.1, RIGHT + T / 2, H / 2, 0.05);

  // Skirting boards
  [[RIGHT - LEFT, 0.12, 0.03, 0, 0.06, BACK + 0.015], [0.03, 0.12, 7.1, LEFT + 0.015, 0.06, 0.05], [0.03, 0.12, 7.1, RIGHT - 0.015, 0.06, 0.05]].forEach(([w, h, d, x, y, z]) => {
    const s = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M.trim); s.position.set(x, y, z); s.receiveShadow = true; scene.add(s);
  });

  // Window frame, mullions, sill, sky beyond
  const frame = new THREE.Group();
  const bar = (w, h, x, y) => frame.add(at(new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.2), M.trim), x, y, 0));
  bar(WIN.w + 0.12, 0.06, 0, WIN.h / 2); bar(WIN.w + 0.12, 0.06, 0, -WIN.h / 2);
  bar(0.06, WIN.h, -WIN.w / 2, 0); bar(0.06, WIN.h, WIN.w / 2, 0);
  bar(0.035, WIN.h, 0, 0); bar(WIN.w, 0.035, 0, 0.18);
  frame.add(at(new THREE.Mesh(new THREE.BoxGeometry(WIN.w + 0.3, 0.05, 0.26), M.trim), 0, -WIN.h / 2 - 0.03, 0.1));
  frame.position.set(WIN.x, WIN.y, bz);
  shadowed(frame);
  scene.add(frame);
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(9, 7), new THREE.MeshBasicMaterial({ map: skyTex(), fog: false }));
  sky.position.set(WIN.x - 0.6, 1.8, BACK - 3.5);
  scene.add(sky);
  [-1, 1].forEach((s) => {
    const c = makeCurtain(0.55, 2.6);
    c.position.set(WIN.x + s * (WIN.w / 2 + 0.36), 1.42, BACK + 0.12);
    scene.add(c);
  });
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, WIN.w + 1.3, 12), M.brass);
  rod.rotation.z = Math.PI / 2; rod.position.set(WIN.x, 2.74, BACK + 0.12);
  scene.add(rod);

  // Sun shaft: a frustum from the window opening along the light direction
  const dir = sunTo.clone().sub(sunFrom).normalize();
  const near = [[wl, wb], [wr, wb], [wr, wt], [wl, wt]].map(([x, y]) => new THREE.Vector3(x, y, BACK));
  const far = near.map((v) => v.clone().addScaledVector(dir, (v.y + 0.02) / -dir.y));
  const pos = [], along = [];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    [near[i], near[j], far[j], near[i], far[j], far[i]].forEach((v, k) => { pos.push(v.x, v.y, v.z); along.push([0, 0, 1, 0, 1, 1][k]); });
  }
  const shaftGeo = new THREE.BufferGeometry();
  shaftGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  shaftGeo.setAttribute('along', new THREE.Float32BufferAttribute(along, 1));
  const shaftU = { uTime: { value: 0 }, uOn: { value: 1 } };
  const shaft = new THREE.Mesh(shaftGeo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, uniforms: shaftU,
    vertexShader: 'attribute float along; varying float vA; varying vec3 vW; void main(){ vA = along; vW = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`
      varying float vA; varying vec3 vW; uniform float uTime, uOn;
      void main(){
        float flick = 0.85 + 0.15 * sin(vW.x * 3.0 + vW.y * 2.0 + uTime * 0.6);
        float a = (1.0 - vA) * smoothstep(0.0, 0.08, vA) * 0.065 * flick * uOn;
        gl_FragColor = vec4(vec3(1.0, 0.86, 0.66) * a, 1.0);
      }`
  }));
  shaft.renderOrder = 3;
  scene.add(shaft);

  // Dust motes drifting inside the shaft
  const DUST = small ? 110 : 240;
  const dpos = new Float32Array(DUST * 3), dseed = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) {
    const a = near[0].clone().lerp(near[1], rand()).lerp(near[3].clone().lerp(near[2], rand()), rand());
    a.addScaledVector(dir, rand() * 3.6);
    dpos.set([a.x, a.y, a.z], i * 3); dseed[i] = rand();
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  dustGeo.setAttribute('seed', new THREE.BufferAttribute(dseed, 1));
  const dust = new THREE.Points(dustGeo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: shaftU.uTime, uPx: { value: Math.min(window.devicePixelRatio || 1, 2) } },
    vertexShader: /* glsl */`
      attribute float seed; uniform float uTime, uPx; varying float vA;
      void main(){
        vec3 p = position + vec3(sin(uTime * 0.21 + seed * 40.0), sin(uTime * 0.17 + seed * 23.0) * 0.6, cos(uTime * 0.19 + seed * 31.0)) * 0.07;
        vA = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * 0.8 + seed * 50.0));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = (5.0 + seed * 7.0) * uPx / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(1.0, 0.9, 0.72) * smoothstep(0.5, 0.0, d) * vA * 0.9, 1.0); }'
  }));
  dust.frustumCulled = false;
  scene.add(dust);

  // Rug
  const rug = new THREE.Mesh(new THREE.CircleGeometry(1.55, 96), new THREE.MeshStandardMaterial({ map: rugTex(), roughness: 1 }));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0.7, 0.006, 0.9);
  rug.receiveShadow = true;
  scene.add(rug);

  // --- 01 Lighting: painted arch, dresser, table lamp, cloud night light, art
  const archShape = new THREE.Shape();
  archShape.moveTo(-1.1, 0); archShape.lineTo(-1.1, 1.3); archShape.absarc(0, 1.3, 1.1, Math.PI, 0, true); archShape.lineTo(1.1, 0); archShape.lineTo(-1.1, 0);
  const arch = new THREE.Mesh(new THREE.ShapeGeometry(archShape, 48), M.arch);
  arch.position.set(2.35, 0, BACK + 0.004);
  arch.receiveShadow = true;
  scene.add(arch);
  const dresser = at(makeDresser(), 2.35, 0, BACK + 0.3);
  scene.add(dresser);
  const lamp = makeLamp({ glow: 1.2 });
  lamp.scale.setScalar(0.3);
  lamp.position.set(2.9, 1.105 + 0.3, BACK + 0.32);
  lamp.userData.light.intensity = 1.6;
  lamp.userData.light.distance = 4;
  scene.add(shadowed(lamp));
  const cloud = makeCloudLight();
  cloud.scale.setScalar(0.2);
  cloud.position.set(1.85, 1.105 + 0.11, BACK + 0.3);
  scene.add(cloud);
  scene.add(at(makeFrame(artTex('moon'), 0.42, 0.52), 2.05, 1.85, BACK + 0.03));
  scene.add(at(makeFrame(artTex('arches'), 0.32, 0.4), 2.62, 1.78, BACK + 0.03));

  // --- 02 Air & comfort: side table under the window, humidifier, purifier, plant
  const table = at(makeSideTable(), WIN.x + 0.05, 0, BACK + 0.55);
  scene.add(table);
  const humid = at(makeHumidifier(), WIN.x + 0.12, 0.64, BACK + 0.5);
  scene.add(humid);
  scene.add(at(makePurifier(), WIN.x - 0.72, 0, BACK + 0.4));
  scene.add(at(makePlant(1.3), LEFT + 0.55, 0, BACK + 0.55));

  // --- 03 Storage & play: wall shelves on the left wall, floor basket
  const shelves = makeShelves();
  shelves.position.set(LEFT, 0, 0.3);
  scene.add(shelves);
  const floorBasket = makeBasket(0.32, 0.4, wovenTex());
  floorBasket.position.set(LEFT + 0.55, 0, 1.25);
  scene.add(floorBasket);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.13, 32, 20), M.sage);
  ball.position.set(LEFT + 0.6, 0.4, 1.2); ball.castShadow = true;
  scene.add(ball);
  scene.add(at(makeFrame(artTex('hills'), 0.5, 0.4).rotateY(Math.PI / 2), LEFT + 0.03, 2.35, 0.3));

  // --- 04 Reading nook: armchair, floor lamp, pouf, art on the right wall
  const chair = makeArmchair();
  chair.position.set(RIGHT - 0.95, 0, 1.55);
  chair.rotation.y = -Math.PI / 2 + 0.38;
  scene.add(chair);
  scene.add(at(makeFloorLamp(), RIGHT - 0.4, 0, 0.55));
  const pouf = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.36, 48), materials.fabric('#E7C9AE'));
  pouf.position.set(RIGHT - 1.9, 0.18, 2.35); pouf.castShadow = pouf.receiveShadow = true;
  scene.add(pouf);
  [['sun', 2.6, 0.9], ['moon', 1.7, 1.25]].forEach(([k, z, y]) => scene.add(at(makeFrame(artTex(k), 0.4, 0.5).rotateY(-Math.PI / 2), RIGHT - 0.03, y + 0.75, z)));

  // Featured glows (one per stop 1-4)
  const glows = [null];
  const g1 = makeGlow(0.85); g1.position.set(2.35, 1.11, BACK + 0.3); g1.scale.set(1, 0.4, 1);
  const g2 = makeGlow(1.0); g2.position.set(WIN.x - 0.2, 0.012, BACK + 0.6);
  const g3 = makeGlow(1.05); g3.rotation.set(0, Math.PI / 2, 0); g3.position.set(LEFT + 0.01, 1.5, 0.3);
  const g4 = makeGlow(1.3); g4.position.set(RIGHT - 1.05, 0.012, 1.55);
  [g1, g2, g3, g4].forEach((g) => { scene.add(g); glows.push(g); });
  glows.push(null);

  return { scene, glows, shaftU, cloud, humid, sun };
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
function initCards() {
  // Spotlight + gentle tilt on the glass cards (mouse only)
  if (coarsePointer || reducedMotion) return;
  document.querySelectorAll('.sn-card').forEach((card) => {
    const tilt = (x, y) => gsap.to(card, { '--rx': `${y}deg`, '--ry': `${x}deg`, duration: 0.6, ease: 'power3', overwrite: 'auto' });
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      card.style.setProperty('--px', `${x * 100}%`);
      card.style.setProperty('--py', `${y * 100}%`);
      tilt((x - 0.5) * 8, (0.5 - y) * 6);
    });
    card.addEventListener('pointerleave', () => tilt(0, 0));
  });
}

function initReveals() {
  const intro = document.querySelectorAll('#intro .sn-copy > *');
  if (reducedMotion) return;
  gsap.fromTo(intro, { opacity: 0, y: 30, filter: 'blur(12px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.4, stagger: 0.1, ease: 'expo.out', delay: 0.2, clearProps: 'filter' });
  document.querySelectorAll('.sn-reveal, #shop .sn-copy').forEach((el) => {
    gsap.fromTo(el, { opacity: 0, y: 60, filter: 'blur(14px)' }, {
      opacity: 1, y: 0, filter: 'blur(0px)', ease: 'none',
      // measured on the section: the card's own box is offset by the tween itself
      scrollTrigger: { trigger: el.closest('section'), start: 'top 80%', end: 'top 12%', scrub: 0.6 }
    });
  });
}

function stopTops() {
  // Scroll offset at which each stop's section reaches the top of the viewport
  const max = document.documentElement.scrollHeight - window.innerHeight;
  return [...document.querySelectorAll('[data-stop]')].map((s) => Math.min(max, s.getBoundingClientRect().top + window.scrollY));
}

/** Map a scroll offset to stop space (0 … N-1); camera holds near each stop. */
function stopSpace(y, tops, hold = true) {
  if (y <= tops[0]) return 0;
  for (let i = 0; i < tops.length - 1; i++) {
    if (y < tops[i + 1]) {
      const local = (y - tops[i]) / Math.max(1, tops[i + 1] - tops[i]);
      return i + (hold ? smooth(0.12, 0.88, local) : local);
    }
  }
  return tops.length - 1;
}

function init() {
  const nav = [...document.querySelectorAll('[data-nav]')];
  initCards();
  initReveals();

  let tops = stopTops();
  let activeNav = -1;
  const setNav = (i) => {
    if (i === activeNav) return;
    activeNav = i;
    nav.forEach((a, k) => (k === i ? a.setAttribute('aria-current', 'step') : a.removeAttribute('aria-current')));
  };
  const targetF = () => stopSpace(window.scrollY, tops);
  // active stop = the section covering the middle of the viewport
  const navIndex = () => Math.min(N - 1, Math.floor(stopSpace(window.scrollY + window.innerHeight * 0.5, tops, false)));

  // Snap to stops with mouse / trackpad (never on touch, never with reduced motion)
  ScrollTrigger.create({
    trigger: '.sn-track', start: 'top top', end: 'bottom bottom',
    snap: coarsePointer || reducedMotion ? false : {
      snapTo: (v) => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const pts = tops.map((t) => t / max);
        return pts.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
      },
      duration: { min: 0.35, max: 0.9 }, delay: 0.25, ease: 'power2.inOut'
    },
    onRefresh: () => { tops = stopTops(); }
  });

  const canvas = document.querySelector('.sn-canvas');
  if (!hasWebGL()) { document.documentElement.classList.add('no-webgl'); window.addEventListener('scroll', () => setNav(navIndex()), { passive: true }); setNav(0); return; }

  let renderer, room;
  try {
    renderer = createRenderer(canvas, { alpha: false, shadows: true });
    room = buildRoom(renderer, isSmall());
  } catch (err) {
    console.error('[tour] WebGL failed, using fallback', err);
    document.documentElement.classList.add('no-webgl');
    return;
  }
  const { scene, glows, shaftU, cloud, humid, sun } = room;
  const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 60);

  // Per-viewport camera rails
  let posCurve, lookCurve, portrait = false;
  const layout = () => {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSmall() ? 1.5 : 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    portrait = w / h < 0.9;
    camera.fov = portrait ? 58 : 38;
    camera.updateProjectionMatrix();
    const P = [], L = [];
    STOPS.forEach((s, i) => {
      const pos = new THREE.Vector3(...s.pos), look = new THREE.Vector3(...s.look);
      const view = look.clone().sub(pos);
      const dist = view.length();
      const right = view.clone().cross(new THREE.Vector3(0, 1, 0)).normalize();
      if (portrait) {
        // card sits at the bottom: push the subject up and step back a little
        if (i > 0 && i < N - 1) { look.y -= dist * 0.2; pos.addScaledVector(view.normalize(), -dist * 0.2); }
        else pos.addScaledVector(view.normalize(), -dist * 0.25);
      } else {
        look.addScaledVector(right, s.side * dist * 0.2); // card on the right → subject on the left
      }
      P.push(pos); L.push(look);
    });
    posCurve = new THREE.CatmullRomCurve3(P, false, 'centripetal');
    lookCurve = new THREE.CatmullRomCurve3(L, false, 'centripetal');
    tops = stopTops();
  };
  layout();

  // Pointer sway (desktop)
  const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
  if (!coarsePointer && !reducedMotion) {
    window.addEventListener('pointermove', (e) => { ptr.tx = (e.clientX / window.innerWidth) * 2 - 1; ptr.ty = -((e.clientY / window.innerHeight) * 2 - 1); }, { passive: true });
  }

  let f = reducedMotion ? navIndex() : targetF();
  const tmpP = new THREE.Vector3(), tmpL = new THREE.Vector3(), tmpR = new THREE.Vector3();
  let t = 0, last = performance.now(), raf = 0;

  const draw = (dt) => {
    const tf = targetF();
    if (reducedMotion) f = navIndex();
    else f += (tf - f) * (1 - Math.exp(-dt * 5));
    const u = THREE.MathUtils.clamp(f / (N - 1), 0, 1);
    posCurve.getPoint(u, tmpP);
    lookCurve.getPoint(u, tmpL);
    ptr.x += (ptr.tx - ptr.x) * 0.05; ptr.y += (ptr.ty - ptr.y) * 0.05;
    tmpR.subVectors(tmpL, tmpP).cross(camera.up).normalize();
    camera.position.copy(tmpP).addScaledVector(tmpR, ptr.x * 0.12).addScaledVector(camera.up, ptr.y * 0.06);
    camera.lookAt(tmpL);

    glows.forEach((g, i) => {
      if (!g) return;
      const w = clamp01(1 - Math.abs(f - i) * 1.6);
      g.material.uniforms.uStrength.value = w;
      g.material.uniforms.uTime.value = t;
      g.visible = w > 0.001;
    });
    shaftU.uTime.value = t;
    humid.userData.mist.material.uniforms.uTime.value = t;
    const breathe = reducedMotion ? 1 : 0.85 + 0.15 * Math.sin(t * 1.3);
    cloud.userData.light.intensity = 1.2 * breathe;
    setNav(navIndex());
    renderer.render(scene, camera);
  };

  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now; t += dt;
    draw(dt);
    raf = document.hidden ? 0 : requestAnimationFrame(frame);
  };
  const start = () => { if (!raf && !reducedMotion) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  // Reduced motion: render once per scroll/resize, no ambient loop
  let pending = 0;
  const once = () => { if (!pending) pending = requestAnimationFrame(() => { pending = 0; draw(0); }); };

  const ac = new AbortController();
  const { signal } = ac;
  let lastW = window.innerWidth, lastH = window.innerHeight;
  window.addEventListener('resize', () => {
    // ignore mobile URL-bar height jitter
    if (window.innerWidth === lastW && Math.abs(window.innerHeight - lastH) < 120) return;
    lastW = window.innerWidth; lastH = window.innerHeight;
    layout(); ScrollTrigger.refresh(); if (reducedMotion) once();
  }, { passive: true, signal });
  if (reducedMotion) {
    window.addEventListener('scroll', once, { passive: true, signal });
    t = 2; once();
  } else {
    gsap.fromTo(canvas, { opacity: 0, filter: 'blur(20px)' }, { opacity: 1, filter: 'blur(0px)', duration: 2, ease: 'expo.out', clearProps: 'filter' });
    start();
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); }, { signal });

  const destroy = () => {
    cancelAnimationFrame(raf); cancelAnimationFrame(pending); raf = -1;
    ac.abort();
    ScrollTrigger.getAll().forEach((s) => s.kill());
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      mats.forEach((m) => {
        Object.values(m).forEach((v) => { if (v && v.isTexture) v.dispose(); });
        if (m.uniforms) Object.values(m.uniforms).forEach((u) => { if (u.value && u.value.isTexture) u.value.dispose(); });
        m.dispose();
      });
    });
    if (scene.environment) scene.environment.dispose();
    sun.shadow.dispose();
    Object.values(M).forEach((m) => m.dispose());
    renderer.dispose();
    window.__tour = null;
  };
  window.addEventListener('pagehide', destroy, { once: true });
  window.__tour = { renderer, scene, camera, get f() { return f; }, destroy };
}

init();
