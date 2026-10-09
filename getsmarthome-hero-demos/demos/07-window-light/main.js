// 07 · Window Light
// Technique: a procedural "gobo" — window frame, half-open blinds and wind-blown leaf
// shadows built from simplex noise — injected into standard materials via
// onBeforeCompile, so the wall and floor are lit by a moving sun pattern. The cursor
// steers the sun (spotlight). Additive sunbeam planes + drifting dust add depth.
import { boot, THREE, frameCamera, addEnvironment, GLSL_NOISE, reducedMotion } from '../../shared/core.js';
import { makeMug, makeCandle, materials } from '../../shared/products.js';

const shared = {
  uTime: { value: 0 },
  uSun: { value: new THREE.Vector2(0, 0) },
  uLight: { value: reducedMotion ? 1 : 0 }
};

const GOBO = /* glsl */`
  uniform float uTime; uniform vec2 uSun; uniform float uLight;
  varying vec3 vWPos;
  ${GLSL_NOISE}
  float gobo(vec2 p){
    p += uSun;
    p.x += p.y * 0.42;                                   // light comes in at an angle
    vec2 c = p - vec2(0.6, 0.9);
    float soft = 0.08;
    float win = smoothstep(1.9 + soft, 1.9 - soft, abs(c.x)) * smoothstep(1.5 + soft, 1.5 - soft, abs(c.y));
    float mull = smoothstep(0.03, 0.09, abs(c.x)) * smoothstep(0.03, 0.09, abs(c.y + 0.1));
    float blinds = mix(1.0, smoothstep(0.25, 0.55, fract(c.y * 3.6)), 0.75);
    float leaves = snoise(vec3(p * 0.9, uTime * 0.12)) + 0.45 * snoise(vec3(p * 2.6 + uTime * 0.25, 2.0));
    leaves = smoothstep(-0.25, 0.35, leaves + 0.25);
    return win * mull * blinds * mix(0.3, 1.0, leaves);
  }`;

function goboMaterial(color, project) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.95 });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, shared);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + GOBO)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += diffuseColor.rgb * vec3(1.0, 0.72, 0.42) * gobo(${project}) * uLight * 2.1;`);
  };
  mat.customProgramCacheKey = () => 'gobo-' + project;
  return mat;
}

boot({
  slug: '07-window-light',
  renderer: { shadows: true },
  setup({ renderer, pointer, width, height, small }) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#E8D7C2');
    const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 100);
    camera.position.set(0, 0.6, 11);
    addEnvironment(renderer, scene, 0.35);
    scene.add(new THREE.HemisphereLight('#fff1e0', '#9c6a48', 0.4));
    const sun = new THREE.DirectionalLight('#ffc98f', 1.6);
    sun.position.set(-6, 6, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -6; sun.shadow.camera.right = 6; sun.shadow.camera.top = 6; sun.shadow.camera.bottom = -6;
    sun.shadow.radius = 5;
    scene.add(sun);

    const room = new THREE.Group();
    scene.add(room);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(20, 12), goboMaterial('#EAD8C1', 'vWPos.xy'));
    wall.position.set(0, 2, -2.5);
    wall.receiveShadow = true;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 10), goboMaterial('#C9A27E', 'vec2(vWPos.x + vWPos.z * 0.9, -vWPos.z * 0.75 + 1.6)'));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -2.2, 2);
    floor.receiveShadow = true;
    room.add(wall, floor);

    // Side table with products
    const table = new THREE.Group();
    const top = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.12, 64), materials.walnut());
    top.position.y = -0.2;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 1.9, 24), materials.walnut());
    leg.position.y = -1.2;
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.75, 0.08, 48), materials.brass());
    foot.position.y = -2.15;
    const mug = makeMug();
    mug.scale.setScalar(0.6);
    mug.position.set(0.55, 0.22, 0.2);
    mug.rotation.y = -2.2;
    const candle = makeCandle();
    candle.scale.setScalar(0.5);
    candle.position.set(-0.6, 0.28, -0.2);
    [top, leg, foot].forEach((m) => { m.castShadow = m.receiveShadow = true; });
    table.add(top, leg, foot, mug, candle);
    room.add(table);

    // Sunbeams (additive, noise-modulated)
    const beamMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: shared,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: /* glsl */`
        varying vec2 vUv; uniform float uTime; uniform float uLight; uniform vec2 uSun;
        void main(){
          float stripes = 0.5 + 0.5 * sin(vUv.x * 26.0 + uSun.x * 6.0);
          float fade = smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.55, vUv.y) * smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.8, vUv.x);
          float flick = 0.85 + 0.15 * sin(uTime * 0.7 + vUv.x * 4.0);
          gl_FragColor = vec4(vec3(1.0, 0.78, 0.5) * stripes * fade * flick * 0.11 * uLight, 1.0);
        }`
    });
    const beams = new THREE.Mesh(new THREE.PlaneGeometry(7, 9), beamMat);
    beams.position.set(-1.5, 2.2, 1.5);
    beams.rotation.set(-0.35, 0.5, 0.75);
    room.add(beams);

    // Dust motes in the light
    const N = small ? 120 : 260;
    const dust = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) dust.set([(Math.random() - 0.5) * 8, Math.random() * 6 - 2, Math.random() * 4 - 1], i * 3);
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dust, 3));
    const motes = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: '#ffe2b8', size: 0.035, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
    room.add(motes);

    let portrait = false;
    const layout = (w, h) => {
      portrait = frameCamera(camera, w, h, { desktopZ: 11, mobileZ: 16 });
      table.position.set(portrait ? 0 : 2.4, portrait ? 5.2 : 0.8, portrait ? -0.5 : 0);
      table.scale.setScalar(portrait ? 0.85 : 1);
      room.position.x = portrait ? 0 : 0.4;
    };
    layout(width, height);

    return {
      resize: layout,
      intro(tl) {
        tl.fromTo(shared.uLight, { value: 0 }, { value: 1, duration: 2.6, ease: 'power2.inOut' }, 0.2)
          .from(sun, { intensity: 0, duration: 2.4, ease: 'power2.inOut' }, 0.2)
          .from(table.position, { y: '-=0.8', duration: 1.8, ease: 'expo.out' }, 0.3);
      },
      render(t, dt, { scroll }) {
        shared.uTime.value = t;
        // Cursor steers the sun: gobo shifts + shadow direction follows
        shared.uSun.value.set(-pointer.x * 0.9, -pointer.y * 0.5);
        sun.position.set(-6 + pointer.x * 2.5, 6 + pointer.y * 1.5, 6);
        // Tilt + parallax
        room.rotation.y = pointer.x * 0.06;
        table.rotation.y = pointer.x * 0.25;
        motes.position.y = (t * 0.05) % 1;
        motes.rotation.y = t * 0.02;
        candle.userData.flame.scale.y = 1 + Math.sin(t * 12) * 0.1;
        camera.position.x = pointer.x * 0.4;
        camera.position.y = 0.6 + pointer.y * 0.25 - scroll * 2.5;
        camera.lookAt(0, (portrait ? 2.6 : 0.2) - scroll * 2.5, 0);
        renderer.render(scene, camera);
      }
    };
  }
});
