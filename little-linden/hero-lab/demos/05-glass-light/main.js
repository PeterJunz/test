// 05 · Glass & Light
// Technique: three frosted-glass arch panels (extruded Shape with bevel, physical
// transmission + roughness) layered in depth in front of a soft colour-field
// backdrop and a feeding-bottle prop, so the glass genuinely refracts/blurs what is
// behind it. Additive light-beam planes drift slowly; a warm point light follows the
// cursor across the glass (spotlight). Panels sit right of the copy for readability.
import { boot, THREE, frameCamera, addEnvironment, reducedMotion } from '../../shared/core.js';
import { makeBottle, softLights } from '../../shared/props.js';

function archGeometry(w, h, depth) {
  const s = new THREE.Shape();
  const r = w / 2;
  s.moveTo(-r, -h / 2);
  s.lineTo(-r, h / 2 - r);
  s.absarc(0, h / 2 - r, r, Math.PI, 0, true);
  s.lineTo(r, -h / 2);
  s.lineTo(-r, -h / 2);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 4, curveSegments: 48 });
  g.center();
  return g;
}

boot({
  slug: '05-glass-light',
  setup({ renderer, pointer, width, height, small }) {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 100);
    camera.position.set(0, 0.4, 13);
    addEnvironment(renderer, scene, 0.6);
    softLights(scene, { intensity: 0.8 });

    // Colour-field backdrop (a real mesh so transmission can refract it)
    const field = new THREE.Mesh(new THREE.PlaneGeometry(40, 24), new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uFade: { value: reducedMotion ? 1 : 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: /* glsl */`
        varying vec2 vUv; uniform float uTime, uFade;
        void main(){
          vec2 uv = vUv * vec2(1.66, 1.0);
          vec3 col = mix(vec3(0.95, 0.92, 0.88), vec3(0.98, 0.97, 0.95), vUv.y);
          vec2 a = vec2(0.93 + sin(uTime * 0.11) * 0.05, 0.55);
          vec2 b = vec2(1.03 + cos(uTime * 0.09) * 0.05, 0.43);
          vec2 c = vec2(0.86, 0.40 + sin(uTime * 0.13) * 0.04);
          col = mix(col, vec3(0.83, 0.62, 0.60), smoothstep(0.17, 0.0, length(uv - a)) * 0.85 * uFade);
          col = mix(col, vec3(0.60, 0.67, 0.57), smoothstep(0.14, 0.0, length(uv - b)) * 0.85 * uFade);
          col = mix(col, vec3(0.93, 0.80, 0.64), smoothstep(0.12, 0.0, length(uv - c)) * 0.7 * uFade);
          gl_FragColor = vec4(col, 1.0);
        }`
    }));
    field.position.z = -5;
    scene.add(field);

    const group = new THREE.Group();
    const bottle = makeBottle();
    bottle.position.set(0.2, -0.4, -1.4);
    bottle.scale.setScalar(1.2);
    group.add(bottle);

    const glass = (tint) => new THREE.MeshPhysicalMaterial({ color: tint, roughness: 0.14, transmission: 1, thickness: 0.6, ior: 1.42, envMapIntensity: 0.6, specularIntensity: 0.8 });
    const arches = [
      [archGeometry(2.6, 4.6, 0.12), glass('#ffffff'), [-1.4, 0.1, 0.3], -0.12],
      [archGeometry(2.2, 3.9, 0.12), glass('#fff4f1'), [1.0, -0.2, 0.9], 0.1],
      [archGeometry(1.7, 3.0, 0.1), glass('#f4f8f1'), [2.4, -0.6, 1.6], 0.18]
    ].map(([geo, m, p, ry]) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(...p);
      mesh.rotation.y = ry;
      mesh.userData.base = mesh.position.clone();
      group.add(mesh);
      return mesh;
    });

    // Light beams
    const beamMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uFade: { value: reducedMotion ? 1 : 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: /* glsl */`
        varying vec2 vUv; uniform float uTime, uFade;
        void main(){
          float x = vUv.x + sin(uTime * 0.2 + vUv.y * 2.0) * 0.03;
          float beams = smoothstep(0.0, 0.5, sin(x * 18.0) * 0.5 + 0.5) * smoothstep(0.0, 0.3, sin(x * 5.0 + 1.3) * 0.5 + 0.5);
          float fade = smoothstep(0.0, 0.4, vUv.y) * smoothstep(1.0, 0.6, vUv.y) * smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x);
          gl_FragColor = vec4(vec3(1.0, 0.9, 0.82) * beams * fade * 0.07 * uFade, 1.0);
        }`
    });
    const beams = new THREE.Mesh(new THREE.PlaneGeometry(9, 12), beamMat);
    beams.position.set(0.4, 1.0, 2.2);
    beams.rotation.set(0, 0, -0.55);
    group.add(beams);
    scene.add(group);

    const spot = new THREE.PointLight('#ffd9bd', 22, 9, 1.6);
    scene.add(spot);

    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const hit = new THREE.Vector3();
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -2.5);
    let portrait = false;

    const layout = (w, h) => {
      portrait = frameCamera(camera, w, h, { desktopZ: 13, mobileZ: 19 });
      group.position.set(portrait ? -0.4 : 3.0, portrait ? 4.2 : 0.4, 0);
      group.scale.setScalar(portrait ? 0.75 : 1);
      renderer.transmissionResolutionScale = small ? 0.5 : 1;
    };
    layout(width, height);

    return {
      scene,
      resize: layout,
      intro(tl) {
        tl.to([field.material.uniforms.uFade, beamMat.uniforms.uFade], { value: 1, duration: 2.6, ease: 'power2.out' }, 0);
        arches.forEach((a, i) => tl.from(a.position, { y: a.userData.base.y - 3, duration: 1.8, ease: 'expo.out' }, 0.2 + i * 0.15));
      },
      render(t, dt, { scroll }) {
        field.material.uniforms.uTime.value = t;
        beamMat.uniforms.uTime.value = t;
        arches.forEach((a, i) => {
          a.rotation.y = a.userData.base.x * 0.05 + pointer.x * (0.12 + i * 0.05);
          a.rotation.x = -pointer.y * 0.06;
          a.position.x = a.userData.base.x + pointer.x * 0.15 * (i + 1);   // parallax per layer
        });
        bottle.rotation.y = t * 0.2;
        ndc.set(pointer.x, pointer.y);
        ray.setFromCamera(ndc, camera);
        if (ray.ray.intersectPlane(plane, hit)) spot.position.lerp(hit, 0.12);
        field.position.x = -pointer.x * 0.8;
        camera.position.y = 0.4 - scroll * 2;
        camera.lookAt(0, (portrait ? 2.6 : 0.2) - scroll * 2, 0);
        renderer.render(scene, camera);
      }
    };
  }
});
