// 04 · Glass & Light
// Technique: MeshPhysicalMaterial transmission (IOR, thickness, attenuation) refracting
// an animated GLSL bokeh backdrop that lives *inside* the scene, so the glass bends it.
// A warm point light rides the cursor to sweep highlights (spotlight); the trio
// tilts with the pointer and the bokeh layer parallaxes behind.
import { boot, THREE, frameCamera, addEnvironment, reducedMotion } from '../../shared/core.js';
import { makeCandle, materials } from '../../shared/products.js';

boot({
  slug: '04-glass-refraction',
  setup({ renderer, pointer, width, height, small }) {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 100);
    camera.position.set(0, 0.4, 10);
    addEnvironment(renderer, scene, 0.7);
    scene.add(new THREE.HemisphereLight('#fff1df', '#8a5a3c', 0.8));
    const key = new THREE.DirectionalLight('#ffd6a3', 1.8);
    key.position.set(3, 5, 4);
    scene.add(key);
    const cursorLight = new THREE.PointLight('#ffb366', 18, 7, 1.6);
    scene.add(cursorLight);

    // --- Bokeh backdrop (a real plane, so transmission can refract it)
    const bokeh = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uFade: { value: reducedMotion ? 1 : 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: /* glsl */`
        varying vec2 vUv; uniform float uTime, uFade;
        float hash(float n){ return fract(sin(n) * 43758.5453); }
        void main(){
          vec2 uv = vUv * vec2(2.0, 1.0);
          vec3 col = mix(vec3(0.62, 0.40, 0.25), vec3(0.96, 0.88, 0.78), smoothstep(0.05, 0.95, vUv.y));
          col = mix(col, vec3(0.45, 0.27, 0.16), smoothstep(0.6, 0.0, length((vUv - vec2(0.62, 0.42)) * vec2(2.0, 1.0))) * 0.55);
          for (int i = 0; i < 26; i++) {
            float fi = float(i);
            vec2 c = vec2(hash(fi * 3.1) * 2.0, hash(fi * 7.7));
            c += vec2(sin(uTime * 0.12 + fi), cos(uTime * 0.1 + fi * 1.3)) * 0.06;
            float r = 0.04 + hash(fi * 1.9) * 0.12;
            float d = length(uv - c);
            float disc = smoothstep(r, r * 0.82, d) * (0.6 + 0.4 * smoothstep(r * 0.6, r, d));
            vec3 tint = mix(vec3(1.0, 0.72, 0.42), vec3(1.0, 0.88, 0.7), hash(fi * 5.3));
            col += tint * disc * 0.32;
          }
          // warm window stripes
          col += vec3(1.0, 0.8, 0.55) * 0.08 * smoothstep(0.0, 1.0, sin(uv.x * 9.0 + 1.2)) * smoothstep(0.2, 1.0, vUv.y);
          gl_FragColor = vec4(mix(vec3(0.95, 0.91, 0.86), col, uFade), 1.0);
        }`
    });
    const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(36, 18), bokeh);
    backdrop.position.z = -6;
    scene.add(backdrop);

    // --- Glass trio
    const group = new THREE.Group();
    // Fluted walnut panel behind the glass: high-contrast slats make refraction legible
    const SLATS = 26;
    const slatGeo = new THREE.CylinderGeometry(0.09, 0.09, 3.0, 16, 1, false, 0, Math.PI);
    const slats = new THREE.InstancedMesh(slatGeo, new THREE.MeshStandardMaterial({ color: '#6b4430', roughness: 0.6 }), SLATS);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < SLATS; i++) {
      m4.makeRotationY(-Math.PI / 2);
      m4.setPosition((i - SLATS / 2) * 0.19, 0.4, -1.6);
      slats.setMatrixAt(i, m4);
    }
    const panelBack = new THREE.Mesh(new THREE.PlaneGeometry(SLATS * 0.19 + 0.2, 3.0), new THREE.MeshStandardMaterial({ color: '#4a2e1f', roughness: 0.8 }));
    panelBack.position.set(-0.09, 0.4, -1.7);
    group.add(slats, panelBack);
    const candle = makeCandle();
    const carafe = new THREE.Mesh(
      new THREE.LatheGeometry(new THREE.SplineCurve([
        new THREE.Vector2(0.001, -1), new THREE.Vector2(0.62, -1), new THREE.Vector2(0.7, -0.6),
        new THREE.Vector2(0.6, 0.0), new THREE.Vector2(0.24, 0.55), new THREE.Vector2(0.2, 1.1), new THREE.Vector2(0.26, 1.2)
      ]).getPoints(80), 96),
      materials.glass()
    );
    carafe.material.thickness = 0.6;
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.55, 64, 32), Object.assign(materials.glass(), { thickness: 1.1, iridescence: 0.35, iridescenceIOR: 1.3 }));
    candle.position.set(-1.25, -0.25, 0.3);
    candle.scale.setScalar(0.8);
    carafe.position.set(0.55, 0.05, -0.2);
    carafe.scale.setScalar(1.05);
    orb.position.set(1.85, -0.55, 0.6);
    const tray = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.7, 0.08, 96), materials.brass());
    tray.position.y = -1.12;
    tray.scale.z = 0.55;
    group.add(candle, carafe, orb, tray);
    scene.add(group);

    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -1.5);
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const hit = new THREE.Vector3();

    const layout = (w, h) => {
      const portrait = frameCamera(camera, w, h, { desktopZ: 10, mobileZ: 15 });
      group.position.set(portrait ? 0 : 2.0, portrait ? 2.6 : 0.55, 0);
      group.scale.setScalar(portrait ? 0.85 : 0.9);
      renderer.transmissionResolutionScale = small ? 0.5 : 1;
    };
    layout(width, height);

    return {
      resize: layout,
      intro(tl) {
        tl.to(bokeh.uniforms.uFade, { value: 1, duration: 2.4, ease: 'power2.out' }, 0)
          .from([candle.position, carafe.position, orb.position], { y: '-=2.5', duration: 2, stagger: 0.12, ease: 'expo.out' }, 0.3)
          .from(cursorLight, { intensity: 0, duration: 2 }, 0.8);
      },
      render(t, dt, { scroll }) {
        bokeh.uniforms.uTime.value = t;
        group.rotation.y = pointer.x * 0.35;
        group.rotation.x = -pointer.y * 0.1;
        orb.position.y = -0.55 + Math.sin(t * 1.1) * 0.08;
        candle.userData.flame.scale.y = 1 + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3) * 0.05;
        candle.userData.light.intensity = 2 + Math.sin(t * 11) * 0.25;
        ndc.set(pointer.x, pointer.y);
        ray.setFromCamera(ndc, camera);
        if (ray.ray.intersectPlane(plane, hit)) cursorLight.position.lerp(hit, 0.15);
        backdrop.position.x = -pointer.x * 1.2;
        backdrop.position.y = -pointer.y * 0.6 + scroll * 3;
        camera.position.y = 0.4 - scroll * 2;
        camera.lookAt(0, 0.2 - scroll * 2, 0);
        renderer.render(scene, camera);
      }
    };
  }
});
