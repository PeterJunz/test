// 01 · Golden Hour Studio
// Technique: PBR products on a plinth with soft shadows over a GLSL "golden hour"
// sky gradient (animated sun + film grain). A warm spotlight follows the cursor
// across the floor; GSAP choreographs sunrise, lamp switch-on and camera dolly.
import { boot, THREE, fullscreenQuad, frameCamera, addEnvironment } from '../../shared/core.js';
import { makeLamp, makeVase, makeMug, warmLights } from '../../shared/products.js';

boot({
  slug: '01-golden-hour',
  renderer: { shadows: true },
  setup({ renderer, pointer, width, height }) {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 100);
    camera.position.set(0, 1.1, 9);

    // --- GLSL sky backdrop
    const sky = new THREE.ShaderMaterial({
      depthTest: false, depthWrite: false,
      uniforms: { uTime: { value: 0 }, uSun: { value: new THREE.Vector2(0.72, 0.2) }, uRes: { value: new THREE.Vector2(width, height) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }',
      fragmentShader: /* glsl */`
        varying vec2 vUv; uniform float uTime; uniform vec2 uSun; uniform vec2 uRes;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
        void main(){
          vec2 uv = vUv; float aspect = uRes.x / uRes.y;
          vec3 top = vec3(0.965, 0.918, 0.862);
          vec3 mid = vec3(0.957, 0.808, 0.659);
          vec3 low = vec3(0.886, 0.682, 0.533);
          vec3 col = mix(low, mid, smoothstep(0.0, 0.45, uv.y));
          col = mix(col, top, smoothstep(0.45, 1.0, uv.y));
          vec2 d = (uv - uSun) * vec2(aspect, 1.0);
          float r = length(d);
          col += vec3(1.0, 0.78, 0.5) * 0.55 * exp(-r * 3.2);
          col = mix(col, vec3(1.0, 0.93, 0.8), smoothstep(0.11, 0.09, r));
          col += (hash(uv * uRes + uTime) - 0.5) * 0.035;
          gl_FragColor = vec4(col, 1.0);
        }`
    });
    const skyMesh = fullscreenQuad(sky);
    skyMesh.renderOrder = -10;
    scene.add(skyMesh);

    // --- Lights
    addEnvironment(renderer, scene, 0.5);
    const { key } = warmLights(scene, { shadows: true });
    const spot = new THREE.SpotLight('#ffcf98', 30, 14, Math.PI / 9, 0.6, 1.6);
    spot.position.set(0, 6, 3);
    scene.add(spot, spot.target);

    // --- Set
    const stage = new THREE.Group();
    scene.add(stage);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.22, color: new THREE.Color('#5b3b27') }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.42;
    floor.receiveShadow = true;
    stage.add(floor);

    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.2, 0.42, 96), new THREE.MeshStandardMaterial({ color: '#E9D9C4', roughness: 0.75 }));
    plinth.position.y = -1.21;
    plinth.castShadow = plinth.receiveShadow = true;
    stage.add(plinth);

    const lamp = makeLamp({ glow: 0 });
    lamp.position.set(0.15, 0.0, 0);
    lamp.scale.setScalar(1.0);
    const vase = makeVase();
    vase.scale.setScalar(0.55);
    vase.position.set(-1.25, -0.45, 0.4);
    const mug = makeMug();
    mug.scale.setScalar(0.38);
    mug.position.set(1.25, -0.71, 0.6);
    mug.rotation.y = -0.6;
    stage.add(lamp, vase, mug);
    lamp.userData.light.intensity = 0;

    const target = new THREE.Vector3();
    const layout = (w, h) => {
      const portrait = frameCamera(camera, w, h, { desktopZ: 11.5, mobileZ: 15 });
      stage.position.set(portrait ? 0 : 2.4, portrait ? 4.1 : 0.35, 0);
      stage.scale.setScalar(portrait ? 0.95 : 1);
      stage.userData.portrait = portrait;
      sky.uniforms.uRes.value.set(w, h);
    };
    layout(width, height);

    return {
      resize: layout,
      intro(tl) {
        tl.from(sky.uniforms.uSun.value, { y: -0.15, duration: 3, ease: 'power2.out' }, 0)
          .to(lamp.userData.light, { intensity: 3, duration: 1.6, ease: 'power2.inOut' }, 1.1)
          .to(lamp.children[2].material, { emissiveIntensity: 1.4, duration: 1.6, ease: 'power2.inOut' }, 1.1)
          .from(camera.position, { y: 2.4, duration: 2.6, ease: 'expo.out' }, 0)
          .from(stage.rotation, { y: -0.8, duration: 2.8, ease: 'expo.out' }, 0);
      },
      render(t, dt, { scroll }) {
        sky.uniforms.uTime.value = t;
        // Tilt: stage yaw/pitch follow the pointer; camera parallax
        stage.rotation.y += ((pointer.x * 0.35 + t * 0.0) - stage.rotation.y) * 0.05;
        stage.rotation.x = -pointer.y * 0.05;
        camera.position.x = pointer.x * 0.35;
        camera.position.y = (stage.userData.portrait ? 4.6 : 1.4) + pointer.y * 0.25 - scroll * 1.5;
        camera.lookAt(stage.position.x * 0.35, stage.userData.portrait ? 1.6 : stage.position.y * 0.55, 0);
        // Spotlight follows the cursor across the floor
        target.set(stage.position.x + pointer.x * 3, -1.4, pointer.y * -2);
        spot.target.position.lerp(target, 0.08);
        key.position.x = 4 + Math.sin(t * 0.2) * 0.8;
        renderer.render(scene, camera);
      }
    };
  }
});
