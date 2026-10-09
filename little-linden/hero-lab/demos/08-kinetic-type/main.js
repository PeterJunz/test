// 08 · Kinetic Typography
// Technique: editorial headline split into words that rise in from masks (GSAP),
// then the italic phrase cycles through short lines with a blur/mask transition.
// Behind it, a single LineSegments draw call renders ~70 fine "thread" lines whose
// vertices are displaced in the vertex shader by slow waves and bend around the
// cursor. Accessible: the heading keeps a stable text for screen readers, rotation
// pauses on hover/focus and is disabled with prefers-reduced-motion.
import { boot, THREE, gsap, frameCamera, reducedMotion } from '../../shared/core.js';

function splitWords(el) {
  const words = [];
  const walk = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === 3) {
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(part); return; }
          const outer = document.createElement('span');
          outer.className = 'kw';
          const inner = document.createElement('span');
          inner.className = 'kw-i';
          inner.textContent = part;
          outer.append(inner);
          frag.append(outer);
          words.push(inner);
        });
        child.replaceWith(frag);
      } else if (child.nodeType === 1 && !child.hasAttribute('data-kinetic')) walk(child);
    });
  };
  walk(el);
  return words;
}

boot({
  slug: '08-kinetic-type',
  renderer: { toneMapping: false },
  setup({ renderer, hero, pointer, width, height, small }) {
    // ---------- Kinetic headline
    const style = document.createElement('style');
    style.textContent = `.kw{display:inline-block;overflow:hidden;vertical-align:top;padding-bottom:.08em;margin-bottom:-.08em}
      .kw-i{display:inline-block}
      [data-kinetic]{display:inline-block;position:relative}
      [data-kinetic] .kin-line{display:inline-block}`;
    document.head.append(style);
    const title = hero.querySelector('.ll-title');
    const kinetic = title.querySelector('[data-kinetic]');
    const phrases = kinetic.dataset.kinetic.split('|');
    // Screen readers get one stable heading; the animated phrase is decorative.
    title.setAttribute('aria-label', title.textContent.trim());
    kinetic.setAttribute('aria-hidden', 'true');
    kinetic.innerHTML = `<span class="kin-line">${phrases[0]}</span>`;
    const words = splitWords(title);
    const line = () => kinetic.querySelector('.kin-line');

    let i = 0;
    let paused = false;
    hero.addEventListener('pointerenter', () => { paused = true; });
    hero.addEventListener('pointerleave', () => { paused = false; });
    hero.addEventListener('focusin', () => { paused = true; });
    hero.addEventListener('focusout', () => { paused = false; });
    const cycle = () => {
      if (paused || document.hidden) return;
      i = (i + 1) % phrases.length;
      const el = line();
      gsap.timeline()
        .to(el, { yPercent: -60, opacity: 0, filter: 'blur(10px)', duration: 0.6, ease: 'power2.in' })
        .add(() => { el.textContent = phrases[i]; })
        .fromTo(el, { yPercent: 60, opacity: 0, filter: 'blur(10px)' }, { yPercent: 0, opacity: 1, filter: 'blur(0px)', duration: 0.9, ease: 'expo.out', clearProps: 'filter' });
    };
    const timer = reducedMotion ? null : setInterval(cycle, 3600);

    // ---------- Thread lines (single draw call)
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#F6ECE7');
    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
    camera.position.set(0, 0, 10);
    const ROWS = small ? 40 : 70, SEG = small ? 90 : 160;
    const pos = [], row = [], u = [];
    for (let r = 0; r < ROWS; r++) {
      for (let s = 0; s < SEG; s++) {
        for (const k of [s, s + 1]) {
          const x = (k / SEG - 0.5) * 26;
          pos.push(x, (r / (ROWS - 1) - 0.5) * 14, 0);
          row.push(r / (ROWS - 1));
          u.push(k / SEG);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('aRow', new THREE.Float32BufferAttribute(row, 1));
    geo.setAttribute('aU', new THREE.Float32BufferAttribute(u, 1));
    const lineMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uTime: { value: 0 }, uMouse: { value: new THREE.Vector2(99, 99) }, uReveal: { value: reducedMotion ? 1 : 0 } },
      vertexShader: /* glsl */`
        attribute float aRow; attribute float aU; uniform float uTime, uReveal; uniform vec2 uMouse;
        varying float vRow; varying float vU; varying float vBend;
        void main(){
          vec3 p = position;
          float t = uTime * 0.35;
          p.y += sin(p.x * 0.35 + t + aRow * 5.0) * 0.35 + sin(p.x * 0.12 - t * 0.6 + aRow * 2.0) * 0.6;
          p.z += sin(p.x * 0.2 + aRow * 6.0 + t) * 0.6;
          vec2 d = p.xy - uMouse;
          float bend = exp(-dot(d, d) * 0.18);
          p.y += sign(d.y) * bend * 0.9;          // threads part around the cursor
          vRow = aRow; vU = aU; vBend = bend;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */`
        varying float vRow; varying float vU; varying float vBend; uniform float uReveal;
        void main(){
          vec3 rose = vec3(0.80, 0.58, 0.55); vec3 sage = vec3(0.56, 0.62, 0.53);
          vec3 col = mix(rose, sage, vRow);
          float edge = smoothstep(0.0, 0.18, vU) * smoothstep(1.0, 0.82, vU);
          float reveal = 1.0 - smoothstep(uReveal - 0.15, uReveal, vU);   // threads draw in left → right
          gl_FragColor = vec4(col + vBend * 0.15, (0.22 + vBend * 0.4) * edge * reveal);
        }`
    });
    const threads = new THREE.LineSegments(geo, lineMat);
    threads.rotation.z = -0.12;
    scene.add(threads);

    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const hit = new THREE.Vector3();
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const local = new THREE.Vector3();

    const layout = (w, h) => {
      const portrait = frameCamera(camera, w, h, { desktopZ: 10, mobileZ: 14 });
      threads.position.y = portrait ? 2.5 : 0;
    };
    layout(width, height);

    return {
      scene,
      resize: layout,
      dispose() { if (timer) clearInterval(timer); style.remove(); },
      intro(tl) {
        tl.from(words, { yPercent: 110, rotate: 3, duration: 1.2, stagger: 0.07, ease: 'expo.out' }, 0.45)
          .fromTo(line(), { yPercent: 110 }, { yPercent: 0, duration: 1.2, ease: 'expo.out' }, 0.75)
          .to(lineMat.uniforms.uReveal, { value: 1.15, duration: 2.6, ease: 'power2.inOut' }, 0);
      },
      render(t, dt, { scroll }) {
        lineMat.uniforms.uTime.value = t;
        ndc.set(pointer.x, pointer.y);
        ray.setFromCamera(ndc, camera);
        if (ray.ray.intersectPlane(plane, hit)) {
          local.copy(hit);
          threads.worldToLocal(local);
          lineMat.uniforms.uMouse.value.lerp(new THREE.Vector2(local.x, local.y), 0.1);
        }
        // tilt + parallax of the thread field
        threads.rotation.x = -pointer.y * 0.25;
        threads.rotation.y = pointer.x * 0.3;
        camera.position.y = -scroll * 2;
        renderer.render(scene, camera);
      }
    };
  }
});
