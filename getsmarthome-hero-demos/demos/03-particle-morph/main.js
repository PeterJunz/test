// 03 · Particle Morph
// Technique: tens of thousands of GPU points sampled from the surfaces of three
// procedural products (speaker → vase → lamp). A GSAP timeline drives a single
// morph uniform; the vertex shader blends targets, adds curl-ish turbulence during
// transitions and repels particles around the cursor. Card copy swaps with a blur.
import { boot, THREE, gsap, frameCamera, GLSL_NOISE, reducedMotion } from '../../shared/core.js';
import { makeSpeaker, makeVase, makeLamp } from '../../shared/products.js';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';

const SHAPES = [
  { make: makeSpeaker, kicker: 'Audio', name: 'Smart Speaker' },
  { make: makeVase, kicker: 'Décor', name: 'Ceramic Vase' },
  { make: makeLamp, kicker: 'Lighting', name: 'Arc Table Lamp' }
];

/** Sample N points over every mesh of a group, weighted by surface area. */
function samplePoints(group, count) {
  group.updateMatrixWorld(true);
  const meshes = [];
  group.traverse((o) => { if (o.isMesh) meshes.push(o); });
  const areas = meshes.map((m) => {
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry;
    const p = g.attributes.position; let a = 0;
    const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
    for (let i = 0; i < p.count; i += 3) {
      A.fromBufferAttribute(p, i).multiply(m.scale); B.fromBufferAttribute(p, i + 1).multiply(m.scale); C.fromBufferAttribute(p, i + 2).multiply(m.scale);
      a += B.sub(A).cross(C.sub(A)).length() * 0.5;
    }
    return a;
  });
  const total = areas.reduce((s, a) => s + a, 0);
  const out = new Float32Array(count * 3);
  const v = new THREE.Vector3();
  let k = 0;
  meshes.forEach((m, i) => {
    const n = i === meshes.length - 1 ? count - k : Math.round((areas[i] / total) * count);
    const sampler = new MeshSurfaceSampler(m).build();
    for (let j = 0; j < n && k < count; j++, k++) {
      sampler.sample(v);
      v.applyMatrix4(m.matrixWorld);
      out.set([v.x, v.y, v.z], k * 3);
    }
  });
  return out;
}

boot({
  slug: '03-particle-morph',
  renderer: { toneMapping: false },
  setup({ renderer, hero: heroEl, pointer, width, height, small }) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#1D1511');
    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
    camera.position.set(0, 0, 8);

    const COUNT = small ? 14000 : 32000;
    const targets = SHAPES.map((s) => samplePoints(s.make(), COUNT));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(targets[0].slice(), 3));
    geo.setAttribute('aA', new THREE.BufferAttribute(targets[0], 3));
    geo.setAttribute('aB', new THREE.BufferAttribute(targets[1], 3));
    geo.setAttribute('aC', new THREE.BufferAttribute(targets[2], 3));
    const rnd = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) rnd[i] = Math.random();
    geo.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 1));

    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 }, uMorph: { value: 0 }, uScatter: { value: reducedMotion ? 0 : 1 },
        uMouse: { value: new THREE.Vector3(99, 99, 0) }, uSize: { value: small ? 5.5 : 6.5 }, uDpr: { value: renderer.getPixelRatio() }
      },
      vertexShader: /* glsl */`
        attribute vec3 aA; attribute vec3 aB; attribute vec3 aC; attribute float aRnd;
        uniform float uTime, uMorph, uScatter, uSize, uDpr; uniform vec3 uMouse;
        varying float vGlow; varying float vRnd;
        ${GLSL_NOISE}
        void main(){
          float m = uMorph;
          vec3 p = m < 1.0 ? mix(aA, aB, smoothstep(0.0, 1.0, m)) : mix(aB, aC, smoothstep(1.0, 2.0, m));
          if (m >= 2.0) p = mix(aC, aA, smoothstep(2.0, 3.0, m));
          float transit = sin(fract(m) * 3.14159);
          vec3 n = vec3(snoise(p * 0.8 + uTime * 0.3), snoise(p * 0.8 + 11.0 + uTime * 0.3), snoise(p * 0.8 + 23.0));
          p += n * (0.05 + transit * 0.9 + uScatter * 4.0) * (0.4 + aRnd);
          vec4 world = modelMatrix * vec4(p, 1.0);
          vec3 d = world.xyz - uMouse;
          float infl = exp(-dot(d, d) * 1.6);
          world.xyz += normalize(d + 1e-4) * infl * 0.7;
          vec4 mv = viewMatrix * world;
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uSize * uDpr * (0.35 + aRnd * 0.65) / -mv.z;
          vGlow = infl; vRnd = aRnd;
        }`,
      fragmentShader: /* glsl */`
        varying float vGlow; varying float vRnd;
        void main(){
          vec2 c = gl_PointCoord - 0.5; float r = dot(c, c);
          if (r > 0.25) discard;
          float a = smoothstep(0.25, 0.0, r);
          vec3 caramel = vec3(0.78, 0.52, 0.30); vec3 cream = vec3(1.0, 0.9, 0.76); vec3 brass = vec3(0.95, 0.72, 0.42);
          vec3 col = mix(caramel, cream, vRnd);
          col = mix(col, brass * 1.4, vGlow);
          gl_FragColor = vec4(col, a * (0.42 + vGlow * 0.5));
        }`
    });
    const points = new THREE.Points(geo, mat);
    const group = new THREE.Group();
    group.add(points);
    scene.add(group);

    // Parallax dust layer
    const dustGeo = new THREE.BufferGeometry();
    const dust = new Float32Array((small ? 400 : 900) * 3);
    for (let i = 0; i < dust.length; i += 3) dust.set([(Math.random() - 0.5) * 22, (Math.random() - 0.5) * 12, -Math.random() * 10 - 2], i);
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dust, 3));
    const dustPts = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: '#C9A46B', size: 0.03, transparent: true, opacity: 0.5, depthWrite: false }));
    scene.add(dustPts);

    // Morph cycle + card copy swap
    const kicker = heroEl.querySelector('[data-card-kicker]');
    const name = heroEl.querySelector('[data-card-name]');
    const swapCard = (i) => {
      const s = SHAPES[i % SHAPES.length];
      gsap.timeline()
        .to([kicker, name], { filter: 'blur(8px)', opacity: 0, y: -6, duration: 0.35, stagger: 0.05 })
        .add(() => { kicker.textContent = s.kicker; name.textContent = s.name; })
        .fromTo([kicker, name], { filter: 'blur(8px)', opacity: 0, y: 8 }, { filter: 'blur(0px)', opacity: 1, y: 0, duration: 0.6, stagger: 0.06, clearProps: 'filter' });
    };
    const cycle = gsap.timeline({ repeat: -1, paused: true });
    [1, 2, 3].forEach((target, i) => {
      cycle.to(mat.uniforms.uMorph, { value: target, duration: 1.8, ease: 'power3.inOut', onStart: () => swapCard(target) }, `+=${i === 0 ? 2.2 : 2.6}`);
    });
    cycle.add(() => { mat.uniforms.uMorph.value = 0; });

    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const hit = new THREE.Vector3();

    const layout = (w, h) => {
      const portrait = frameCamera(camera, w, h, { desktopZ: 8, mobileZ: 12 });
      group.position.set(portrait ? 0 : 2.1, portrait ? 2.9 : 0.25, 0);
      group.scale.setScalar(portrait ? 0.95 : 1.3);
      mat.uniforms.uDpr.value = renderer.getPixelRatio() * (h / 900) * 10;
    };
    layout(width, height);

    return {
      resize: layout,
      intro(tl) {
        tl.fromTo(mat.uniforms.uScatter, { value: 1 }, { value: 0, duration: 2.6, ease: 'expo.out', onComplete: () => cycle.play() }, 0.1);
      },
      render(t, dt, { scroll }) {
        mat.uniforms.uTime.value = t;
        group.rotation.y = pointer.x * 0.6 + t * 0.12;
        group.rotation.x = -pointer.y * 0.2;
        ndc.set(pointer.x, pointer.y);
        ray.setFromCamera(ndc, camera);
        if (ray.ray.intersectPlane(plane, hit)) mat.uniforms.uMouse.value.lerp(hit, 0.2);
        dustPts.position.x = -pointer.x * 0.6;
        dustPts.position.y = -pointer.y * 0.4 + scroll * 2;
        camera.position.y = -scroll * 2.5;
        renderer.render(scene, camera);
      }
    };
  }
});
