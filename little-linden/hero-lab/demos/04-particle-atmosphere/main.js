// 04 · Particle Atmosphere
// Technique: two GPU particle layers — fine dust (thousands of tiny points) and large
// soft bokeh discs — drifting on a slow noise field at different depths, lit by a
// floating cloud night light. The cursor gently parts nearby dust (no snapping) and
// steers a warm glow. Motion is slow; reduced-motion renders a single still frame.
import { boot, THREE, fullscreenQuad, frameCamera, addEnvironment, GLSL_NOISE, reducedMotion } from '../../shared/core.js';
import { makeCloudLight, softLights } from '../../shared/props.js';

boot({
  slug: '04-particle-atmosphere',
  renderer: { toneMapping: true },
  setup({ renderer, pointer, width, height, small }) {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 100);
    camera.position.set(0, 0.4, 10);
    addEnvironment(renderer, scene, 0.25);
    softLights(scene, { intensity: 0.45 });

    const bg = new THREE.ShaderMaterial({
      depthTest: false, depthWrite: false,
      uniforms: { uRes: { value: new THREE.Vector2(width, height) }, uGlow: { value: new THREE.Vector2(0.68, 0.56) }, uFade: { value: reducedMotion ? 1 : 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }',
      fragmentShader: /* glsl */`
        varying vec2 vUv; uniform vec2 uRes, uGlow; uniform float uFade;
        void main(){
          vec2 d = (vUv - uGlow) * vec2(uRes.x / uRes.y, 1.0);
          float g = exp(-dot(d, d) * 2.4);
          vec3 col = mix(vec3(0.17, 0.15, 0.145), vec3(0.24, 0.20, 0.19), vUv.y);
          col += vec3(0.62, 0.42, 0.38) * g * 0.55 * uFade + vec3(0.9, 0.7, 0.55) * pow(g, 5.0) * 0.25 * uFade;
          gl_FragColor = vec4(col, 1.0);
        }`
    });
    const bgMesh = fullscreenQuad(bg);
    bgMesh.renderOrder = -10;
    scene.add(bgMesh);

    const cloud = makeCloudLight();
    const group = new THREE.Group();
    group.add(cloud);
    scene.add(group);

    const uniforms = { uTime: { value: 0 }, uMouse: { value: new THREE.Vector3(99, 99, 0) }, uScale: { value: renderer.getPixelRatio() * height / 900 }, uAlpha: { value: reducedMotion ? 1 : 0 } };
    const makeLayer = (count, size, spread, isBokeh) => {
      const pos = new Float32Array(count * 3);
      const rnd = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        pos.set([(Math.random() - 0.5) * spread[0], (Math.random() - 0.5) * spread[1], -Math.random() * spread[2] + 3], i * 3);
        rnd[i] = Math.random();
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 1));
      const m = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { ...uniforms, uSize: { value: size }, uBokeh: { value: isBokeh ? 1 : 0 } },
        vertexShader: /* glsl */`
          attribute float aRnd; uniform float uTime, uSize, uScale; uniform vec3 uMouse; varying float vRnd; varying float vDepth;
          ${GLSL_NOISE}
          void main(){
            vec3 p = position;
            float t = uTime * 0.06;
            p += vec3(snoise(p * 0.15 + t), snoise(p * 0.15 + 9.0 + t), snoise(p * 0.15 + 19.0)) * 0.9;
            p.y = mod(p.y + uTime * 0.04 * (0.4 + aRnd) + 6.0, 12.0) - 6.0;   // slow upward drift, wraps
            vec4 w = modelMatrix * vec4(p, 1.0);
            vec3 d = w.xyz - uMouse;
            float infl = exp(-dot(d.xy, d.xy) * 0.5);
            w.xy += normalize(d.xy + 1e-4) * infl * 0.6;            // dust parts softly around the cursor
            vec4 mv = viewMatrix * w;
            gl_Position = projectionMatrix * mv;
            gl_PointSize = uSize * uScale * (0.5 + aRnd) * 10.0 / -mv.z;
            vRnd = aRnd; vDepth = clamp(-mv.z / 18.0, 0.0, 1.0);
          }`,
        fragmentShader: /* glsl */`
          uniform float uBokeh, uAlpha; varying float vRnd; varying float vDepth;
          void main(){
            vec2 c = gl_PointCoord - 0.5; float r = length(c);
            if (r > 0.5) discard;
            float a = uBokeh > 0.5 ? smoothstep(0.5, 0.42, r) * (0.5 + 0.5 * smoothstep(0.2, 0.48, r)) * 0.16
                                   : smoothstep(0.5, 0.0, r) * 0.85;
            vec3 col = mix(vec3(1.0, 0.86, 0.74), vec3(0.95, 0.78, 0.76), vRnd);
            gl_FragColor = vec4(col, a * (1.0 - vDepth * 0.6) * uAlpha);
          }`
      });
      const pts = new THREE.Points(geo, m);
      pts.frustumCulled = false;
      return pts;
    };
    const dust = makeLayer(small ? 2600 : 6000, 4.2, [22, 12, 14], false);
    const bokeh = makeLayer(small ? 40 : 90, 26, [20, 12, 10], true);
    scene.add(dust, bokeh);

    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const hit = new THREE.Vector3();
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    let portrait = false;

    const layout = (w, h) => {
      portrait = frameCamera(camera, w, h, { desktopZ: 10, mobileZ: 14 });
      group.position.set(portrait ? 0 : 2.6, portrait ? 3.0 : 0.5, 0);
      group.scale.setScalar(portrait ? 0.8 : 1.0);
      bg.uniforms.uRes.value.set(w, h);
      bg.uniforms.uGlow.value.set(portrait ? 0.5 : 0.7, portrait ? 0.78 : 0.56);
      [dust, bokeh].forEach((l) => { l.material.uniforms.uScale.value = renderer.getPixelRatio() * h / 900; });
    };
    layout(width, height);

    return {
      scene,
      resize: layout,
      intro(tl) {
        tl.fromTo(bg.uniforms.uFade, { value: 0 }, { value: 1, duration: 2.4, ease: 'power2.out' }, 0)
          .fromTo([dust.material.uniforms.uAlpha, bokeh.material.uniforms.uAlpha], { value: 0 }, { value: 1, duration: 3, ease: 'power2.out' }, 0.3)
          .from(cloud.scale, { x: 0.6, y: 0.6, z: 0.6, duration: 2.4, ease: 'expo.out' }, 0.2);
      },
      render(t, dt, { scroll }) {
        [dust, bokeh].forEach((l) => { l.material.uniforms.uTime.value = t; });
        ndc.set(pointer.x, pointer.y);
        ray.setFromCamera(ndc, camera);
        if (ray.ray.intersectPlane(plane, hit)) [dust, bokeh].forEach((l) => l.material.uniforms.uMouse.value.lerp(hit, 0.08));
        cloud.position.y = Math.sin(t * 0.6) * 0.1;
        group.rotation.y = pointer.x * 0.3;
        group.rotation.x = -pointer.y * 0.1;
        bokeh.position.x = -pointer.x * 0.4;
        dust.position.x = -pointer.x * 0.9;                  // parallax: near dust moves more
        camera.position.y = 0.4 - scroll * 2;
        camera.lookAt(0, (portrait ? 1.6 : 0.2) - scroll * 2, 0);
        renderer.render(scene, camera);
      }
    };
  }
});
