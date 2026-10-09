// 10 · Wood Mosaic
// Technique: a single InstancedMesh of walnut / oak / travertine tiles (one draw
// call). Heights are computed on the GPU (onBeforeCompile): a slow travelling swell,
// a cursor "bump" that rises under the pointer, a radial intro cascade and a pulse
// wave triggered from the product card (GSAP). A diffuser floats above with tilt,
// a cursor spotlight rakes across the tiles.
import { boot, THREE, gsap, frameCamera, addEnvironment, reducedMotion } from '../../shared/core.js';
import { makeDiffuser, warmLights } from '../../shared/products.js';

boot({
  slug: '10-wood-mosaic',
  renderer: { shadows: true },
  setup({ renderer, hero: heroEl, pointer, width, height, small }) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#1D1511');
    scene.fog = new THREE.Fog('#1D1511', 14, 30);
    const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 100);
    camera.position.set(0, 9, 11);
    addEnvironment(renderer, scene, 0.35);
    const { key } = warmLights(scene, { shadows: true, intensity: 0.55 });
    key.position.set(-5, 9, 4);
    const spot = new THREE.SpotLight('#ffbf80', 70, 22, Math.PI / 9, 0.7, 1.5);
    spot.position.set(0, 9, 2);
    scene.add(spot, spot.target);

    // ---------- Tiles
    const COLS = small ? 22 : 40, ROWS = small ? 26 : 24, SIZE = 0.48, GAP = 0.05;
    const count = COLS * ROWS;
    const uniforms = { uTime: { value: 0 }, uMouse: { value: new THREE.Vector2(99, 99) }, uIntro: { value: reducedMotion ? 40 : 0 }, uPulse: { value: -1 } };
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0 });
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
          uniform float uTime; uniform vec2 uMouse; uniform float uIntro; uniform float uPulse;
          float tileHeight(vec2 c){
            float d = length(c);
            float swell = sin(c.x * 0.45 + uTime * 0.6) * 0.18 + sin(c.y * 0.6 - uTime * 0.45) * 0.14;
            vec2 m = c - uMouse;
            float bump = exp(-dot(m, m) * 0.35) * 1.15;
            float pulse = uPulse > 0.0 ? exp(-pow(d - uPulse, 2.0) * 2.0) * 0.8 : 0.0;
            float drop = (1.0 - smoothstep(uIntro - 2.5, uIntro, d)) ;
            return (swell + bump + pulse) * drop - (1.0 - drop) * 6.0;
          }`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vec2 tileCenter = vec2(instanceMatrix[3].x, instanceMatrix[3].z);
          transformed.y += tileHeight(tileCenter);`);
    };
    const tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(SIZE, 1.2, SIZE), mat, count);
    tiles.receiveShadow = true;
    const PALETTE = ['#4A3021', '#5B3B27', '#6E4A33', '#86593C', '#A87650', '#C9A27A'];
    const WEIGHTS = [0.24, 0.26, 0.2, 0.15, 0.1, 0.05];
    const m4 = new THREE.Matrix4();
    const col = new THREE.Color();
    let i = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++, i++) {
        m4.makeTranslation((c - COLS / 2) * (SIZE + GAP), -0.6, (r - ROWS / 2) * (SIZE + GAP));
        tiles.setMatrixAt(i, m4);
        let x = Math.random(), k = 0;
        while (x > WEIGHTS[k] && k < WEIGHTS.length - 1) { x -= WEIGHTS[k]; k++; }
        tiles.setColorAt(i, col.set(PALETTE[k]).offsetHSL(0, 0, (Math.random() - 0.5) * 0.04));
      }
    }
    const grid = new THREE.Group();
    grid.add(tiles);
    scene.add(grid);

    // ---------- Product
    const product = makeDiffuser();
    product.scale.setScalar(1.1);
    product.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(product);

    // Card hover sends a pulse ring across the mosaic
    heroEl.querySelector('[data-card]').addEventListener('pointerenter', () => {
      gsap.fromTo(uniforms.uPulse, { value: 0 }, { value: 16, duration: 2.6, ease: 'power1.out', onComplete: () => { uniforms.uPulse.value = -1; } });
    });

    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const hit = new THREE.Vector3();
    const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const local = new THREE.Vector3();
    let portrait = false;

    const layout = (w, h) => {
      portrait = frameCamera(camera, w, h, { desktopZ: 11, mobileZ: 15 });
      product.position.set(portrait ? 0 : 3.2, portrait ? 2.6 : 2.4, portrait ? -6 : 0.5);
      grid.position.set(portrait ? 0 : 1.5, 0, portrait ? -5 : 0);
      scene.fog.near = portrait ? 20 : 14;
      scene.fog.far = portrait ? 44 : 30;
      product.scale.setScalar(portrait ? 1.35 : 1.1);
    };
    layout(width, height);

    return {
      resize: layout,
      intro(tl) {
        tl.fromTo(uniforms.uIntro, { value: 0 }, { value: 40, duration: 3.4, ease: 'power2.in' }, 0.1)
          .from(product.rotation, { y: -3, duration: 2.6, ease: 'expo.out' }, 0.9);
      },
      render(t, dt, { scroll }) {
        uniforms.uTime.value = t;
        // Cursor → world point on the mosaic (in grid-local coordinates)
        ndc.set(pointer.x, pointer.y);
        ray.setFromCamera(ndc, camera);
        if (ray.ray.intersectPlane(floorPlane, hit)) {
          local.copy(hit);
          grid.worldToLocal(local);
          uniforms.uMouse.value.lerp(new THREE.Vector2(local.x, local.z), 0.12);
          spot.target.position.lerp(hit, 0.1);
        }
        // Tilt + float
        grid.rotation.y = pointer.x * 0.08;
        product.rotation.y += dt * 0.35;
        product.rotation.z = -pointer.x * 0.12;
        product.rotation.x = pointer.y * 0.1;
        product.position.y += ((portrait ? 2.6 : 2.4) + Math.sin(t * 1.1) * 0.12 - product.position.y) * 0.05;
        camera.position.x = pointer.x * 0.6;
        camera.position.y = (portrait ? 14 : 9) + pointer.y * 0.4 - scroll * 3;
        camera.lookAt(portrait ? 0 : 1.2, (portrait ? 0.2 : 0.4) - scroll * 3, portrait ? -3.5 : 0);
        renderer.render(scene, camera);
      }
    };
  }
});
