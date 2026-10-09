// 03 · Liquid Silk Shader
// Technique: full-screen GLSL height field (domain-warped simplex noise) shaded as
// soft muslin/silk: finite-difference normals, wrapped diffuse, Blinn sheen and a
// fine woven texture. The cursor gently pushes the folds and is the moving light.
// A folded swaddle prop floats on top with pointer tilt.
import { boot, THREE, fullscreenQuad, frameCamera, addEnvironment, GLSL_NOISE, reducedMotion } from '../../shared/core.js';
import { makeSwaddle, softLights } from '../../shared/props.js';

boot({
  slug: '03-liquid-silk',
  setup({ renderer, pointer, width, height }) {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 100);
    camera.position.set(0, 1.5, 10);
    addEnvironment(renderer, scene, 0.45);
    softLights(scene, { intensity: 0.9 });

    const silk = new THREE.ShaderMaterial({
      depthTest: false, depthWrite: false,
      uniforms: {
        uTime: { value: 0 }, uRes: { value: new THREE.Vector2(width, height) },
        uMouse: { value: new THREE.Vector2(0.65, 0.55) }, uReveal: { value: reducedMotion ? 1 : 0 }
      },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }',
      fragmentShader: /* glsl */`
        varying vec2 vUv; uniform float uTime, uReveal; uniform vec2 uRes, uMouse;
        ${GLSL_NOISE}
        float heightAt(vec2 p){
          float t = uTime * 0.05;                                  // slow, calm motion
          vec2 w = vec2(snoise(vec3(p * 0.45, t)), snoise(vec3(p * 0.45 + 5.1, t)));
          vec2 m = vec2(uMouse.x * uRes.x / uRes.y, uMouse.y) * 3.0;
          vec2 d = p - m;
          w += d * exp(-dot(d, d) * 0.8) * 0.45;                   // cursor pushes the cloth
          return sin((p.x * 0.8 + p.y * 0.45) * 2.2 + w.x * 2.2 + w.y * 1.2) * 0.55
               + sin((p.x * -0.35 + p.y * 1.0) * 1.2 + w.y * 1.6) * 0.25;
        }
        void main(){
          vec2 p = vec2(vUv.x * uRes.x / uRes.y, vUv.y) * 3.0;
          float e = 0.012;
          float h = heightAt(p);
          vec3 n = normalize(vec3(heightAt(p - vec2(e, 0.0)) - heightAt(p + vec2(e, 0.0)),
                                  heightAt(p - vec2(0.0, e)) - heightAt(p + vec2(0.0, e)), 2.0 * e * 2.4));
          vec3 L = normalize(vec3((uMouse - 0.5) * 1.6, 1.0));
          float diff = dot(n, L) * 0.5 + 0.5;                      // wrapped, soft
          float spec = pow(max(dot(n, normalize(L + vec3(0.0, 0.0, 1.0))), 0.0), 24.0);
          float sheen = pow(1.0 - n.z, 1.6);
          vec3 ivory = vec3(0.980, 0.968, 0.949);
          vec3 blush = vec3(0.90, 0.78, 0.755);
          vec3 rose  = vec3(0.80, 0.60, 0.58);
          vec3 base = mix(blush, ivory, smoothstep(-0.6, 0.6, h));
          base = mix(base, rose, sheen * 0.45);
          // muslin weave micro-texture
          vec3 col = base * (0.62 + 0.46 * diff) + vec3(1.0, 0.95, 0.9) * spec * 0.3;
          col = mix(vec3(0.96, 0.93, 0.9), col, uReveal);
          gl_FragColor = vec4(col, 1.0);
        }`
    });
    const bg = fullscreenQuad(silk);
    bg.renderOrder = -10;
    scene.add(bg);

    const group = new THREE.Group();
    const swaddle = makeSwaddle();
    group.add(swaddle);
    scene.add(group);

    let portrait = false;
    const layout = (w, h) => {
      portrait = frameCamera(camera, w, h, { desktopZ: 10, mobileZ: 15 });
      group.position.set(portrait ? 0 : 2.4, portrait ? 3.6 : 0.4, 0);
      group.scale.setScalar(portrait ? 0.95 : 1.2);
      silk.uniforms.uRes.value.set(w, h);
    };
    layout(width, height);

    return {
      scene,
      resize: layout,
      intro(tl) {
        tl.to(silk.uniforms.uReveal, { value: 1, duration: 2.6, ease: 'power2.out' }, 0)
          .from(swaddle.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 2, ease: 'back.out(1.3)' }, 0.4)
          .from(swaddle.rotation, { y: -1.4, duration: 2.4, ease: 'expo.out' }, 0.4);
      },
      render(t, dt, { scroll }) {
        silk.uniforms.uTime.value = t;
        silk.uniforms.uMouse.value.set(pointer.x * 0.5 + 0.5, pointer.y * 0.5 + 0.5);
        group.rotation.y = 0.5 + pointer.x * 0.35;
        group.rotation.x = 0.35 - pointer.y * 0.12;
        swaddle.position.y = Math.sin(t * 0.7) * 0.06;
        camera.position.y = 1.5 - scroll * 2;
        camera.lookAt(0, (portrait ? 2.0 : 0.2) - scroll * 2, 0);
        renderer.render(scene, camera);
      }
    };
  }
});
