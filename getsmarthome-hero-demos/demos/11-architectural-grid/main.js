// 11 · Architectural Grid
// Technique: an infinite perspective floor grid drawn in GLSL (anti-aliased with
// fwidth, fading into a warm horizon haze), two sweeping light "ribbon" walls built as
// curved strip meshes with scan-line shading and glowing crests, a bright horizon
// bloom and a reflective pool ellipse. Cursor tilts the camera (tilt + parallax),
// and drags a warm spotlight across the grid. GSAP draws the grid out from the
// horizon and raises the ribbons on intro.
import { boot, THREE, frameCamera, addEnvironment, fullscreenQuad, reducedMotion } from '../../shared/core.js';
import { makeSpeaker, warmLights } from '../../shared/products.js';

boot({
  slug: '11-architectural-grid',
  setup({ renderer, pointer, width, height }) {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 400);
    camera.position.set(0, 1.9, 14);
    addEnvironment(renderer, scene, 0.6);
    warmLights(scene, { intensity: 0.9 });

    const reveal = { grid: reducedMotion ? 1 : 0, ribbons: reducedMotion ? 1 : 0 };

    // ---------- Backdrop: warm gradient + two sweeping light-ribbon walls (screen-space GLSL)
    // The horizon uniform is re-computed every frame from the 3D camera so the ribbons
    // always sit exactly on the floor grid's vanishing line.
    const sky = new THREE.ShaderMaterial({
      depthTest: false, depthWrite: false,
      uniforms: {
        uHorizon: { value: 0.5 }, uRes: { value: new THREE.Vector2(width, height) },
        uRise: { value: reveal.ribbons }, uShift: { value: 0 }, uTime: { value: 0 }
      },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }',
      fragmentShader: /* glsl */`
        varying vec2 vUv; uniform float uHorizon, uRise, uShift, uTime; uniform vec2 uRes;
        float wall(vec2 uv, float amp, float pw, float lift, float hz, out float crestGlow){
          float x = (uv.x - 0.5 + uShift) * 2.0;
          float crest = hz + lift + amp * pow(abs(x), pw) * uRise;
          float d = uv.y - crest;
          crestGlow = exp(-abs(d) * 260.0) * 1.1 + exp(-abs(d) * 34.0) * 0.45;
          return step(uv.y, crest) * smoothstep(hz - 0.03, hz + 0.02, uv.y);
        }
        void main(){
          vec2 uv = vUv;
          float aspect = uRes.x / uRes.y;
          float hz = uHorizon;
          vec3 top = vec3(0.72, 0.58, 0.44);
          vec3 mid = vec3(0.90, 0.78, 0.62);
          vec3 col = mix(mid, top, smoothstep(hz, 1.0, uv.y));
          float side;
          // far wall
          float g1; float w1 = wall(uv, 0.36, 1.7, 0.035, hz, g1);
          side = smoothstep(0.05, 0.95, abs(uv.x - 0.5) * 2.0);
          vec3 body1 = mix(vec3(0.97, 0.93, 0.80), vec3(0.62, 0.40, 0.22), side);
          float scan = 0.9 + 0.1 * step(0.5, fract(uv.y * uRes.y / 6.0));
          col = mix(col, body1 * scan, w1 * (0.45 + 0.45 * side));
          // near wall (lower, tighter curve)
          float g2; float w2 = wall(uv, 0.18, 2.4, 0.012, hz, g2);
          vec3 body2 = mix(vec3(1.0, 0.97, 0.86), vec3(0.70, 0.47, 0.27), side);
          col = mix(col, body2 * scan, w2 * (0.35 + 0.4 * side));
          col += vec3(1.0, 0.97, 0.86) * (g1 * 0.9 + g2 * 0.6) * uRise;
          // horizon bloom
          vec2 d = (uv - vec2(0.5 - uShift, hz)) * vec2(aspect * 0.55, 3.0);
          col += vec3(1.0, 0.96, 0.85) * exp(-dot(d, d) * 3.0) * 0.55;
          col *= mix(0.84, 1.0, smoothstep(1.15, 0.25, abs(uv.x - 0.5) * 2.0));
          gl_FragColor = vec4(col, 1.0);
        }`
    });
    const skyMesh = fullscreenQuad(sky);
    skyMesh.renderOrder = -10;
    scene.add(skyMesh);

    // ---------- Floor grid (procedural, anti-aliased)
    const floorUniforms = {
      uReveal: { value: reveal.grid },
      uSpot: { value: new THREE.Vector2(0, 4) },
      uCell: { value: 0.75 }
    };
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: floorUniforms,
      vertexShader: /* glsl */`
        varying vec3 vW;
        void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */`
        varying vec3 vW; uniform float uReveal; uniform vec2 uSpot; uniform float uCell;
        void main(){
          vec2 p = vW.xz / uCell;
          vec2 g = abs(fract(p - 0.5) - 0.5) / (fwidth(p) * 1.6);
          float line = 1.0 - min(min(g.x, g.y), 1.0);
          float dist = length(vW.xz);
          float depth = -vW.z;                                  // distance toward the horizon
          // grid "draws" outward from the horizon during the intro
          float drawn = smoothstep(uReveal * 140.0 - 4.0, uReveal * 140.0, 140.0 - depth);
          vec3 base = vec3(0.93, 0.83, 0.71);
          vec3 lineCol = vec3(0.74, 0.42, 0.16);
          float haze = smoothstep(6.0, 55.0, depth);            // fade into the horizon
          vec3 col = mix(base, lineCol, line * (1.0 - haze * 0.85) * drawn);
          // reflective pool ellipse in front of the product
          vec2 e = (vW.xz - vec2(0.0, 0.0)) / vec2(7.5, 3.6);
          float ring = exp(-pow(length(e) - 1.0, 2.0) * 40.0) * 0.22;
          float pool = smoothstep(1.0, 0.0, length(e)) * 0.12;
          col += vec3(1.0, 0.96, 0.88) * (ring + pool);
          // cursor spotlight
          float s = exp(-dot(vW.xz - uSpot, vW.xz - uSpot) * 0.06);
          col += vec3(1.0, 0.8, 0.55) * s * 0.28;
          // horizon glow + haze colour
          col = mix(col, vec3(0.98, 0.93, 0.82), haze * 0.85);
          float alpha = smoothstep(150.0, 60.0, depth);
          gl_FragColor = vec4(col, alpha);
        }`
    }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.4;
    scene.add(floor);

    // ---------- Product on the pool + soft reflection
    const product = makeSpeaker();
    product.position.set(0, -0.35, 0);
    scene.add(product);
    const mirror = product.clone();
    mirror.scale.y = -1;
    mirror.position.y = -2.45;
    mirror.traverse((o) => {
      if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.18; o.material.depthWrite = false; }
      if (o.isLight) o.visible = false;
    });
    scene.add(mirror);

    const horizonPt = new THREE.Vector3();
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const hit = new THREE.Vector3();
    const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1.4);
    let portrait = false;

    const layout = (w, h) => {
      portrait = frameCamera(camera, w, h, { desktopZ: 14, mobileZ: 20 });
      const x = portrait ? 0 : 3.2;
      product.position.x = mirror.position.x = x;
      product.scale.setScalar(portrait ? 1.2 : 1.1);
      mirror.scale.set(product.scale.x, -product.scale.y, product.scale.z);
      sky.uniforms.uRes.value.set(w, h);
    };
    layout(width, height);

    return {
      resize: layout,
      intro(tl) {
        tl.fromTo(floorUniforms.uReveal, { value: 0 }, { value: 1, duration: 2.6, ease: 'power3.out' }, 0)
          .fromTo(sky.uniforms.uRise, { value: 0 }, { value: 1, duration: 2.4, ease: 'expo.out' }, 0.4)
          .from(camera.position, { y: 7, duration: 2.6, ease: 'expo.out' }, 0);
      },
      render(t, dt, { scroll }) {
        sky.uniforms.uTime.value = t;
        // Tilt + parallax: camera orbits a little, ribbons drift slower than the floor
        const baseY = portrait ? 3.4 : 1.9;
        camera.position.x = pointer.x * 1.6;
        camera.position.y = baseY + pointer.y * 0.8 - scroll * 3;
        camera.lookAt(portrait ? 0 : 1.2, (portrait ? 3.2 : 1.6) - scroll * 3, -6);
        sky.uniforms.uShift.value = pointer.x * 0.035;           // ribbons parallax against the grid
        // keep the backdrop horizon locked to the 3D floor's vanishing line
        horizonPt.set(camera.position.x, floor.position.y, camera.position.z - 1000).project(camera);
        sky.uniforms.uHorizon.value = horizonPt.y * 0.5 + 0.5;
        // Product float + turn
        product.rotation.y = t * 0.3 + pointer.x * 0.4;
        product.position.y = -0.35 + Math.sin(t * 1.1) * 0.08;
        mirror.rotation.y = product.rotation.y;
        mirror.position.y = -2.45 - Math.sin(t * 1.1) * 0.08;
        if (product.userData.ring) product.userData.ring.material.color.setHSL(0.08, 1, 0.66 + Math.sin(t * 2) * 0.06);
        // Spotlight follows the cursor across the grid
        ndc.set(pointer.x, pointer.y);
        ray.setFromCamera(ndc, camera);
        if (ray.ray.intersectPlane(ground, hit)) floorUniforms.uSpot.value.lerp(new THREE.Vector2(hit.x, hit.z), 0.12);
        renderer.render(scene, camera);
      }
    };
  }
});
