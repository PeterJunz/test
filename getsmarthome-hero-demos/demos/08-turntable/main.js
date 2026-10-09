// 08 · Turntable
// Technique: three products on a walnut turntable over a real-time mirrored floor
// (Reflector render pass + translucent satin overlay). A GSAP timeline rotates the
// turntable 120° every few seconds (or on click / arrow keys), swapping the card copy
// with a blur transition. Camera tilts with the pointer; a spotlight tracks the hero.
import { boot, THREE, gsap, frameCamera, addEnvironment, reducedMotion } from '../../shared/core.js';
import { makeLamp, makeSpeaker, makeDiffuser, materials, warmLights } from '../../shared/products.js';
import { Reflector } from 'three/addons/objects/Reflector.js';

const ITEMS = [
  { make: makeLamp, kicker: 'Lighting', name: 'Arc Table Lamp' },
  { make: makeSpeaker, kicker: 'Audio', name: 'Smart Speaker' },
  { make: makeDiffuser, kicker: 'Wellness', name: 'Aroma Diffuser' }
];

boot({
  slug: '08-turntable',
  setup({ renderer, canvas, hero: heroEl, pointer, width, height, small }) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#EADCCB');
    scene.fog = new THREE.Fog('#EADCCB', 12, 26);
    const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 100);
    camera.position.set(0, 2.2, 11);
    addEnvironment(renderer, scene, 0.5);
    warmLights(scene, { intensity: 0.85 });
    const spot = new THREE.SpotLight('#ffd3a0', 45, 18, Math.PI / 9, 0.7, 1.4);
    spot.position.set(0, 7, 4);
    scene.add(spot, spot.target);

    const stage = new THREE.Group();
    scene.add(stage);

    // Mirror floor + satin overlay
    const dpr = renderer.getPixelRatio();
    const mirror = new Reflector(new THREE.CircleGeometry(9, 96), {
      textureWidth: width * dpr * (small ? 0.35 : 0.5), textureHeight: height * dpr * (small ? 0.35 : 0.5), color: 0xb9a48c, clipBias: 0.003
    });
    mirror.rotation.x = -Math.PI / 2;
    mirror.position.y = -1.36;
    const satin = new THREE.Mesh(new THREE.CircleGeometry(9, 96), new THREE.MeshStandardMaterial({ color: '#E7D5BF', roughness: 0.6, transparent: true, opacity: 0.72 }));
    satin.rotation.x = -Math.PI / 2;
    satin.position.y = -1.35;
    stage.add(mirror, satin);

    // Turntable
    const table = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.2, 0.22, 128), materials.walnut());
    disc.position.y = -1.22;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(3.15, 0.03, 12, 160), materials.brass());
    rim.rotation.x = Math.PI / 2;
    rim.position.y = -1.11;
    table.add(disc, rim);
    const products = ITEMS.map((it, i) => {
      const g = it.make();
      const a = (i / ITEMS.length) * Math.PI * 2;
      g.position.set(Math.sin(a) * 1.9, -0.08, Math.cos(a) * 1.9);
      g.rotation.y = a;
      g.scale.setScalar(0.95);
      table.add(g);
      return g;
    });
    stage.add(table);

    // Step animation
    let index = 0;
    let angle = 0;
    const kicker = heroEl.querySelector('[data-card-kicker]');
    const name = heroEl.querySelector('[data-card-name]');
    const go = (dir = 1) => {
      index = (index + dir + ITEMS.length) % ITEMS.length;
      const it = ITEMS[index];
      angle -= dir * (Math.PI * 2 / ITEMS.length);   // cumulative, so it always turns the short way
      gsap.to(table.rotation, { y: angle, duration: reducedMotion ? 0 : 1.6, ease: 'expo.inOut', overwrite: true });
      gsap.timeline()
        .to([kicker, name], { opacity: 0, filter: 'blur(8px)', y: -6, duration: 0.3 })
        .add(() => { kicker.textContent = it.kicker; name.textContent = it.name; })
        .to([kicker, name], { opacity: 1, filter: 'blur(0px)', y: 0, duration: 0.6, stagger: 0.06, clearProps: 'filter' });
    };
    let auto = reducedMotion ? null : gsap.delayedCall(4.2, function tick() { go(1); auto = gsap.delayedCall(4.2, tick); });
    canvas.addEventListener('click', () => { if (auto) auto.restart(true); go(1); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    });
    const card = heroEl.querySelector('[data-card]');
    card.addEventListener('pointerenter', () => auto && auto.pause());
    card.addEventListener('pointerleave', () => auto && auto.resume());

    let portrait = false;
    const layout = (w, h) => {
      portrait = frameCamera(camera, w, h, { desktopZ: 15, mobileZ: 21 });
      stage.position.set(portrait ? 0 : 3.3, portrait ? 5.0 : 1.1, 0);
      stage.scale.setScalar(portrait ? 0.95 : 0.9);
      mirror.getRenderTarget().setSize(w * dpr * (small ? 0.35 : 0.5), h * dpr * (small ? 0.35 : 0.5));
    };
    layout(width, height);

    return {
      resize: layout,
      intro(tl) {
        tl.from(table.rotation, { y: Math.PI * 1.2, duration: 2.8, ease: 'expo.out' }, 0)
          .from(products.map((p) => p.scale), { x: 0.01, y: 0.01, z: 0.01, duration: 1.6, stagger: 0.12, ease: 'back.out(1.6)' }, 0.4);
      },
      render(t, dt, { scroll }) {
        // Pointer tilt orbits the camera slightly
        const r = camera.position.z;
        camera.position.x = Math.sin(pointer.x * 0.25) * r * 0.25;
        camera.position.y = (portrait ? 6.2 : 3.0) + pointer.y * 0.6 - scroll * 3;
        camera.lookAt(stage.position.x * 0.45, (portrait ? 2.8 : 0.2) - scroll * 3, 0);
        // Spotlight follows the front product + cursor
        spot.target.position.set(stage.position.x + pointer.x * 0.8, stage.position.y - 0.5, 1.9 + pointer.y * 0.5);
        products.forEach((p, i) => { p.position.y = -0.08 + Math.sin(t * 1.2 + i * 2) * 0.03; });
        if (products[1].userData.ring) products[1].userData.ring.material.color.setHSL(0.08, 1, 0.65 + Math.sin(t * 2) * 0.08);
        renderer.render(scene, camera);
      }
    };
  }
});
