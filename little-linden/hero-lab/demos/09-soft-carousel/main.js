// 09 · Soft 3D Carousel
// Technique: eight gently curved panels (plane vertices bent onto a cylinder) arranged
// on a ring. GSAP rotates the ring to the selected panel; the ring can be dragged or
// swiped (pointer events on the canvas, pan-y kept for page scroll), stepped with the
// ← → buttons, or with the keyboard arrows while the hero has focus. The product card
// and a polite live region announce the active collection. Panels share a rounded-
// corner + glare shader; inactive panels dim and blur-fade for depth.
import { boot, THREE, gsap, frameCamera, reducedMotion } from '../../shared/core.js';

const COLLECTIONS = [
  ['Feeding & Nursing', '#E3E8DE', 'bottle'], ['Sleep & Nursery', '#EFE4DA', 'moon'], ['Baby Essentials', '#F2E4E0', 'swaddle'],
  ['Toys & Learning', '#E6EBE2', 'stacker'], ['Bath & Care', '#EAE3DB', 'drop'], ['Travel & Outdoor', '#E4E6DF', 'bag'],
  ['Mom Care', '#F0E2DE', 'heart'], ['Gifts & Bundles', '#EFE6DA', 'gift']
];

function panelTexture(title, tint, kind) {
  const c = document.createElement('canvas');
  c.width = 640; c.height = 800;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 800);
  grd.addColorStop(0, '#FCFAF6'); grd.addColorStop(1, tint);
  g.fillStyle = grd; g.fillRect(0, 0, 640, 800);
  g.strokeStyle = '#55624F'; g.lineWidth = 7; g.lineCap = 'round'; g.lineJoin = 'round';
  g.save(); g.translate(320, 330); g.scale(2.2, 2.2); g.translate(-50, -50);
  const P = (d) => g.stroke(new Path2D(d));
  const icons = {
    bottle: ['M40 22h20M42 22v8c-6 3-8 8-8 14v34a8 8 0 0 0 8 8h16a8 8 0 0 0 8-8V44c0-6-2-11-8-14v-8', 'M46 22c0-6 2-10 4-10s4 4 4 10'],
    moon: ['M64 22a28 28 0 1 0 14 40 24 24 0 0 1-14-40z'],
    swaddle: ['M20 58h60v18H20z', 'M26 58c0-10 6-16 24-16s24 6 24 16'],
    stacker: ['M30 80h40', 'M50 80V26', 'M32 72h36', 'M35 60h30', 'M38 48h24'],
    drop: ['M50 18c10 14 20 26 20 38a20 20 0 0 1-40 0c0-12 10-24 20-38z'],
    bag: ['M26 40h48v40H26z', 'M38 40v-8a12 12 0 0 1 24 0v8'],
    heart: ['M50 78S22 60 22 40a14 14 0 0 1 28-4 14 14 0 0 1 28 4c0 20-28 38-28 38z'],
    gift: ['M24 42h52v36H24z', 'M20 34h60v10H20z', 'M50 34v44']
  };
  g.lineWidth = 2.6;
  (icons[kind] || []).forEach(P);
  g.restore();
  g.fillStyle = '#282826';
  g.font = '400 58px "Instrument Serif", Georgia, serif';
  g.textAlign = 'center';
  g.fillText(title, 320, 620);
  g.fillStyle = 'rgba(40,40,38,.55)';
  g.font = '500 20px "DM Sans", Arial, sans-serif';
  g.fillText('COLLECTION · PLACEHOLDER ART', 320, 670);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function bentPlane(w, h, radius) {
  const geo = new THREE.PlaneGeometry(w, h, 32, 1);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const a = x / radius;
    p.setXYZ(i, Math.sin(a) * radius, p.getY(i), Math.cos(a) * radius - radius);
  }
  geo.computeVertexNormals();
  return geo;
}

boot({
  slug: '09-soft-carousel',
  setup({ renderer, canvas, hero, pointer, width, height, signal }) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#F4EFE8');
    const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 100);
    camera.position.set(0, 0.6, 13);

    const N = COLLECTIONS.length;
    const STEP = (Math.PI * 2) / N;
    const R = 5.2;
    const ring = new THREE.Group();
    const glare = { value: new THREE.Vector2(0.5, 0.5) };
    const panels = COLLECTIONS.map(([title, tint, kind], i) => {
      const m = new THREE.Mesh(bentPlane(2.6, 3.25, 4), new THREE.ShaderMaterial({
        transparent: true, side: THREE.DoubleSide,
        uniforms: { uMap: { value: panelTexture(title, tint, kind) }, uDim: { value: 0 }, uGlare: glare },
        vertexShader: 'varying vec2 vUv; varying vec4 vClip; void main(){ vUv = uv; vClip = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = vClip; }',
        fragmentShader: /* glsl */`
          varying vec2 vUv; varying vec4 vClip; uniform sampler2D uMap; uniform float uDim; uniform vec2 uGlare;
          float rbox(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
          void main(){
            vec2 p = (vUv - 0.5) * vec2(0.8, 1.0);
            float mask = 1.0 - smoothstep(-0.002, 0.002, rbox(p, vec2(0.4, 0.5), 0.05));
            vec3 col = texture2D(uMap, vUv).rgb;
            vec2 s = vClip.xy / vClip.w * 0.5 + 0.5;
            col += vec3(1.0, 0.95, 0.9) * exp(-pow(dot(s - uGlare, normalize(vec2(1.0, -0.7))) * 8.0, 2.0)) * 0.16 * (1.0 - uDim);
            col = mix(col, vec3(0.95, 0.93, 0.9), uDim * 0.55);
            if (!gl_FrontFacing) col *= 0.82;
            gl_FragColor = vec4(col, mask * (1.0 - uDim * 0.35));
            #include <colorspace_fragment>
          }`
      }));
      const a = i * STEP;
      m.position.set(Math.sin(a) * R, 0, Math.cos(a) * R);
      m.rotation.y = a;
      ring.add(m);
      return m;
    });
    scene.add(ring);

    // ---------- Controls
    let index = 0;
    let angle = 0;              // target ring rotation
    const nameEl = hero.querySelector('[data-card-name]');
    const kickerEl = hero.querySelector('[data-card-kicker]');
    const status = hero.querySelector('[data-carousel-status]');
    const go = (dir) => {
      index = (index + dir + N) % N;
      angle -= dir * STEP;
      gsap.to(ring.rotation, { y: angle, duration: reducedMotion ? 0 : 1.1, ease: 'expo.out', overwrite: true });
      const title = COLLECTIONS[index][0];
      if (status) status.textContent = `Collection ${index + 1} of ${N}: ${title}`;
      gsap.timeline()
        .to(nameEl, { opacity: 0, filter: 'blur(6px)', duration: 0.2 })
        .add(() => { nameEl.textContent = title; kickerEl.textContent = 'Collection'; })
        .to(nameEl, { opacity: 1, filter: 'blur(0px)', duration: 0.45, clearProps: 'filter' });
    };
    hero.querySelector('[data-carousel-prev]').addEventListener('click', () => go(-1), { signal });
    hero.querySelector('[data-carousel-next]').addEventListener('click', () => go(1), { signal });
    hero.tabIndex = -1;
    document.addEventListener('keydown', (e) => {
      if (!hero.contains(document.activeElement) && document.activeElement !== document.body) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    }, { signal });

    // Drag / swipe on the canvas (vertical scrolling still works: touch-action: pan-y)
    let dragX = null, startAngle = 0;
    canvas.addEventListener('pointerdown', (e) => { dragX = e.clientX; startAngle = ring.rotation.y; canvas.setPointerCapture(e.pointerId); }, { signal });
    canvas.addEventListener('pointermove', (e) => {
      if (dragX === null) return;
      gsap.set(ring.rotation, { y: startAngle + (e.clientX - dragX) * 0.006 });
    }, { signal });
    const end = (e) => {
      if (dragX === null) return;
      const dx = e.clientX - dragX;
      dragX = null;
      ring.rotation.y = startAngle + dx * 0.006;
      angle = startAngle;
      if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
      else gsap.to(ring.rotation, { y: angle, duration: 0.6, ease: 'expo.out' });
    };
    canvas.addEventListener('pointerup', end, { signal });
    canvas.addEventListener('pointercancel', end, { signal });

    let portrait = false;
    const layout = (w, h) => {
      portrait = frameCamera(camera, w, h, { desktopZ: 13, mobileZ: 19 });
      ring.position.set(portrait ? 0 : 3.6, portrait ? 4.4 : 1.0, portrait ? -3 : -1.5);
      ring.scale.setScalar(portrait ? 0.62 : 0.68);
    };
    layout(width, height);
    nameEl.textContent = COLLECTIONS[0][0];
    if (status) status.textContent = `Collection 1 of ${N}: ${COLLECTIONS[0][0]}`;

    return {
      scene,
      resize: layout,
      intro(tl) {
        tl.from(ring.rotation, { y: -Math.PI * 0.9, duration: 2.4, ease: 'expo.out' }, 0);
      },
      render(t, dt, { scroll }) {
        // dim panels by how far they face away from the camera
        panels.forEach((p, i) => {
          const facing = Math.cos(i * STEP + ring.rotation.y);
          p.material.uniforms.uDim.value = THREE.MathUtils.clamp(1 - facing, 0, 1);
        });
        glare.value.set(pointer.x * 0.5 + 0.5, pointer.y * 0.5 + 0.5);
        ring.rotation.x = -0.08 - pointer.y * 0.06;
        camera.position.x = pointer.x * 0.5;
        camera.position.y = (portrait ? 2.6 : 0.6) + pointer.y * 0.3 - scroll * 2;
        camera.lookAt(portrait ? 0 : 1.6, (portrait ? 2.6 : 0.3) - scroll * 2, 0);
        renderer.render(scene, camera);
      }
    };
  }
});
