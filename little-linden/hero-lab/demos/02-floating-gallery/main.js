// 02 · Floating Product Gallery
// Technique: product images on planes at five depths. A custom shader gives each
// plane rounded corners, a soft inner vignette and a glare band that tracks the
// cursor (spotlight/foil). Planes float and rotate slowly; the camera parallaxes.
// Imagery is configurable: put image URLs in <script id="gallery-config"> as
// [{ "src": "...", "alt": "..." }]. Without URLs, labelled placeholders are drawn.
import { boot, THREE, frameCamera } from '../../shared/core.js';

const KINDS = ['stacker', 'swaddle', 'bottle', 'moon', 'blocks', 'cloud', 'rattle'];
const TINTS = ['#EFE6DA', '#E9DAD5', '#E3E8DE', '#F1E8DC', '#EADFD7', '#E6EBE2', '#F2E4E0'];

/** Labelled placeholder "product photo" drawn on a canvas (replace with real photography). */
function placeholder(kind, tint) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 640;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 640);
  grd.addColorStop(0, '#FBF8F3'); grd.addColorStop(1, tint);
  g.fillStyle = grd; g.fillRect(0, 0, 512, 640);
  g.fillStyle = 'rgba(110,97,85,.14)';
  g.beginPath(); g.ellipse(256, 520, 150, 22, 0, 0, Math.PI * 2); g.fill();
  const sage = '#A9B5A0', rose = '#D9B2AE', cream = '#F1E8DC', wood = '#D9BC97', taupe = '#B7A99A';
  const rr = (x, y, w, h, r, col) => { g.fillStyle = col; g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); };
  g.lineWidth = 0;
  switch (kind) {
    case 'stacker':
      rr(150, 480, 212, 34, 14, wood); rr(244, 220, 24, 270, 10, wood);
      [[sage, 190], [rose, 170], [cream, 150], [taupe, 130]].forEach(([col, w], i) => rr(256 - w / 2, 430 - i * 56, w, 50, 25, col));
      g.fillStyle = wood; g.beginPath(); g.arc(256, 210, 26, 0, Math.PI * 2); g.fill();
      break;
    case 'swaddle':
      rr(110, 400, 292, 90, 26, cream);
      g.fillStyle = 'rgba(169,181,160,.55)'; for (let x = 130; x < 390; x += 36) g.fillRect(x, 400, 12, 90);
      rr(130, 330, 252, 80, 30, rose);
      break;
    case 'bottle':
      rr(196, 250, 120, 250, 36, 'rgba(255,255,255,.85)'); rr(204, 360, 104, 132, 26, '#FFFDF8');
      rr(190, 222, 132, 42, 14, sage); rr(234, 160, 44, 70, 22, '#EAD9C4');
      break;
    case 'moon':
      g.fillStyle = cream; g.beginPath(); g.arc(256, 330, 130, 0, Math.PI * 2); g.fill();
      g.fillStyle = tint; g.beginPath(); g.arc(310, 290, 115, 0, Math.PI * 2); g.fill();
      break;
    case 'blocks':
      rr(130, 380, 120, 120, 26, cream); rr(262, 380, 120, 120, 26, sage); rr(196, 252, 120, 120, 26, rose);
      break;
    case 'cloud':
      g.fillStyle = '#FFF4E4';
      [[200, 360, 80], [290, 340, 95], [360, 380, 65], [150, 395, 55]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); });
      rr(170, 470, 172, 26, 12, wood);
      break;
    default:
      g.fillStyle = rose; g.beginPath(); g.arc(256, 280, 90, 0, Math.PI * 2); g.fill();
      rr(240, 360, 32, 140, 16, wood);
  }
  g.fillStyle = 'rgba(40,40,38,.55)';
  g.font = '500 20px "DM Sans", Arial, sans-serif';
  g.textAlign = 'center';
  g.fillText('PLACEHOLDER · replace with product photo', 256, 600);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

boot({
  slug: '02-floating-gallery',
  setup({ renderer, pointer, width, height }) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#F4EEE6');
    const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 100);
    camera.position.set(0, 0, 12);

    let config = [];
    try { config = JSON.parse(document.getElementById('gallery-config')?.textContent || '[]'); } catch (_) { config = []; }
    const loader = new THREE.TextureLoader();

    const glare = { value: new THREE.Vector2(0.5, 0.5) };
    const makeMaterial = (tex) => new THREE.ShaderMaterial({
      transparent: true,
      uniforms: { uMap: { value: tex }, uGlare: glare, uAspect: { value: 0.8 }, uRadius: { value: 0.07 }, uOpacity: { value: 1 } },
      vertexShader: /* glsl */`varying vec2 vUv; varying vec4 vClip;
        void main(){ vUv = uv; vClip = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = vClip; }`,
      fragmentShader: /* glsl */`
        varying vec2 vUv; varying vec4 vClip; uniform sampler2D uMap; uniform vec2 uGlare; uniform float uAspect, uRadius, uOpacity;
        float roundedBox(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
        void main(){
          vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
          float d = roundedBox(p, vec2(uAspect, 1.0) * 0.5, uRadius);
          float mask = 1.0 - smoothstep(-0.002, 0.002, d);
          vec3 col = texture2D(uMap, vUv).rgb;
          // glare band oriented diagonally, centred on the cursor (screen space)
          vec2 s = vClip.xy / vClip.w * 0.5 + 0.5;
          float band = exp(-pow(dot(s - uGlare, normalize(vec2(1.0, -0.6))) * 9.0, 2.0));
          col += vec3(1.0, 0.95, 0.9) * band * 0.18;
          // warm foil rim
          float rim = smoothstep(-0.03, 0.0, d) * mask;
          col = mix(col, vec3(0.94, 0.82, 0.78), rim * 0.6);
          gl_FragColor = vec4(col, mask * uOpacity);
          #include <colorspace_fragment>
        }`
    });

    // Five depth layers
    const SLOTS = [
      [-3.6, 1.4, -4, 1.9, -0.12], [3.9, 1.9, -5, 2.0, 0.1], [-2.0, -1.6, -2, 1.7, 0.06],
      [2.0, -0.6, 0, 2.5, -0.05], [4.4, -2.4, -3, 1.6, 0.12], [0.2, 2.7, -7, 1.8, -0.04], [-4.8, -0.2, -6, 1.6, 0.08]
    ];
    const group = new THREE.Group();
    const planes = SLOTS.map(([x, y, z, h, r], i) => {
      const cfg = config[i];
      const tex = cfg && cfg.src ? loader.load(cfg.src, (t) => { t.colorSpace = THREE.SRGBColorSpace; }) : placeholder(KINDS[i % KINDS.length], TINTS[i % TINTS.length]);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(h * 0.8, h), makeMaterial(tex));
      m.position.set(x, y, z);
      m.rotation.z = r;
      m.userData = { base: new THREE.Vector3(x, y, z), phase: i * 1.3, depth: (z + 8) / 8 };
      // soft drop shadow card behind each image
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(h * 0.84, h * 1.04), new THREE.MeshBasicMaterial({ color: '#6E6155', transparent: true, opacity: 0.08 }));
      sh.position.set(0.08, -0.12, -0.05);
      m.add(sh);
      group.add(m);
      return m;
    });
    scene.add(group);

    let portrait = false;
    const layout = (w, h) => {
      portrait = frameCamera(camera, w, h, { desktopZ: 12, mobileZ: 17 });
      group.position.set(portrait ? 0 : 2.2, portrait ? 3.6 : 0, 0);
      group.scale.setScalar(portrait ? 0.62 : 1);
    };
    layout(width, height);

    return {
      scene,
      resize: layout,
      intro(tl) {
        planes.forEach((p, i) => {
          tl.from(p.position, { z: p.userData.base.z - 8, duration: 2, ease: 'expo.out' }, 0.1 + i * 0.08);
          tl.fromTo(p.material.uniforms.uOpacity, { value: 0 }, { value: 1, duration: 1.2 }, 0.1 + i * 0.08);
        });
      },
      render(t, dt, { scroll }) {
        planes.forEach((p) => {
          const { base, phase, depth } = p.userData;
          // gentle float + parallax stronger for nearer planes
          p.position.x = base.x + pointer.x * 0.5 * depth;
          p.position.y = base.y + Math.sin(t * 0.5 + phase) * 0.12 + pointer.y * 0.3 * depth + scroll * 3 * depth;
          p.rotation.y = pointer.x * 0.25 + Math.sin(t * 0.3 + phase) * 0.05;
          p.rotation.x = -pointer.y * 0.15;
        });
        glare.value.set(pointer.x * 0.5 + 0.5, pointer.y * 0.5 + 0.5);
        renderer.render(scene, camera);
      }
    };
  }
});
