// 05 · Liquid Brass
// Technique: a physically-based brass material patched with onBeforeCompile so its
// vertex shader displaces the surface with layered simplex noise and recomputes
// normals from neighbour samples. Iridescence gives a holographic "foil" sheen; the
// cursor dents the blob and drives a spotlight. GSAP eases the molten amplitude.
import { boot, THREE, gsap, fullscreenQuad, frameCamera, addEnvironment, GLSL_NOISE } from '../../shared/core.js';
import { materials } from '../../shared/products.js';

boot({
  slug: '05-liquid-brass',
  setup({ renderer, hero: heroEl, pointer, width, height, small }) {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 100);
    camera.position.set(0, 0.3, 9);
    addEnvironment(renderer, scene, 0.9);

    // Background glow
    const bg = new THREE.ShaderMaterial({
      depthTest: false, depthWrite: false,
      uniforms: { uRes: { value: new THREE.Vector2(width, height) }, uFocus: { value: new THREE.Vector2(0.68, 0.55) }, uTime: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }',
      fragmentShader: /* glsl */`
        varying vec2 vUv; uniform vec2 uRes, uFocus; uniform float uTime;
        void main(){
          vec2 d = (vUv - uFocus) * vec2(uRes.x / uRes.y, 1.0);
          float g = exp(-dot(d, d) * 3.2);
          vec3 col = mix(vec3(0.09, 0.066, 0.055), vec3(0.42, 0.25, 0.14), g);
          col += vec3(0.85, 0.55, 0.28) * pow(g, 6.0) * 0.25;
          gl_FragColor = vec4(col, 1.0);
        }`
    });
    const bgMesh = fullscreenQuad(bg);
    bgMesh.renderOrder = -10;
    scene.add(bgMesh);

    const spot = new THREE.SpotLight('#ffd09a', 60, 20, Math.PI / 7, 0.7, 1.5);
    spot.position.set(0, 4, 6);
    scene.add(spot, spot.target);
    const rim = new THREE.DirectionalLight('#ff9c55', 2.2);
    rim.position.set(-4, 2, -3);
    scene.add(rim, new THREE.AmbientLight('#3a2418', 0.6));

    // Molten brass blob
    const uniforms = { uTime: { value: 0 }, uAmp: { value: 0.28 }, uMouse: { value: new THREE.Vector3(9, 9, 9) } };
    const mat = new THREE.MeshPhysicalMaterial({
      color: '#d4ae73', metalness: 1, roughness: 0.16,
      iridescence: 0.45, iridescenceIOR: 1.3, iridescenceThicknessRange: [260, 420],
      clearcoat: 0.6, clearcoatRoughness: 0.1
    });
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
          uniform float uTime; uniform float uAmp; uniform vec3 uMouse;
          ${GLSL_NOISE}
          vec3 displace(vec3 p){
            float n = snoise(p * 0.75 + vec3(0.0, uTime * 0.22, 0.0)) * 0.8 + snoise(p * 1.6 - uTime * 0.17) * 0.12;
            vec3 d = p - uMouse;
            float dent = exp(-dot(d, d) * 2.2);
            return p + normalize(p) * (n * uAmp - dent * 0.32);
          }`)
        .replace('#include <beginnormal_vertex>', `
          vec3 tA = normalize(cross(normal, abs(normal.y) > 0.99 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0)));
          vec3 tB = normalize(cross(normal, tA));
          vec3 dP = displace(position);
          vec3 objectNormal = normalize(cross(displace(position + tA * 0.012) - dP, displace(position + tB * 0.012) - dP));
          #ifdef USE_TANGENT
            vec3 objectTangent = vec3(tangent.xyz);
          #endif`)
        .replace('#include <begin_vertex>', 'vec3 transformed = dP;');
    };
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2, small ? 48 : 96), mat);

    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.05, 1.1, 96), materials.walnut());
    pedestal.position.y = -2.05;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.025, 12, 128), materials.brass());
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -1.5;

    const group = new THREE.Group();
    group.add(blob, pedestal, ring);
    scene.add(group);

    // Hovering the product card makes the brass more molten
    const card = heroEl.querySelector('[data-card]');
    card.addEventListener('pointerenter', () => gsap.to(uniforms.uAmp, { value: 0.5, duration: 1.2, ease: 'elastic.out(1, 0.5)' }));
    card.addEventListener('pointerleave', () => gsap.to(uniforms.uAmp, { value: 0.28, duration: 1.4, ease: 'power3.out' }));

    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const hit = new THREE.Vector3();
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const local = new THREE.Vector3();

    const layout = (w, h) => {
      const portrait = frameCamera(camera, w, h, { desktopZ: 9, mobileZ: 13.5 });
      group.position.set(portrait ? 0 : 2.5, portrait ? 2.9 : 0.75, 0);
      group.scale.setScalar(portrait ? 0.8 : 0.85);
      bg.uniforms.uRes.value.set(w, h);
      bg.uniforms.uFocus.value.set(portrait ? 0.5 : 0.68, portrait ? 0.75 : 0.55);
    };
    layout(width, height);

    return {
      resize: layout,
      intro(tl) {
        tl.fromTo(uniforms.uAmp, { value: 1.1 }, { value: 0.28, duration: 3, ease: 'elastic.out(1, 0.45)' }, 0.1)
          .from(blob.scale, { x: 0.2, y: 0.2, z: 0.2, duration: 2.2, ease: 'expo.out' }, 0.1)
          .from(spot, { intensity: 0, duration: 2 }, 0.4);
      },
      render(t, dt, { scroll }) {
        uniforms.uTime.value = t;
        bg.uniforms.uTime.value = t;
        // Tilt
        blob.rotation.y += dt * 0.18;
        group.rotation.x = -pointer.y * 0.15;
        group.rotation.y = pointer.x * 0.3;
        // Cursor dent + spotlight
        ndc.set(pointer.x, pointer.y);
        ray.setFromCamera(ndc, camera);
        plane.constant = -group.position.z - 0.8;
        if (ray.ray.intersectPlane(plane, hit)) {
          local.copy(hit);
          blob.worldToLocal(local);
          uniforms.uMouse.value.lerp(local, 0.12);
          spot.target.position.lerp(hit, 0.1);
        }
        spot.position.x = pointer.x * 4;
        camera.position.y = 0.3 - scroll * 2;
        camera.lookAt(0, 0.2 - scroll * 2, 0);
        renderer.render(scene, camera);
      }
    };
  }
});
