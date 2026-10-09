// 06 · Interactive Product Spotlight
// Technique: one hero product on a plinth under a real SpotLight that follows the
// cursor, plus a visible volumetric cone (additive shader on an open cone mesh) and
// an animated conic light ring on the floor. Secondary product cards (DOM, foil +
// tilt) are configurable in the page markup. Clear purchase CTA stays in the copy.
import { boot, THREE, fullscreenQuad, frameCamera, addEnvironment, reducedMotion } from '../../shared/core.js';
import { makeRattle, softLights, mat } from '../../shared/props.js';

boot({
  slug: '06-product-spotlight',
  renderer: { shadows: true },
  setup({ renderer, pointer, width, height }) {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 100);
    camera.position.set(0, 2.2, 12);
    addEnvironment(renderer, scene, 0.35);
    softLights(scene, { intensity: 0.55 });

    const bg = new THREE.ShaderMaterial({
      depthTest: false, depthWrite: false,
      uniforms: { uRes: { value: new THREE.Vector2(width, height) }, uFocus: { value: new THREE.Vector2(0.7, 0.45) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }',
      fragmentShader: /* glsl */`
        varying vec2 vUv; uniform vec2 uRes, uFocus;
        void main(){
          vec2 d = (vUv - uFocus) * vec2(uRes.x / uRes.y, 1.0);
          vec3 col = mix(vec3(0.87, 0.89, 0.85), vec3(0.94, 0.95, 0.92), exp(-dot(d, d) * 1.6));
          gl_FragColor = vec4(col, 1.0);
        }`
    });
    const bgMesh = fullscreenQuad(bg);
    bgMesh.renderOrder = -10;
    scene.add(bgMesh);

    const stage = new THREE.Group();
    scene.add(stage);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.2, color: new THREE.Color('#55624F') }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.85;
    floor.receiveShadow = true;
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.45, 0.5, 96), mat.matte('#F1E8DC'));
    plinth.position.y = -1.6;
    plinth.castShadow = plinth.receiveShadow = true;
    const rattle = makeRattle();
    rattle.position.y = -0.2;
    rattle.rotation.z = -0.25;
    stage.add(floor, plinth, rattle);

    // Animated conic light ring around the plinth
    const ringMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uFade: { value: reducedMotion ? 1 : 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: /* glsl */`
        varying vec2 vUv; uniform float uTime, uFade;
        void main(){
          vec2 p = vUv - 0.5; float r = length(p) * 2.0;
          float ring = smoothstep(0.05, 0.0, abs(r - 0.82));
          float ang = atan(p.y, p.x) / 6.2831853 + 0.5;
          float sweep = pow(fract(ang - uTime * 0.06), 3.0);
          gl_FragColor = vec4(vec3(1.0, 0.88, 0.8) * ring * (0.25 + sweep * 0.9) * uFade, 1.0);
        }`
    });
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -1.83;
    stage.add(ring);

    // Spotlight + visible cone
    const spot = new THREE.SpotLight('#FFF1E4', 80, 20, Math.PI / 11, 0.55, 1.4);
    spot.position.set(0, 7, 1);
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    spot.shadow.radius = 6;
    stage.add(spot, spot.target);
    const coneMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uFade: { value: reducedMotion ? 1 : 0 } },
      vertexShader: 'varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY = uv.y; vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * mv; }',
      fragmentShader: /* glsl */`
        varying float vY; varying vec3 vN; varying vec3 vV; uniform float uFade;
        void main(){
          float edge = pow(abs(dot(vN, vV)), 1.5);
          gl_FragColor = vec4(vec3(1.0, 0.93, 0.85) * edge * smoothstep(0.0, 0.8, vY) * 0.14 * uFade, 1.0);
        }`
    });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(2.0, 8.5, 64, 1, true), coneMat);
    stage.add(cone);

    let portrait = false;
    const layout = (w, h) => {
      portrait = frameCamera(camera, w, h, { desktopZ: 12, mobileZ: 17 });
      stage.position.set(portrait ? 0 : 1.2, portrait ? 4.4 : 0.9, 0);
      stage.scale.setScalar(portrait ? 0.72 : 1.05);
      bg.uniforms.uRes.value.set(w, h);
      bg.uniforms.uFocus.value.set(portrait ? 0.5 : 0.58, portrait ? 0.78 : 0.52);
    };
    layout(width, height);

    const target = new THREE.Vector3();
    return {
      scene,
      resize: layout,
      intro(tl) {
        tl.fromTo([ringMat.uniforms.uFade, coneMat.uniforms.uFade], { value: 0 }, { value: 1, duration: 2, ease: 'power2.out' }, 0.6)
          .from(spot, { intensity: 0, duration: 1.8, ease: 'power2.inOut' }, 0.3)
          .from(rattle.position, { y: 2.5, duration: 1.8, ease: 'expo.out' }, 0.2);
      },
      render(t, dt, { scroll }) {
        ringMat.uniforms.uTime.value = t;
        // Spotlight follows the cursor around the product; cone re-aims every frame
        target.set(pointer.x * 1.6, -1.2, -pointer.y * 1.2);
        spot.target.position.lerp(target, 0.08);
        spot.position.set(pointer.x * 1.2, 7, 1 - pointer.y * 0.6);
        const dir = new THREE.Vector3().subVectors(spot.target.position, spot.position);
        const len = dir.length();
        cone.position.copy(spot.position).addScaledVector(dir, 0.5);
        cone.scale.set(1, len / 8.5, 1);
        cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.normalize());
        // Product: gentle sway + tilt
        rattle.rotation.y = t * 0.3 + pointer.x * 0.5;
        rattle.rotation.x = -pointer.y * 0.15;
        rattle.position.y = -0.2 + Math.sin(t * 0.9) * 0.06;
        stage.rotation.y = pointer.x * 0.12;
        camera.position.x = pointer.x * 0.4;
        camera.position.y = 2.2 + pointer.y * 0.3 - scroll * 2;
        camera.lookAt(0, (portrait ? 2.6 : 0.2) - scroll * 2, 0);
        renderer.render(scene, camera);
      }
    };
  }
});
