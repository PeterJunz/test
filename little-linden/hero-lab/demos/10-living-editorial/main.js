// 10 · Living Editorial Scene
// Technique: a layered nursery-shelf diorama — wall with a projected window-light
// patch (GLSL in an onBeforeCompile-patched material), wall shelf with props, a
// hanging decorative mobile that turns slowly on its strings, a rug and a foreground
// plant layer. The camera dollies and pans with page scroll (scroll-linked), the
// pointer adds tilt/parallax, and soft shadows ground every layer.
// Note: decorative wall scene only — no crib or sleep setup is depicted.
import { boot, THREE, frameCamera, addEnvironment, GLSL_NOISE, reducedMotion } from '../../shared/core.js';
import { makeRingStacker, makeBlocks, makeBottle, makeMoon, makeCloudLight, softLights, mat } from '../../shared/props.js';

boot({
  slug: '10-living-editorial',
  renderer: { shadows: true },
  setup({ renderer, pointer, width, height }) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#E7EBE3');
    const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 100);
    camera.position.set(0, 0.8, 13);
    addEnvironment(renderer, scene, 0.35);
    const { key } = softLights(scene, { shadows: true, intensity: 0.85 });
    key.position.set(-6, 5, 6);

    const room = new THREE.Group();
    scene.add(room);

    // Wall with window-light patch + leaf shadows
    const light = { uTime: { value: 0 }, uShift: { value: new THREE.Vector2() }, uOn: { value: reducedMotion ? 1 : 0 } };
    const wallMat = new THREE.MeshStandardMaterial({ color: '#E9EDE4', roughness: 1 });
    wallMat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, light);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vW; uniform float uTime, uOn; uniform vec2 uShift;\n${GLSL_NOISE}`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          vec2 p = vW.xy + uShift; p.x += p.y * 0.4;
          vec2 c = p - vec2(-3.2, 1.6);
          float win = smoothstep(1.6, 1.45, abs(c.x)) * smoothstep(1.9, 1.75, abs(c.y)) * smoothstep(0.02, 0.07, abs(c.x)) * smoothstep(0.02, 0.07, abs(c.y));
          float leaf = smoothstep(-0.2, 0.35, snoise(vec3(p * 1.1, uTime * 0.1)) + 0.25);
          totalEmissiveRadiance += vec3(1.0, 0.86, 0.68) * win * mix(0.45, 1.0, leaf) * 0.32 * uOn;`);
    };
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(30, 16), wallMat);
    wall.position.set(0, 2, -3);
    wall.receiveShadow = true;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 14), new THREE.MeshStandardMaterial({ color: '#D8C9B8', roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -2.6, 2);
    floor.receiveShadow = true;
    const rug = new THREE.Mesh(new THREE.CircleGeometry(3.2, 96), mat.fabric('#F1E8DC'));
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(1.5, -2.58, 1.2);
    rug.receiveShadow = true;
    room.add(wall, floor, rug);

    // Wall shelf with props (layer 2)
    const shelfGroup = new THREE.Group();
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.14, 1.0), mat.wood('#D2B48F'));
    shelf.castShadow = shelf.receiveShadow = true;
    shelfGroup.add(shelf);
    const stacker = makeRingStacker(); stacker.scale.setScalar(0.62); stacker.position.set(-1.5, 0.68, 0);
    const blocks = makeBlocks(); blocks.scale.setScalar(0.48); blocks.position.set(0.1, 0.55, 0);
    const bottle = makeBottle(); bottle.scale.setScalar(0.5); bottle.position.set(1.6, 0.58, 0);
    shelfGroup.add(stacker, blocks, bottle);
    shelfGroup.position.set(1.8, -0.3, -2.4);
    room.add(shelfGroup);

    // Hanging decorative mobile (layer 3)
    const mobile = new THREE.Group();
    const bar = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.03, 8, 96), mat.wood('#CFAE86'));
    bar.rotation.x = Math.PI / 2;
    mobile.add(bar);
    const stringMat = new THREE.LineBasicMaterial({ color: '#B7A99A' });
    const hangers = [];
    const items = [() => { const m = makeMoon(); m.scale.setScalar(0.32); return m; }, () => { const c = makeCloudLight(); c.children.forEach((o) => { if (o.isLight) o.visible = false; }); c.scale.setScalar(0.28); return c; },
      () => new THREE.Mesh(new THREE.SphereGeometry(0.16, 32, 16), mat.matte('#D9B2AE')), () => new THREE.Mesh(new THREE.SphereGeometry(0.13, 32, 16), mat.matte('#A9B5A0'))];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const len = 0.9 + (i % 2) * 0.5;
      const h = new THREE.Group();
      h.position.set(Math.cos(a) * 1.1, 0, Math.sin(a) * 1.1);
      const str = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -len, 0)]), stringMat);
      const obj = items[i]();
      obj.position.y = -len - 0.2;
      obj.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      h.add(str, obj);
      h.userData.phase = i;
      mobile.add(h);
      hangers.push(h);
    }
    const topString = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 3, 0)]), stringMat);
    mobile.add(topString);
    mobile.position.set(2.0, 3.0, -0.6);
    room.add(mobile);

    // Foreground plant silhouette (layer 4 — strongest parallax)
    const plant = new THREE.Group();
    const leafGeo = new THREE.SphereGeometry(0.5, 24, 16);
    leafGeo.scale(0.35, 1, 0.08);
    for (let i = 0; i < 9; i++) {
      const leaf = new THREE.Mesh(leafGeo, new THREE.MeshStandardMaterial({ color: i % 2 ? '#8E9C86' : '#A9B5A0', roughness: 0.8 }));
      leaf.position.set(Math.sin(i * 1.7) * 0.4, i * 0.28, Math.cos(i * 1.7) * 0.2);
      leaf.rotation.set(0.2, i * 0.7, Math.sin(i) * 0.6);
      leaf.castShadow = true;
      plant.add(leaf);
    }
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.35, 0.8, 48), mat.matte('#D9B2AE'));
    pot.position.y = -0.4;
    pot.castShadow = true;
    plant.add(pot);
    plant.position.set(5.2, -2.2, 2.4);
    room.add(plant);

    let portrait = false;
    const layout = (w, h) => {
      portrait = frameCamera(camera, w, h, { desktopZ: 13, mobileZ: 19 });
      room.position.set(portrait ? -1.8 : 0.6, portrait ? 2.6 : 0, 0);
    };
    layout(width, height);

    return {
      scene,
      resize: layout,
      intro(tl) {
        tl.to(light.uOn, { value: 1, duration: 2.4, ease: 'power2.inOut' }, 0.2)
          .from(mobile.position, { y: 6, duration: 2.2, ease: 'expo.out' }, 0.4)
          .from(shelfGroup.position, { z: -6, duration: 2, ease: 'expo.out' }, 0.2)
          .from(plant.position, { x: 9, duration: 2.2, ease: 'expo.out' }, 0.5);
      },
      render(t, dt, { scroll }) {
        light.uTime.value = t;
        // Mobile turns slowly; each hanger sways on its own phase
        mobile.rotation.y = t * 0.12;
        hangers.forEach((h) => { h.rotation.z = Math.sin(t * 0.7 + h.userData.phase) * 0.06; h.rotation.x = Math.cos(t * 0.6 + h.userData.phase) * 0.05; });
        // Scroll-linked dolly + pointer parallax
        const s = scroll;
        camera.position.x = pointer.x * 0.6 + s * 2.4;
        camera.position.y = (portrait ? 2.2 : 0.8) + pointer.y * 0.35 + s * 0.6;
        camera.position.z = (portrait ? 19 : 13) - s * 5;
        camera.lookAt((portrait ? 0.2 : 1.2) + s * 1.5, (portrait ? 1.0 : 0.6) - s * 0.5, -1.5);
        plant.position.x = 5.2 - pointer.x * 0.5;
        light.uShift.value.set(pointer.x * 0.4, pointer.y * 0.2);
        renderer.render(scene, camera);
      }
    };
  }
});
