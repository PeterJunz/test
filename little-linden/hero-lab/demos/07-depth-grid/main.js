// 07 · Architectural Depth Grid
// Technique: an infinite anti-aliased GLSL perspective grid (fwidth lines, horizon
// haze, intro "drawing" from the horizon, cursor spotlight pool) under a receding
// corridor of arch frames (custom Shape geometry). Warm light glows at the end of
// the corridor; the camera tilts/parallaxes with the pointer so the depth is real.
import { boot, THREE, fullscreenQuad, frameCamera, addEnvironment, reducedMotion } from '../../shared/core.js';
import { makeMoon, softLights, mat } from '../../shared/props.js';

function archFrame(W, H, w, spring) {
  const s = new THREE.Shape();
  s.moveTo(-W / 2, 0); s.lineTo(-W / 2, H); s.lineTo(W / 2, H); s.lineTo(W / 2, 0);
  s.lineTo(w / 2, 0); s.lineTo(w / 2, spring); s.absarc(0, spring, w / 2, 0, Math.PI, false); s.lineTo(-w / 2, 0); s.lineTo(-W / 2, 0);
  return new THREE.ShapeGeometry(s, 48);
}

boot({
  slug: '07-depth-grid',
  setup({ renderer, pointer, width, height }) {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 300);
    camera.position.set(0, 1.6, 12);
    addEnvironment(renderer, scene, 0.4);
    softLights(scene, { intensity: 0.8 });

    const sky = new THREE.ShaderMaterial({
      depthTest: false, depthWrite: false,
      uniforms: { uRes: { value: new THREE.Vector2(width, height) }, uHorizon: { value: 0.5 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }',
      fragmentShader: /* glsl */`
        varying vec2 vUv; uniform vec2 uRes; uniform float uHorizon;
        void main(){
          vec3 col = mix(vec3(0.96, 0.92, 0.87), vec3(0.90, 0.83, 0.77), smoothstep(uHorizon, 1.0, vUv.y));
          vec2 d = (vUv - vec2(0.62, uHorizon)) * vec2(uRes.x / uRes.y, 2.4);
          col += vec3(1.0, 0.93, 0.84) * exp(-dot(d, d) * 3.5) * 0.3;
          gl_FragColor = vec4(col, 1.0);
        }`
    });
    const skyMesh = fullscreenQuad(sky);
    skyMesh.renderOrder = -10;
    scene.add(skyMesh);

    const world = new THREE.Group();
    scene.add(world);

    // ---- Floor grid
    const floorU = { uReveal: { value: reducedMotion ? 1 : 0 }, uSpot: { value: new THREE.Vector2(0, 2) } };
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: floorU,
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: /* glsl */`
        varying vec3 vW; uniform float uReveal; uniform vec2 uSpot;
        void main(){
          vec2 p = vW.xz / 0.8;
          vec2 g = abs(fract(p - 0.5) - 0.5) / (fwidth(p) * 1.4);
          float line = 1.0 - min(min(g.x, g.y), 1.0);
          float depth = max(0.0, 12.0 - vW.z);                       // distance from camera plane toward horizon
          float front = (1.0 - uReveal) * 120.0;                     // intro: lines appear from the horizon inward
          float drawn = smoothstep(front - 6.0, front, depth);
          float haze = smoothstep(6.0, 60.0, depth);
          vec3 col = mix(vec3(0.95, 0.90, 0.85), vec3(0.72, 0.56, 0.50), line * (1.0 - haze * 0.85) * drawn);
          col += vec3(1.0, 0.86, 0.78) * exp(-dot(vW.xz - uSpot, vW.xz - uSpot) * 0.08) * 0.22;
          col = mix(col, vec3(0.97, 0.93, 0.88), haze * 0.85);
          gl_FragColor = vec4(col, smoothstep(140.0, 60.0, depth));
        }`
    }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.6;
    world.add(floor);

    // ---- Corridor of arches (front → back)
    const corridor = new THREE.Group();
    const tones = ['#F1E8DC', '#EADDD0', '#E2D2C5', '#D9C7BA', '#CFBCAF', '#C7B2A6'];
    const arches = tones.map((c, i) => {
      const m = new THREE.Mesh(archFrame(4.0, 4.2, 3.0, 2.2), new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, side: THREE.DoubleSide }));
      m.position.set(0, -1.6, -i * 2.6);
      m.userData.z = m.position.z;
      corridor.add(m);
      return m;
    });
    const endGlow = new THREE.Mesh(new THREE.PlaneGeometry(3, 4.4), new THREE.MeshBasicMaterial({ color: '#FFF3E6' }));
    endGlow.position.set(0, 0.6, -tones.length * 2.6 - 0.5);
    corridor.add(endGlow);
    world.add(corridor);

    const moon = makeMoon();
    moon.position.set(0, 0.5, 1.2);
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.75, 0.9, 64), mat.matte('#F1E8DC'));
    plinth.position.set(0, -1.15, 1.2);
    world.add(moon, plinth);

    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const hit = new THREE.Vector3();
    const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1.6);
    const hp = new THREE.Vector3();
    let portrait = false;

    const layout = (w, h) => {
      portrait = frameCamera(camera, w, h, { desktopZ: 12, mobileZ: 17 });
      corridor.position.x = moon.position.x = plinth.position.x = portrait ? 0 : 3.6;
      world.position.y = portrait ? 2.4 : 0;
      sky.uniforms.uRes.value.set(w, h);
    };
    layout(width, height);

    return {
      scene,
      resize: layout,
      intro(tl) {
        tl.to(floorU.uReveal, { value: 1, duration: 2.6, ease: 'power3.out' }, 0);
        arches.forEach((a, i) => tl.from(a.position, { z: a.userData.z - 12, duration: 2, ease: 'expo.out' }, 0.2 + (arches.length - i) * 0.08));
        tl.from(moon.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 1.6, ease: 'back.out(1.5)' }, 1.0);
      },
      render(t, dt, { scroll }) {
        camera.position.x = pointer.x * 1.4;
        camera.position.y = (portrait ? 3.2 : 1.6) + pointer.y * 0.6 - scroll * 3;
        camera.lookAt(portrait ? 0 : 1.6, (portrait ? 2.2 : 0.6) - scroll * 3, -4);
        moon.rotation.y = Math.sin(t * 0.4) * 0.4;
        moon.position.y = 0.5 + Math.sin(t * 0.8) * 0.08;
        // keep backdrop bloom on the true vanishing line
        hp.set(camera.position.x, floor.position.y, camera.position.z - 500).project(camera);
        sky.uniforms.uHorizon.value = hp.y * 0.5 + 0.5;
        ndc.set(pointer.x, pointer.y);
        ray.setFromCamera(ndc, camera);
        if (ray.ray.intersectPlane(ground, hit)) floorU.uSpot.value.lerp(new THREE.Vector2(hit.x, hit.z), 0.1);
        renderer.render(scene, camera);
      }
    };
  }
});
