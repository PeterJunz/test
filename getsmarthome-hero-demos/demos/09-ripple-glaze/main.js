// 09 · Ripple Glaze
// Technique: the 3D scene renders into an HDR render target; a ping-pong pair of
// half-float targets runs a damped wave-equation height field that the cursor
// "drops" into. A composite pass refracts the scene through the height gradient and
// adds a warm specular glint — like disturbing wet glaze. Tilt + parallax on top.
import { boot, THREE, frameCamera, addEnvironment, fullscreenQuad, coarsePointer, reducedMotion } from '../../shared/core.js';
import { makeVase, makeMug, warmLights, materials } from '../../shared/products.js';

boot({
  slug: '09-ripple-glaze',
  setup({ renderer, pointer, width, height, small }) {
    // ---------- 3D scene (rendered off-screen)
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#E9D3BC');
    const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 100);
    camera.position.set(0, 0.8, 10);
    addEnvironment(renderer, scene, 0.6);
    warmLights(scene, { intensity: 0.9 });

    const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(40, 22), new THREE.ShaderMaterial({
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: /* glsl */`varying vec2 vUv;
        void main(){
          vec3 a = vec3(0.86, 0.62, 0.45); vec3 b = vec3(0.96, 0.89, 0.8);
          float g = smoothstep(0.15, 0.85, vUv.y);
          vec3 col = mix(a, b, g);
          col = mix(col, vec3(0.7, 0.38, 0.24), smoothstep(0.35, 0.0, length((vUv - vec2(0.64, 0.45)) * vec2(1.8, 1.0))) * 0.45);
          gl_FragColor = vec4(col, 1.0);
        }`
    }));
    backdrop.position.z = -6;
    scene.add(backdrop);

    const set = new THREE.Group();
    const vase = makeVase({ color: '#9E4E2E' });
    vase.children[0].material = materials.glaze('#A9532F');
    const vase2 = makeVase({ color: '#E8D8C3' });
    vase2.children[0].material = materials.glaze('#EBDCC6');
    vase2.scale.setScalar(0.62);
    vase2.position.set(-1.35, -0.38, 0.6);
    const mug = makeMug({ color: '#D8B48C' });
    mug.scale.setScalar(0.45);
    mug.position.set(1.3, -0.66, 0.8);
    mug.rotation.y = -0.8;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.18, 2.4), materials.glaze('#F2E6D6'));
    slab.position.y = -1.1;
    set.add(vase, vase2, mug, slab);
    scene.add(set);

    // ---------- Render targets
    const dpr = renderer.getPixelRatio();
    const sceneRT = new THREE.WebGLRenderTarget(width * dpr, height * dpr, { type: THREE.HalfFloatType, samples: small ? 0 : 4 });
    const SIM = small ? 160 : 256;
    const simOpts = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
    let simA = new THREE.WebGLRenderTarget(SIM, SIM, simOpts);
    let simB = new THREE.WebGLRenderTarget(SIM, SIM, simOpts);
    const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const simMat = new THREE.ShaderMaterial({
      uniforms: { uPrev: { value: null }, uTexel: { value: new THREE.Vector2(1 / SIM, 1 / SIM) }, uDrop: { value: new THREE.Vector3(0.5, 0.5, 0) }, uAspect: { value: width / height } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: /* glsl */`
        varying vec2 vUv; uniform sampler2D uPrev; uniform vec2 uTexel; uniform vec3 uDrop; uniform float uAspect;
        void main(){
          vec4 s = texture2D(uPrev, vUv);
          float sum = texture2D(uPrev, vUv + vec2(uTexel.x, 0.0)).r + texture2D(uPrev, vUv - vec2(uTexel.x, 0.0)).r
                    + texture2D(uPrev, vUv + vec2(0.0, uTexel.y)).r + texture2D(uPrev, vUv - vec2(0.0, uTexel.y)).r;
          float h = (sum * 0.5 - s.g) * 0.982;
          vec2 d = (vUv - uDrop.xy) * vec2(uAspect, 1.0);
          h += uDrop.z * exp(-dot(d, d) * 1400.0);
          gl_FragColor = vec4(h, s.r, 0.0, 1.0);
        }`
    });
    const simScene = new THREE.Scene();
    simScene.add(fullscreenQuad(simMat));

    const compMat = new THREE.ShaderMaterial({
      uniforms: { uScene: { value: sceneRT.texture }, uHeight: { value: simA.texture }, uTexel: { value: new THREE.Vector2(1 / SIM, 1 / SIM) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: /* glsl */`
        varying vec2 vUv; uniform sampler2D uScene; uniform sampler2D uHeight; uniform vec2 uTexel;
        void main(){
          float hx = texture2D(uHeight, vUv + vec2(uTexel.x, 0.0)).r - texture2D(uHeight, vUv - vec2(uTexel.x, 0.0)).r;
          float hy = texture2D(uHeight, vUv + vec2(0.0, uTexel.y)).r - texture2D(uHeight, vUv - vec2(0.0, uTexel.y)).r;
          vec2 grad = vec2(hx, hy);
          vec4 col = texture2D(uScene, vUv + grad * 0.05);
          vec3 n = normalize(vec3(-grad * 6.0, 1.0));
          float spec = pow(max(dot(n, normalize(vec3(-0.4, 0.6, 1.0))), 0.0), 90.0);
          col.rgb += vec3(1.0, 0.85, 0.65) * spec * 0.9;
          col.rgb *= 1.0 - length(grad) * 0.6;
          gl_FragColor = col;
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`
    });
    compMat.toneMapped = true;
    const compScene = new THREE.Scene();
    compScene.add(fullscreenQuad(compMat));

    // ---------- Drops from pointer movement (and gentle auto-drips on touch / idle)
    const last = new THREE.Vector2(pointer.x, pointer.y);
    let pending = 0;
    let nextDrip = 0;
    const intro = { strength: 0 };

    let portrait = false;
    const layout = (w, h) => {
      portrait = frameCamera(camera, w, h, { desktopZ: 10, mobileZ: 15 });
      set.position.set(portrait ? 0 : 2.4, portrait ? 3.6 : 0.6, 0);
      set.scale.setScalar(portrait ? 0.85 : 1);
      const d = renderer.getPixelRatio();
      sceneRT.setSize(w * d, h * d);
      simMat.uniforms.uAspect.value = w / h;
    };
    layout(width, height);

    const step = (drop) => {
      simMat.uniforms.uPrev.value = simA.texture;
      simMat.uniforms.uDrop.value.copy(drop);
      renderer.setRenderTarget(simB);
      renderer.render(simScene, ortho);
      [simA, simB] = [simB, simA];
    };

    return {
      resize: layout,
      intro(tl) {
        tl.to(intro, { strength: 1, duration: 0.01 }, 0.6)
          .from(set.position, { y: '-=1.2', duration: 2, ease: 'expo.out' }, 0.2);
      },
      render(t, dt, { scroll }) {
        // 1) scene → RT
        set.rotation.y = pointer.x * 0.3;
        set.rotation.x = -pointer.y * 0.06;
        vase.rotation.y = t * 0.25;
        backdrop.position.x = -pointer.x * 0.8;
        camera.position.y = 0.8 - scroll * 2;
        camera.lookAt(0, (portrait ? 1.4 : 0.2) - scroll * 2, 0);
        renderer.setRenderTarget(sceneRT);
        renderer.render(scene, camera);

        // 2) simulation (2 steps/frame for smoother waves)
        const drop = new THREE.Vector3(pointer.x * 0.5 + 0.5, pointer.y * 0.5 + 0.5, 0);
        const moved = last.distanceTo(new THREE.Vector2(pointer.x, pointer.y));
        last.set(pointer.x, pointer.y);
        pending = Math.min(0.6, pending + moved * 4);
        if (intro.strength === 1) { drop.set(portrait ? 0.5 : 0.7, portrait ? 0.75 : 0.5, 2.5); intro.strength = 2; }
        else drop.z = pending;
        if ((coarsePointer || moved < 0.0005) && t > nextDrip && !reducedMotion) {
          drop.set(0.15 + Math.random() * 0.8, 0.2 + Math.random() * 0.7, 0.8);
          nextDrip = t + 1.6 + Math.random() * 1.5;
        }
        step(drop);
        pending *= 0.5;
        step(drop.setZ(0));

        // 3) composite → screen
        compMat.uniforms.uHeight.value = simA.texture;
        renderer.setRenderTarget(null);
        renderer.render(compScene, ortho);
      }
    };
  }
});
