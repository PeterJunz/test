// 01 · Soft Organic 3D
// Technique: soft sculptural pebbles (vertex-perturbed spheres with sheen) and a ring
// stacker in a warm studio with soft PCF shadows on a shadow-catcher floor. A GLSL
// backdrop paints window light that slides with the cursor (light beam), the key
// light follows the pointer, and every form floats on its own slow sine phase.
import { boot, THREE, fullscreenQuad, frameCamera, addEnvironment } from '../../shared/core.js';
import { makePebble, makeRingStacker, softLights } from '../../shared/props.js';

boot({
  slug: '01-soft-organic',
  renderer: { shadows: true },
  setup({ renderer, pointer, width, height }) {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 100);
    camera.position.set(0, 1.2, 12);
    addEnvironment(renderer, scene, 0.4);
    const { key } = softLights(scene, { shadows: true });

    // Backdrop with a soft window-light patch (moves with the cursor)
    const bg = new THREE.ShaderMaterial({
      depthTest: false, depthWrite: false,
      uniforms: { uRes: { value: new THREE.Vector2(width, height) }, uLight: { value: new THREE.Vector2(0.62, 0.62) }, uFade: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }',
      fragmentShader: /* glsl */`
        varying vec2 vUv; uniform vec2 uRes, uLight; uniform float uFade;
        float box(vec2 p, vec2 c, vec2 s, float soft){ vec2 d = abs(p - c) - s; return 1.0 - smoothstep(0.0, soft, max(d.x, d.y)); }
        void main(){
          vec2 uv = vUv; float a = uRes.x / uRes.y;
          vec3 col = mix(vec3(0.945, 0.910, 0.862), vec3(0.980, 0.968, 0.949), smoothstep(0.0, 0.9, uv.y));
          // skewed window panes of light
          vec2 p = vec2(uv.x * a, uv.y); p.x += p.y * 0.35;
          vec2 c = vec2(uLight.x * a, uLight.y);
          float w = box(p, c + vec2(-0.16, 0.0), vec2(0.13, 0.22), 0.09) + box(p, c + vec2(0.16, 0.0), vec2(0.13, 0.22), 0.09);
          col += vec3(1.0, 0.93, 0.84) * w * 0.12 * uFade;
          col = mix(col, vec3(0.93, 0.86, 0.82), smoothstep(0.55, 1.2, length((uv - vec2(0.5, 0.2)) * vec2(a, 1.0))) * 0.35);
          gl_FragColor = vec4(col, 1.0);
        }`
    });
    const bgMesh = fullscreenQuad(bg);
    bgMesh.renderOrder = -10;
    scene.add(bgMesh);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.16, color: new THREE.Color('#6E6155') }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.6;
    floor.receiveShadow = true;

    const group = new THREE.Group();
    const pebbles = [
      makePebble('#E9D3CC', 1), makePebble('#C9D3C1', 2.4), makePebble('#F1E8DC', 3.7), makePebble('#D9B2AE', 5.1)
    ];
    const layout0 = [[-1.6, -1.05, 0.4, 0.75], [1.5, -1.15, -0.4, 0.62], [0.1, -1.1, 0.9, 0.95], [-1.1, 0.2, -1.8, 0.5]];
    pebbles.forEach((p, i) => {
      const [x, y, z, s] = layout0[i];
      p.position.set(x, y, z);
      p.scale.setScalar(s);
      p.userData.base = y;
      group.add(p);
    });
    const stacker = makeRingStacker();
    stacker.scale.setScalar(0.85);
    stacker.position.set(0.1, 0.42, 0.9);
    stacker.userData.base = 0.42;
    group.add(stacker);
    group.add(floor);
    scene.add(group);

    const floaters = [...pebbles, stacker];
    let portrait = false;
    const layout = (w, h) => {
      portrait = frameCamera(camera, w, h, { desktopZ: 12, mobileZ: 17 });
      group.position.set(portrait ? 0 : 2.6, portrait ? 4.6 : 0.6, 0);
      group.scale.setScalar(portrait ? 0.72 : 1);
      bg.uniforms.uRes.value.set(w, h);
    };
    layout(width, height);

    return {
      scene,
      resize: layout,
      intro(tl) {
        tl.fromTo(bg.uniforms.uFade, { value: 0 }, { value: 1, duration: 2.2, ease: 'power2.out' }, 0.2);
        floaters.forEach((f, i) => tl.from(f.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 1.6, ease: 'back.out(1.4)' }, 0.25 + i * 0.12));
      },
      render(t, dt, { scroll }) {
        floaters.forEach((f, i) => {
          f.position.y = f.userData.base + Math.sin(t * 0.6 + i * 1.7) * (f === stacker ? 0.05 : 0.08);
          f.rotation.y = Math.sin(t * 0.25 + i) * 0.25;
        });
        // Tilt + parallax
        group.rotation.y = pointer.x * 0.28;
        group.rotation.x = -pointer.y * 0.06;
        camera.position.x = pointer.x * 0.4;
        camera.position.y = (portrait ? 2.6 : 1.2) + pointer.y * 0.3 - scroll * 2.4;
        camera.lookAt(0, (portrait ? 2.2 : 0.1) - scroll * 2.4, 0);
        // Window light follows the cursor (backdrop + real key light)
        bg.uniforms.uLight.value.set(0.62 + pointer.x * 0.08, 0.62 + pointer.y * 0.05);
        key.position.set(-4 + pointer.x * 3, 6 + pointer.y * 1.5, 5);
        renderer.render(scene, camera);
      }
    };
  }
});
