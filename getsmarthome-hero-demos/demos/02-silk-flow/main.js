// 02 · Silk Flow
// Technique: full-screen GLSL satin. A domain-warped height field is shaded with
// finite-difference normals + Blinn sheen; the cursor pushes the folds and acts as
// the moving specular spotlight. A ceramic vase floats above with pointer tilt.
import { boot, THREE, fullscreenQuad, frameCamera, addEnvironment, GLSL_NOISE } from '../../shared/core.js';
import { makeVase, warmLights } from '../../shared/products.js';

boot({
  slug: '02-silk-flow',
  setup({ renderer, pointer, width, height, small }) {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 100);
    camera.position.set(0, 0, 9);
    addEnvironment(renderer, scene, 0.55);
    warmLights(scene, { intensity: 0.9 });

    const silk = new THREE.ShaderMaterial({
      depthTest: false, depthWrite: false,
      uniforms: {
        uTime: { value: 0 }, uRes: { value: new THREE.Vector2(width, height) },
        uMouse: { value: new THREE.Vector2(0.6, 0.5) }, uPush: { value: 1 }, uReveal: { value: 0 }
      },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }',
      fragmentShader: /* glsl */`
        varying vec2 vUv;
        uniform float uTime, uPush, uReveal; uniform vec2 uRes, uMouse;
        ${GLSL_NOISE}
        float heightAt(vec2 p){
          float t = uTime * 0.07;
          vec2 w = vec2(snoise(vec3(p * 0.55, t)), snoise(vec3(p * 0.55 + 7.3, t)));
          vec2 m = vec2(uMouse.x * uRes.x / uRes.y, uMouse.y) * 3.0;
          vec2 d = p - m;
          float infl = exp(-dot(d, d) * 0.9) * uPush;
          w += d * infl * 0.55;
          return sin((p.x * 0.9 + p.y * 0.55) * 2.4 + w.x * 2.6 + w.y * 1.4) * 0.5
               + sin((p.x * -0.4 + p.y * 1.1) * 1.3 + w.y * 1.8) * 0.25;
        }
        void main(){
          vec2 p = vec2(vUv.x * uRes.x / uRes.y, vUv.y) * 3.0;
          float e = 0.01;
          float h = heightAt(p);
          vec3 n = normalize(vec3(heightAt(p - vec2(e, 0.0)) - heightAt(p + vec2(e, 0.0)),
                                  heightAt(p - vec2(0.0, e)) - heightAt(p + vec2(0.0, e)), 2.0 * e * 6.0));
          vec3 lightDir = normalize(vec3((uMouse - 0.5) * 2.0, 0.9));
          float diff = clamp(dot(n, lightDir), 0.0, 1.0);
          float spec = pow(clamp(dot(n, normalize(lightDir + vec3(0.0, 0.0, 1.0))), 0.0, 1.0), 38.0);
          float sheen = pow(1.0 - n.z, 2.0);
          vec3 cream = vec3(0.965, 0.925, 0.875);
          vec3 sand  = vec3(0.906, 0.792, 0.655);
          vec3 cara  = vec3(0.776, 0.541, 0.322);
          vec3 base = mix(sand, cream, smoothstep(-0.6, 0.7, h));
          base = mix(base, cara, smoothstep(0.35, 1.0, sheen) * 0.55);
          vec3 col = base * (0.55 + 0.6 * diff) + vec3(1.0, 0.9, 0.75) * spec * 0.55 + sheen * vec3(0.25, 0.14, 0.06);
          // vignette + reveal (focus pull from flat linen)
          float vig = smoothstep(1.25, 0.25, length(vUv - vec2(0.62, 0.5)));
          col *= mix(0.86, 1.04, vig);
          col = mix(vec3(0.94, 0.89, 0.83), col, uReveal);
          gl_FragColor = vec4(col, 1.0);
        }`
    });
    const bg = fullscreenQuad(silk);
    bg.renderOrder = -10;
    scene.add(bg);

    const hero = new THREE.Group();
    const vase = makeVase({ color: '#B8673F' });
    hero.add(vase);
    // contact shadow
    const shadowTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const g = c.getContext('2d'); const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      grd.addColorStop(0, 'rgba(70,40,20,0.55)'); grd.addColorStop(1, 'rgba(70,40,20,0)');
      g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
      return new THREE.CanvasTexture(c);
    })();
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.9), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    shadow.position.y = -1.55;
    hero.add(shadow);
    scene.add(hero);

    const layout = (w, h) => {
      const portrait = frameCamera(camera, w, h, { desktopZ: 9, mobileZ: 13 });
      hero.position.set(portrait ? 0 : 2.5, portrait ? 2.5 : 0.55, 0);
      hero.scale.setScalar(portrait ? 0.72 : 0.92);
      silk.uniforms.uRes.value.set(w, h);
    };
    layout(width, height);

    return {
      resize: layout,
      intro(tl) {
        tl.fromTo(silk.uniforms.uReveal, { value: 0 }, { value: 1, duration: 2.4, ease: 'power2.out' }, 0)
          .from(hero.position, { y: '-=1.5', duration: 2.2, ease: 'expo.out' }, 0.3)
          .from(vase.rotation, { y: -2.5, duration: 2.6, ease: 'expo.out' }, 0.3);
      },
      render(t, dt, { scroll }) {
        silk.uniforms.uTime.value = t;
        silk.uniforms.uMouse.value.set(pointer.x * 0.5 + 0.5, pointer.y * 0.5 + 0.5);
        vase.position.y = Math.sin(t * 0.9) * 0.08;
        vase.rotation.y += dt * 0.15;
        hero.rotation.x = -pointer.y * 0.18;
        hero.rotation.z = -pointer.x * 0.08;
        shadow.scale.setScalar(1 - Math.sin(t * 0.9) * 0.05);
        camera.position.x = pointer.x * 0.25;
        camera.position.y = pointer.y * 0.18 - scroll * 2;
        camera.lookAt(0, -scroll * 2, 0);
        renderer.render(scene, camera);
      }
    };
  }
});
