/* ==========================================================================
   Procedural mom & baby props (DEMO ONLY — replace with real product GLBs or
   photography). Each factory returns a THREE.Group roughly 2 units tall,
   centred on the origin. Forms are deliberately soft and rounded.
   ========================================================================== */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const lathe = (pts, seg = 96) => new THREE.LatheGeometry(new THREE.SplineCurve(pts.map(([r, y]) => new THREE.Vector2(r, y))).getPoints(80), seg);

export const mat = {
  matte: (color) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.62, sheen: 0.6, sheenRoughness: 0.7, sheenColor: new THREE.Color('#fff4ea'), clearcoat: 0.15 }),
  wood: (color = '#D9BC97') => new THREE.MeshStandardMaterial({ color, roughness: 0.7 }),
  silicone: (color) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.38, clearcoat: 0.4, clearcoatRoughness: 0.35, sheen: 0.3 }),
  fabric: (color) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.95, sheen: 1, sheenRoughness: 0.55, sheenColor: new THREE.Color('#fff6ee') }),
  frost: () => new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.32, transmission: 0.9, thickness: 0.4, ior: 1.4 }),
  glow: (color = '#FFE9CF', intensity = 0.9) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.8 })
};

const shadowy = (g) => { g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return g; };

export function makeRingStacker() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.8, 0.22, 64), mat.wood());
  base.position.y = -0.95;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 1.5, 32), mat.wood());
  post.position.y = -0.2;
  g.add(base, post);
  const colors = ['#A9B5A0', '#D9B2AE', '#E8DCCB', '#B7A99A', '#C7D0BE'];
  colors.forEach((c, i) => {
    const r = 0.62 - i * 0.09;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.14 - i * 0.008, 24, 64), mat.matte(c));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.7 + i * 0.27;
    g.add(ring);
  });
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.2, 32, 16), mat.wood('#CFAE86'));
  knob.position.y = 0.66;
  g.add(knob);
  g.userData.label = 'Ring Stacker (demo prop)';
  return shadowy(g);
}

export function makeRattle() {
  const g = new THREE.Group();
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 48, 32), mat.matte('#D9B2AE'));
  head.position.y = 0.45;
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.05, 16, 64), mat.wood());
  band.position.y = 0.45;
  band.rotation.x = Math.PI / 2;
  const handle = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.9, 8, 24), mat.wood());
  handle.position.y = -0.45;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.07, 16, 48), mat.silicone('#A9B5A0'));
  ring.position.y = -1.0;
  g.add(head, band, handle, ring);
  g.userData.label = 'Wooden Rattle (demo prop)';
  return shadowy(g);
}

export function makeBottle() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(lathe([[0.001, -1], [0.45, -0.98], [0.5, -0.8], [0.5, 0.25], [0.44, 0.38]]), mat.frost());
  const milk = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.47, 0.75, 48), mat.matte('#FBF6EE'));
  milk.position.y = -0.58;
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.22, 48), mat.silicone('#A9B5A0'));
  collar.position.y = 0.48;
  const teat = new THREE.Mesh(lathe([[0.36, 0.59], [0.3, 0.64], [0.14, 0.78], [0.1, 0.95], [0.13, 1.02], [0.001, 1.06]]), mat.silicone('#EAD9C4'));
  g.add(body, milk, collar, teat);
  g.userData.label = 'Feeding Bottle (demo prop)';
  return shadowy(g);
}

export function makeBlocks() {
  const g = new THREE.Group();
  const geo = new RoundedBoxGeometry(0.8, 0.8, 0.8, 5, 0.16);
  [['#F1E8DC', -0.45, -0.6, 0, 0.2], ['#A9B5A0', 0.45, -0.6, 0.1, -0.15], ['#D9B2AE', 0, 0.2, 0, 0.35]].forEach(([c, x, y, z, ry]) => {
    const b = new THREE.Mesh(geo, mat.matte(c));
    b.position.set(x, y, z);
    b.rotation.y = ry;
    g.add(b);
  });
  g.userData.label = 'Soft Blocks (demo prop)';
  return shadowy(g);
}

export function makeCloudLight() {
  const g = new THREE.Group();
  const m = mat.glow('#FFF1DE', 0.55);
  [[0, 0, 0, 0.6], [-0.6, -0.12, 0, 0.45], [0.6, -0.1, 0, 0.48], [-0.25, 0.32, 0, 0.42], [0.3, 0.28, 0, 0.4]].forEach(([x, y, z, r]) => {
    const s = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), m);
    s.position.set(x, y, z);
    s.scale.z = 0.7;
    g.add(s);
  });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.56, 0.16, 48), mat.wood());
  base.position.y = -0.62;
  g.add(base);
  const light = new THREE.PointLight('#ffd9ad', 1.4, 4, 2);
  g.add(light);
  g.userData.label = 'Cloud Night Light (demo prop)';
  return shadowy(g);
}

export function makeMoon() {
  const g = new THREE.Group();
  // Crescent = outer circle minus an offset circle, extruded with a soft bevel
  const s = new THREE.Shape();
  s.absarc(0, 0, 0.9, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0.42, 0.22, 0.78, 0, Math.PI * 2, true);
  // build crescent outline explicitly (hole must stay inside the outer shape)
  const c = new THREE.Shape();
  const pts = [];
  for (let i = 0; i <= 64; i++) { const a = Math.PI * 0.32 + (i / 64) * Math.PI * 1.36; pts.push(new THREE.Vector2(Math.cos(a) * 0.9, Math.sin(a) * 0.9)); }
  for (let i = 64; i >= 0; i--) { const a = Math.PI * 0.42 + (i / 64) * Math.PI * 1.16; pts.push(new THREE.Vector2(0.36 + Math.cos(a) * 0.7, 0.18 + Math.sin(a) * 0.7)); }
  c.setFromPoints(pts);
  const geo = new THREE.ExtrudeGeometry(c, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.16, bevelSize: 0.12, bevelSegments: 8, curveSegments: 64 });
  geo.center();
  const moon = new THREE.Mesh(geo, mat.matte('#F1E8DC'));
  moon.rotation.z = -0.35;
  g.add(moon);
  g.userData.label = 'Moon (demo prop)';
  return shadowy(g);
}

export function makeSwaddle() {
  const g = new THREE.Group();
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#F4ECE1'; x.fillRect(0, 0, 256, 256);
  x.fillStyle = 'rgba(169,181,160,.55)';
  for (let i = 0; i < 256; i += 32) x.fillRect(i, 0, 10, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const fold = new THREE.Mesh(new RoundedBoxGeometry(1.8, 0.28, 1.3, 4, 0.12), new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.95, sheen: 1, sheenColor: new THREE.Color('#fff6ee') }));
  fold.position.y = -0.7;
  const fold2 = fold.clone();
  fold2.scale.set(0.92, 1, 0.92);
  fold2.position.y = -0.42;
  fold2.rotation.y = 0.12;
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 1.4, 48), new THREE.MeshPhysicalMaterial({ color: '#D9B2AE', roughness: 0.95, sheen: 1 }));
  roll.rotation.z = Math.PI / 2;
  roll.position.set(0, -0.0, 0.1);
  g.add(fold, fold2, roll);
  g.userData.label = 'Muslin Swaddle (demo prop)';
  return shadowy(g);
}

export function makeTeether() {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.12, 24, 96), mat.wood());
  const beads = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI * 0.15 + i * 0.32;
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.17, 32, 16), mat.silicone(i % 2 ? '#A9B5A0' : '#D9B2AE'));
    b.position.set(Math.cos(a) * 0.6, Math.sin(a) * 0.6, 0);
    beads.add(b);
  }
  g.add(ring, beads);
  g.userData.label = 'Wooden Teether (demo prop)';
  return shadowy(g);
}

export function makePebble(color = '#D9B2AE', seed = 1) {
  const geo = new THREE.SphereGeometry(1, 96, 64);
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = Math.sin(v.x * 2.1 + seed) * 0.06 + Math.sin(v.y * 2.7 + seed * 2) * 0.05 + Math.sin(v.z * 1.7 + seed * 3) * 0.05;
    v.multiplyScalar(1 + n);
    v.y *= 0.72;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat.matte(color));
  m.castShadow = m.receiveShadow = true;
  return m;
}

/** Soft "window light" studio rig. */
export function softLights(scene, { shadows = false, intensity = 1 } = {}) {
  const hemi = new THREE.HemisphereLight('#FFF8EF', '#B7A99A', 1.0 * intensity);
  const key = new THREE.DirectionalLight('#FFE8CF', 2.2 * intensity);
  key.position.set(-4, 6, 5);
  if (shadows) {
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6 });
    key.shadow.radius = 8;
    key.shadow.bias = -0.0005;
  }
  const rim = new THREE.DirectionalLight('#F3D2CC', 1.0 * intensity);
  rim.position.set(5, 3, -4);
  scene.add(hemi, key, rim);
  return { hemi, key, rim };
}

export const PROPS = { ringStacker: makeRingStacker, rattle: makeRattle, bottle: makeBottle, blocks: makeBlocks, cloud: makeCloudLight, moon: makeMoon, swaddle: makeSwaddle, teether: makeTeether };
