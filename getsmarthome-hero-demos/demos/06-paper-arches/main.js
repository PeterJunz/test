// 06 · Paper Arches
// Technique: stacked paper-cut arch frames (custom Shape geometry) casting soft
// shadows on each other. Each layer has its own dissolve uniform injected via
// onBeforeCompile (noise threshold + glowing burn edge); GSAP reveals the layers
// back-to-front. Strong per-layer pointer parallax + a cursor spotlight on the wall.
import { boot, THREE, frameCamera, addEnvironment, GLSL_NOISE, reducedMotion } from '../../shared/core.js';
import { makeVase, warmLights } from '../../shared/products.js';

function archShape(W, H, w, springY) {
  const s = new THREE.Shape();
  s.moveTo(-W / 2, -H / 2);
  s.lineTo(-W / 2, H / 2);
  s.lineTo(W / 2, H / 2);
  s.lineTo(W / 2, -H / 2);
  s.lineTo(w / 2, -H / 2);
  s.lineTo(w / 2, springY);
  s.absarc(0, springY, w / 2, 0, Math.PI, false);
  s.lineTo(-w / 2, -H / 2);
  s.lineTo(-W / 2, -H / 2);
  return s;
}

function dissolveMaterial(color) {
  const uniforms = { uProgress: { value: reducedMotion ? 1 : 0 } };
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.92, side: THREE.DoubleSide });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uProgress = uniforms.uProgress;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vWPos; uniform float uProgress;\n${GLSL_NOISE}`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        float n = snoise(vWPos * 1.6) * 0.5 + 0.5;
        float edge = uProgress * 1.15 - n;
        if (edge < 0.0) discard;
        gl_FragColor.rgb += vec3(1.0, 0.62, 0.3) * smoothstep(0.08, 0.0, edge) * (1.0 - step(1.0, uProgress)) * 1.4;`);
  };
  mat.customProgramCacheKey = () => 'dissolve';
  mat.userData.uniforms = uniforms;
  return mat;
}

boot({
  slug: '06-paper-arches',
  renderer: { shadows: true },
  setup({ renderer, pointer, width, height }) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#EADBC8');
    const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 100);
    camera.position.set(0, 0.2, 13);
    addEnvironment(renderer, scene, 0.35);
    const { key } = warmLights(scene, { shadows: true, intensity: 0.9 });
    key.position.set(-3, 5, 8);
    const spot = new THREE.SpotLight('#ffc27e', 40, 25, Math.PI / 10, 0.8, 1.4);
    spot.position.set(0, 2, 9);
    scene.add(spot, spot.target);

    const group = new THREE.Group();
    scene.add(group);

    const COLORS = ['#F3E7D7', '#EBD5BB', '#DFBC98', '#CF9A72', '#B9724C'];
    const layers = COLORS.map((c, i) => {
      const W = 30, H = 18;
      const w = 3.1 - i * 0.36;
      const geo = new THREE.ShapeGeometry(archShape(W, H, w, -0.2 + i * -0.12), 48);
      const mesh = new THREE.Mesh(geo, dissolveMaterial(c));
      mesh.position.z = -i * 0.9;
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.userData.depth = 1 - i / COLORS.length;
      group.add(mesh);
      return mesh;
    });

    const wall = new THREE.Mesh(new THREE.PlaneGeometry(30, 18), new THREE.MeshStandardMaterial({ color: '#A85F3E', roughness: 1 }));
    wall.position.z = -COLORS.length * 0.9 - 0.4;
    wall.receiveShadow = true;
    group.add(wall);

    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.5, 64), new THREE.MeshStandardMaterial({ color: '#F1E4D2', roughness: 0.8 }));
    plinth.position.set(0, -3.0, wall.position.z + 1.2);
    plinth.castShadow = plinth.receiveShadow = true;
    const vase = makeVase({ color: '#E9DCC8' });
    vase.scale.setScalar(0.85);
    vase.position.set(0, -1.9, wall.position.z + 1.2);
    group.add(plinth, vase);

    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const hit = new THREE.Vector3();
    const wallPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -wall.position.z);
    let portrait = false;

    const layout = (w, h) => {
      portrait = frameCamera(camera, w, h, { desktopZ: 13, mobileZ: 21 });
      group.position.set(portrait ? 0 : 3.2, portrait ? 4.4 : 1.0, 0);
      group.scale.setScalar(portrait ? 0.9 : 1);
    };
    layout(width, height);

    return {
      resize: layout,
      intro(tl) {
        [...layers].reverse().forEach((m, i) => {
          tl.fromTo(m.material.userData.uniforms.uProgress, { value: 0 }, { value: 1, duration: 1.6, ease: 'power2.inOut' }, 0.1 + i * 0.22);
        });
        tl.from(vase.position, { y: '-=1.2', duration: 1.8, ease: 'expo.out' }, 0.6);
      },
      render(t, dt, { scroll }) {
        // Deep parallax: front layers travel further than back layers
        layers.forEach((m) => {
          m.position.x = pointer.x * 0.55 * m.userData.depth;
          m.position.y = pointer.y * 0.3 * m.userData.depth;
        });
        group.rotation.y = pointer.x * 0.08;
        group.rotation.x = -pointer.y * 0.04;
        vase.rotation.y = t * 0.2;
        ndc.set(pointer.x, pointer.y);
        ray.setFromCamera(ndc, camera);
        wallPlane.constant = -(group.position.z + wall.position.z);
        if (ray.ray.intersectPlane(wallPlane, hit)) spot.target.position.lerp(hit, 0.1);
        camera.position.y = 0.2 - scroll * 3;
        camera.lookAt(0, (portrait ? 2.2 : 0) - scroll * 3, 0);
        renderer.render(scene, camera);
      }
    };
  }
});
