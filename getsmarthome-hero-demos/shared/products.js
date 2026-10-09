/* ==========================================================================
   Procedural "home & lifestyle" products (no external model files needed).
   Each factory returns a THREE.Group roughly 2 units tall, centred on origin.
   Replace with real GLB models of the store's products for production.
   ========================================================================== */
import * as THREE from 'three';

const lathe = (pts, segments = 96) =>
  new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), segments);

/** Smooth a coarse [radius, y] profile with a Catmull-Rom spline. */
const smoothProfile = (pts, divisions = 80) => {
  const curve = new THREE.SplineCurve(pts.map(([r, y]) => new THREE.Vector2(r, y)));
  return curve.getPoints(divisions).map((v) => [Math.max(0.001, v.x), v.y]);
};

export const materials = {
  ceramic: (color = '#C77B54') => new THREE.MeshPhysicalMaterial({ color, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.25, sheen: 0.4, sheenColor: new THREE.Color('#ffd8b0') }),
  glaze: (color = '#F1E6D6') => new THREE.MeshPhysicalMaterial({ color, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 }),
  walnut: () => new THREE.MeshStandardMaterial({ color: '#6A4430', roughness: 0.55, metalness: 0 }),
  brass: () => new THREE.MeshStandardMaterial({ color: '#C9A46B', roughness: 0.28, metalness: 1 }),
  linen: (emissive = '#000000', intensity = 0) => new THREE.MeshStandardMaterial({ color: '#EFE2CF', roughness: 0.9, side: THREE.DoubleSide, emissive, emissiveIntensity: intensity }),
  fabric: (color = '#D9C6AE') => new THREE.MeshPhysicalMaterial({ color, roughness: 0.95, sheen: 1, sheenRoughness: 0.6, sheenColor: new THREE.Color('#fff1dc') }),
  glass: () => new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.02, metalness: 0, transmission: 1, thickness: 0.35, ior: 1.5, specularIntensity: 1, envMapIntensity: 0.6, attenuationColor: new THREE.Color('#f0c48e'), attenuationDistance: 3.5 })
};

export function makeVase({ color = '#C77B54' } = {}) {
  const g = new THREE.Group();
  const profile = smoothProfile([[0.001, -1], [0.42, -0.98], [0.68, -0.6], [0.72, -0.1], [0.5, 0.45], [0.26, 0.78], [0.3, 0.98], [0.34, 1.0]]);
  const body = new THREE.Mesh(lathe(profile), materials.ceramic(color));
  body.castShadow = body.receiveShadow = true;
  g.add(body);
  // glaze drip band
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.705, 0.012, 12, 128), materials.brass());
  band.rotation.x = Math.PI / 2;
  band.position.y = -0.2;
  g.add(band);
  g.userData.label = 'Ceramic Vase';
  return g;
}

export function makeLamp({ glow = 1.4 } = {}) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(lathe(smoothProfile([[0.001, -1], [0.55, -1], [0.58, -0.92], [0.42, -0.78], [0.12, -0.7], [0.08, -0.62]])), materials.walnut());
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.25, 24), materials.brass());
  stem.position.y = -0.05;
  const shadeGeo = new THREE.CylinderGeometry(0.42, 0.78, 0.82, 96, 1, true);
  const shade = new THREE.Mesh(shadeGeo, materials.linen('#ffb768', glow));
  shade.position.y = 0.6;
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 32, 16), new THREE.MeshBasicMaterial({ color: '#fff0d2' }));
  bulb.position.y = 0.45;
  const light = new THREE.PointLight('#ffb36b', 3, 6, 2);
  light.position.y = 0.45;
  [base, stem, shade].forEach((m) => { m.castShadow = true; m.receiveShadow = true; });
  g.add(base, stem, shade, bulb, light);
  g.userData.label = 'Arc Table Lamp';
  g.userData.light = light;
  return g;
}

export function makeSpeaker() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(lathe(smoothProfile([[0.001, -1], [0.6, -1], [0.66, -0.9], [0.66, 0.55], [0.6, 0.68], [0.001, 0.7]])), materials.fabric('#D8C3A8'));
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.06, 96), materials.walnut());
  top.position.y = 0.72;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.018, 12, 128), new THREE.MeshBasicMaterial({ color: '#ffbf7a' }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.76;
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.05, 96), materials.brass());
  foot.position.y = -0.98;
  [body, top, foot].forEach((m) => { m.castShadow = true; m.receiveShadow = true; });
  g.add(body, top, ring, foot);
  g.userData.label = 'Smart Speaker';
  g.userData.ring = ring;
  return g;
}

export function makeCandle() {
  const g = new THREE.Group();
  const jar = new THREE.Mesh(lathe(smoothProfile([[0.001, -1], [0.62, -1], [0.66, -0.9], [0.66, 0.35], [0.62, 0.42]]), 96), materials.glass());
  const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.0, 96), new THREE.MeshPhysicalMaterial({ color: '#F4E7D2', roughness: 0.55, transmission: 0.25, thickness: 0.6 }));
  wax.position.y = -0.48;
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.64, 0.64, 0.12, 96), materials.brass());
  lid.position.set(0.9, -0.94, 0.3);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.22, 24), new THREE.MeshBasicMaterial({ color: '#ffd28a' }));
  flame.position.y = 0.17;
  const light = new THREE.PointLight('#ffad5c', 2.2, 4, 2);
  light.position.y = 0.3;
  [jar, wax, lid].forEach((m) => { m.castShadow = true; m.receiveShadow = true; });
  g.add(jar, wax, lid, flame, light);
  g.userData.label = 'Amber Candle';
  g.userData.flame = flame;
  g.userData.light = light;
  return g;
}

export function makeMug({ color = '#EFE3D1' } = {}) {
  const g = new THREE.Group();
  const outer = smoothProfile([[0.001, -0.75], [0.5, -0.75], [0.56, -0.6], [0.58, 0.55], [0.6, 0.62]], 40);
  const inner = smoothProfile([[0.54, 0.62], [0.52, 0.5], [0.5, -0.55], [0.001, -0.6]], 40);
  const body = new THREE.Mesh(lathe([...outer, ...inner]), materials.glaze(color));
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.06, 20, 64, Math.PI * 1.25), materials.glaze(color));
  handle.position.set(0.6, 0, 0);
  handle.rotation.z = -Math.PI * 0.62;
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.5, 48), new THREE.MeshPhysicalMaterial({ color: '#3b2216', roughness: 0.15, clearcoat: 1 }));
  coffee.rotation.x = -Math.PI / 2;
  coffee.position.y = 0.42;
  [body, handle].forEach((m) => { m.castShadow = true; m.receiveShadow = true; });
  g.add(body, handle, coffee);
  g.userData.label = 'Stoneware Mug';
  return g;
}

export function makeDiffuser() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(lathe(smoothProfile([[0.001, -1], [0.7, -1], [0.74, -0.85], [0.6, -0.55], [0.001, -0.5]])), materials.walnut());
  const dome = new THREE.Mesh(lathe(smoothProfile([[0.6, -0.55], [0.62, -0.1], [0.45, 0.45], [0.18, 0.75], [0.001, 0.8]])), materials.glaze('#F3E8DA'));
  const glow = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.015, 8, 96), new THREE.MeshBasicMaterial({ color: '#ffc287' }));
  glow.rotation.x = Math.PI / 2;
  glow.position.y = -0.55;
  [base, dome].forEach((m) => { m.castShadow = true; m.receiveShadow = true; });
  g.add(base, dome, glow);
  g.userData.label = 'Aroma Diffuser';
  return g;
}

export const PRODUCTS = { vase: makeVase, lamp: makeLamp, speaker: makeSpeaker, candle: makeCandle, mug: makeMug, diffuser: makeDiffuser };

/** Warm studio lighting rig used by several demos. */
export function warmLights(scene, { shadows = false, intensity = 1 } = {}) {
  const hemi = new THREE.HemisphereLight('#fff3e2', '#7a5238', 0.9 * intensity);
  const key = new THREE.DirectionalLight('#ffd7a8', 2.6 * intensity);
  key.position.set(4, 6, 5);
  if (shadows) {
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -5; key.shadow.camera.right = 5;
    key.shadow.camera.top = 5; key.shadow.camera.bottom = -5;
    key.shadow.radius = 6;
    key.shadow.bias = -0.0005;
  }
  const rim = new THREE.DirectionalLight('#ffb27a', 1.4 * intensity);
  rim.position.set(-5, 3, -4);
  scene.add(hemi, key, rim);
  return { hemi, key, rim };
}
