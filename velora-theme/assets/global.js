/* ==========================================================================
   Velora Immersive — storefront behaviour
   Vanilla JS + native custom elements. No external dependencies.
   ========================================================================== */
(() => {
  'use strict';

  const V = window.Velora || { routes: {}, strings: {}, motion: {} };
  const routes = V.routes || {};
  const strings = V.strings || {};
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const canDepth = () => V.motion && V.motion.depth && !reduceMotion.matches && finePointer.matches;

  /* ---------- Utilities ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const debounce = (fn, wait = 300) => {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
  };
  const parseHTML = (html) => new DOMParser().parseFromString(html, 'text/html');
  const sectionInner = (html, selector) => {
    const doc = parseHTML(html);
    return selector ? doc.querySelector(selector) : doc.body;
  };

  let toastTimer;
  const toast = (message) => {
    const el = $('[data-toast]');
    if (!el) return;
    el.textContent = message;
    el.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-visible'), 3200);
  };

  /* ---------- Dialog drawers (menu, cart) ---------- */
  const Drawer = {
    lastFocus: null,
    open(dialog, opener) {
      if (!dialog || dialog.open) return;
      this.lastFocus = opener || document.activeElement;
      dialog.showModal();
      document.documentElement.classList.add('is-locked');
      requestAnimationFrame(() => dialog.classList.add('is-active'));
      if (opener) opener.setAttribute('aria-expanded', 'true');
      const focusable = dialog.querySelector('[data-drawer-close], a, button, input');
      if (focusable) focusable.focus({ preventScroll: true });
    },
    close(dialog) {
      if (!dialog || !dialog.open) return;
      dialog.classList.remove('is-active');
      const done = () => {
        dialog.close();
        document.documentElement.classList.remove('is-locked');
        $$('[aria-expanded="true"][aria-controls="' + dialog.id + '"]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
        if (this.lastFocus && this.lastFocus.focus) this.lastFocus.focus({ preventScroll: true });
      };
      if (reduceMotion.matches) done(); else setTimeout(done, 380);
    }
  };

  document.addEventListener('click', (e) => {
    const closer = e.target.closest('[data-drawer-close]');
    if (closer) { Drawer.close(closer.closest('dialog')); return; }
    // Click on the dialog backdrop (the dialog element itself) closes it
    if (e.target.matches('dialog[data-drawer]')) Drawer.close(e.target);
    if (e.target.matches('dialog[data-search-modal]')) e.target.close();
  });
  document.addEventListener('cancel', (e) => {
    if (e.target.matches('dialog[data-drawer]')) { e.preventDefault(); Drawer.close(e.target); }
  }, true);

  /* ---------- Header ---------- */
  class HeaderComponent extends HTMLElement {
    connectedCallback() {
      this.sticky = this.dataset.sticky === 'true';
      this.lastY = window.scrollY;
      this.onScroll = this.onScroll.bind(this);
      window.addEventListener('scroll', this.onScroll, { passive: true });
      this.onScroll();
      const menuBtn = $('[data-menu-open]', this);
      if (menuBtn) menuBtn.addEventListener('click', () => Drawer.open($('#MenuDrawer'), menuBtn));
      $$('[data-dropdown]', this).forEach((d) => {
        d.addEventListener('toggle', () => {
          if (d.open) $$('[data-dropdown]', this).forEach((o) => { if (o !== d) o.open = false; });
          this.classList.toggle('is-open', $$('[data-dropdown][open]', this).length > 0);
        });
      });
      document.addEventListener('click', (e) => {
        if (!this.contains(e.target)) $$('[data-dropdown][open]', this).forEach((d) => { d.open = false; });
      });
      this.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          const open = $('[data-dropdown][open]', this);
          if (open) { open.open = false; open.querySelector('summary').focus(); }
        }
      });
    }
    onScroll() {
      if (this.ticking) return;
      this.ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        this.classList.toggle('is-scrolled', y > 20);
        if (this.sticky) {
          const goingDown = y > this.lastY && y > 400;
          const anyOpen = $('[data-dropdown][open]', this);
          this.classList.toggle('is-hidden', goingDown && !anyOpen);
        }
        this.lastY = y;
        this.ticking = false;
      });
    }
  }
  customElements.define('header-component', HeaderComponent);

  /* ---------- Cart ---------- */
  const Cart = {
    drawer() { return $('#CartDrawer'); },
    sectionsToRender() {
      const ids = [];
      if ($('cart-drawer')) ids.push('cart-drawer');
      const page = $('[data-cart-page]');
      if (page) ids.push(page.dataset.sectionId);
      return ids;
    },
    updateCount(count) {
      $$('[data-cart-count]').forEach((el) => {
        el.textContent = count;
        el.classList.toggle('is-empty', count === 0);
        el.classList.remove('is-bump');
        void el.offsetWidth;
        el.classList.add('is-bump');
      });
      $$('[data-cart-count-label]').forEach((el) => {
        el.textContent = el.textContent.replace(/\d+/, count);
      });
    },
    renderSections(sections) {
      if (!sections) return;
      if (sections['cart-drawer']) {
        const fresh = sectionInner(sections['cart-drawer'], '[data-cart-drawer-content]');
        const current = $('[data-cart-drawer-content]');
        if (fresh && current) {
          current.innerHTML = fresh.innerHTML;
          current.dataset.count = fresh.dataset.count;
        }
      }
      const page = $('[data-cart-page]');
      if (page && sections[page.dataset.sectionId]) {
        const fresh = sectionInner(sections[page.dataset.sectionId], '[data-cart-page]');
        if (fresh) { page.innerHTML = fresh.innerHTML; page.dataset.count = fresh.dataset.count; }
      }
    },
    async refreshCount() {
      try {
        const res = await fetch(routes.cart + '.js', { headers: { Accept: 'application/json' } });
        const cart = await res.json();
        this.updateCount(cart.item_count);
      } catch (_) { /* non-critical */ }
    },
    async change(line, quantity, lineEl) {
      if (lineEl) lineEl.classList.add('is-updating');
      try {
        const res = await fetch(routes.cartChange + '.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ line, quantity, sections: this.sectionsToRender(), sections_url: window.location.pathname })
        });
        const data = await res.json();
        if (!res.ok || data.status) throw new Error(data.description || data.message || strings.cartError);
        this.renderSections(data.sections);
        this.updateCount(data.item_count);
        // Shopify caps quantities to available inventory; tell the shopper
        const key = lineEl && lineEl.dataset.lineKey;
        const item = key && data.items && data.items.find((i) => i.key === key);
        if (quantity > 0 && item && item.quantity < quantity) toast(strings.qtyLimited);
        else toast(strings.cartUpdated);
      } catch (err) {
        if (lineEl) lineEl.classList.remove('is-updating');
        toast(err.message || strings.cartError);
      }
    },
    open(opener) {
      const d = this.drawer();
      if (d) Drawer.open(d, opener);
    }
  };

  class CartDrawer extends HTMLElement {
    connectedCallback() {
      document.addEventListener('click', (e) => {
        const opener = e.target.closest('[data-cart-open]');
        if (opener && V.cartType === 'drawer' && this.querySelector('dialog')) {
          e.preventDefault();
          Cart.open(opener);
        }
      });
    }
  }
  customElements.define('cart-drawer', CartDrawer);

  // Cart line interactions (drawer + cart page), delegated
  const lineQtyChange = debounce((input) => {
    const lineEl = input.closest('[data-line]');
    const qty = Math.max(0, parseInt(input.value, 10) || 0);
    Cart.change(parseInt(lineEl.dataset.line, 10), qty, lineEl);
  }, 350);

  document.addEventListener('change', (e) => {
    const input = e.target;
    if (input.matches('.qty__input[data-line]')) lineQtyChange(input);
    if (input.matches('[data-cart-note]')) {
      fetch(routes.cartUpdate + '.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ note: input.value })
      });
    }
  });
  document.addEventListener('click', (e) => {
    const remove = e.target.closest('[data-line-remove]');
    if (remove) {
      e.preventDefault();
      const lineEl = remove.closest('[data-line]');
      Cart.change(parseInt(remove.dataset.lineRemove, 10), 0, lineEl);
    }
  });

  /* ---------- Quantity input ---------- */
  class QuantityInput extends HTMLElement {
    connectedCallback() {
      this.input = this.querySelector('input');
      this.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const step = btn.name === 'plus' ? 1 : -1;
        const min = parseInt(this.input.min, 10);
        const max = this.input.max ? parseInt(this.input.max, 10) : Infinity;
        const next = Math.min(max, Math.max(isNaN(min) ? 0 : min, (parseInt(this.input.value, 10) || 0) + step));
        if (String(next) !== this.input.value) {
          this.input.value = next;
          this.input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
    }
  }
  customElements.define('quantity-input', QuantityInput);

  /* ---------- Add to cart (product page + quick add) ---------- */
  const addToCart = async (form) => {
    const button = form.querySelector('[data-add-button]') || form.querySelector('[type="submit"]');
    const errorEl = form.querySelector('[data-form-error]');
    if (!button || button.getAttribute('aria-disabled') === 'true' || button.classList.contains('is-loading')) return;
    button.classList.add('is-loading');
    button.setAttribute('aria-disabled', 'true');
    if (errorEl) errorEl.hidden = true;

    const formData = new FormData(form);
    // Quantity input may live outside the form element in some layouts
    const sections = Cart.sectionsToRender();
    if (sections.length) {
      formData.append('sections', sections.join(','));
      formData.append('sections_url', window.location.pathname);
    }
    try {
      const res = await fetch(routes.cartAdd + '.js', {
        method: 'POST',
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: formData
      });
      const data = await res.json();
      if (!res.ok || data.status) throw new Error(data.description || data.message || strings.cartError);
      Cart.renderSections(data.sections);
      await Cart.refreshCount();
      if (V.cartType === 'drawer' && Cart.drawer()) {
        Cart.open(button);
      } else {
        toast(strings.added);
      }
      document.dispatchEvent(new CustomEvent('velora:cart-added', { detail: data }));
    } catch (err) {
      if (errorEl) { errorEl.textContent = err.message; errorEl.hidden = false; }
      else toast(err.message);
    } finally {
      button.classList.remove('is-loading');
      button.removeAttribute('aria-disabled');
    }
  };

  document.addEventListener('submit', (e) => {
    const form = e.target;
    if (!form.matches('[data-product-form]')) return;
    // Let the browser handle buy-now / accelerated checkout buttons natively
    if (e.submitter && e.submitter.name === 'checkout') return;
    e.preventDefault();
    addToCart(form);
  });

  /* ---------- Variant picker ---------- */
  class VariantPicker extends HTMLElement {
    connectedCallback() {
      const json = this.querySelector('[data-variants]');
      this.variants = json ? JSON.parse(json.textContent) : [];
      this.form = document.getElementById(this.dataset.formId);
      this.section = this.closest('.pdp') || document;
      this.addEventListener('change', () => this.onChange());
      this.markAvailability();
    }
    selectedOptions() {
      return $$('fieldset', this).map((fs) => {
        const checked = fs.querySelector('input:checked');
        return checked ? checked.value : null;
      });
    }
    findVariant(options) {
      return this.variants.find((v) => v.options.every((o, i) => o === options[i]));
    }
    markAvailability() {
      const selected = this.selectedOptions();
      $$('fieldset', this).forEach((fs, index) => {
        $$('input', fs).forEach((input) => {
          const candidate = selected.slice();
          candidate[index] = input.value;
          const match = this.variants.find((v) => v.options.every((o, i) => o === candidate[i]));
          const unavailable = !match || !match.available;
          input.classList.toggle('is-unavailable', unavailable);
          const label = input.nextElementSibling && input.nextElementSibling.querySelector('[data-unavailable-label]');
          if (label) label.hidden = !unavailable;
        });
        const out = $('[data-selected-value="' + index + '"]', this);
        if (out) out.textContent = selected[index] || '';
      });
    }
    async onChange() {
      const options = this.selectedOptions();
      const variant = this.findVariant(options);
      this.markAvailability();
      const idInput = this.form && this.form.querySelector('[data-variant-id]');
      const addBtn = this.form && this.form.querySelector('[data-add-button]');
      const stickyBtn = document.querySelector('[data-sticky-add]');

      if (!variant) {
        if (idInput) idInput.disabled = true;
        if (addBtn) { addBtn.disabled = true; const l = addBtn.querySelector('[data-label]'); if (l) l.textContent = strings.unavailable; }
        if (stickyBtn) stickyBtn.disabled = true;
        const avail = this.section && this.section.querySelector('[data-fragment="availability"]');
        if (avail) avail.innerHTML = '<span class="stock stock--out">' + strings.unavailable + '</span>';
        return;
      }

      if (idInput) { idInput.value = variant.id; idInput.disabled = !variant.available; }
      if (this.dataset.updateUrl === 'true') {
        const url = new URL(window.location.href);
        url.searchParams.set('variant', variant.id);
        window.history.replaceState({}, '', url.toString());
      }
      if (variant.media) document.dispatchEvent(new CustomEvent('velora:variant-media', { detail: { mediaId: variant.media } }));

      // Re-render price / availability / button using Shopify's own Liquid output
      try {
        const url = this.dataset.url + (this.dataset.url.includes('?') ? '&' : '?') + 'variant=' + variant.id + '&section_id=' + this.dataset.sectionId;
        const res = await fetch(url);
        const doc = parseHTML(await res.text());
        $$('[data-fragment]', this.section).forEach((el) => {
          const fresh = doc.getElementById(el.id);
          if (fresh && el.id) el.innerHTML = fresh.innerHTML;
        });
        const freshBtn = doc.querySelector('[data-add-button]');
        if (addBtn && freshBtn) addBtn.disabled = freshBtn.disabled;
        if (stickyBtn) stickyBtn.disabled = !variant.available;
        // keep installments (Shop Pay) in sync
        const inst = this.section.querySelector('.installments [name="id"]');
        if (inst) inst.value = variant.id;
      } catch (_) {
        if (addBtn) addBtn.disabled = !variant.available;
      }
    }
  }
  customElements.define('variant-picker', VariantPicker);

  /* ---------- Product media gallery ---------- */
  class MediaGallery extends HTMLElement {
    connectedCallback() {
      this.track = $('[data-slides]', this);
      this.slides = $$('.pdp__slide', this);
      this.thumbs = $$('[data-thumb]', this);
      this.counter = $('[data-gallery-index]', this);
      if (!this.track) return;
      this.thumbs.forEach((t) => t.addEventListener('click', () => this.goTo(t.dataset.thumb)));
      const prev = $('[data-gallery-prev]', this);
      const next = $('[data-gallery-next]', this);
      if (prev) prev.addEventListener('click', () => this.step(-1));
      if (next) next.addEventListener('click', () => this.step(1));
      this.track.addEventListener('scroll', debounce(() => this.syncFromScroll(), 80), { passive: true });
      document.addEventListener('velora:variant-media', (e) => this.goTo(String(e.detail.mediaId)));
      const active = $('.pdp__slide.is-active', this);
      if (active && active !== this.slides[0]) this.track.scrollLeft = active.offsetLeft;
    }
    index() { return Math.round(this.track.scrollLeft / this.track.clientWidth); }
    step(dir) {
      const i = Math.min(this.slides.length - 1, Math.max(0, this.index() + dir));
      this.scrollToIndex(i);
    }
    goTo(mediaId) {
      const i = this.slides.findIndex((s) => s.dataset.mediaId === mediaId);
      if (i > -1) this.scrollToIndex(i);
    }
    scrollToIndex(i) {
      this.track.scrollTo({ left: this.slides[i].offsetLeft, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
      this.setActive(i);
    }
    syncFromScroll() { this.setActive(this.index()); }
    setActive(i) {
      this.slides.forEach((s, n) => {
        s.classList.toggle('is-active', n === i);
        // pause videos that leave the viewport
        if (n !== i) $$('video', s).forEach((v) => v.pause());
      });
      this.thumbs.forEach((t, n) => t.setAttribute('aria-current', n === i ? 'true' : 'false'));
      if (this.counter) this.counter.textContent = i + 1;
      const thumb = this.thumbs[i];
      if (thumb) thumb.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    }
  }
  customElements.define('media-gallery', MediaGallery);

  /* ---------- 3D depth scene (pointer parallax) ---------- */
  class DepthScene extends HTMLElement {
    connectedCallback() {
      const host = this.closest('.hero, .spotlight') || this;
      // Pause ambient animations when off screen
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(([entry]) => host.classList.toggle('is-offscreen', !entry.isIntersecting)).observe(host);
      }
      if (!canDepth()) return;
      this.target = host;
      this.frame = null;
      this.onMove = (e) => {
        if (this.frame) return;
        this.frame = requestAnimationFrame(() => {
          const r = this.target.getBoundingClientRect();
          const x = ((e.clientX - r.left) / r.width) * 2 - 1;
          const y = ((e.clientY - r.top) / r.height) * 2 - 1;
          this.style.setProperty('--mx', x.toFixed(3));
          this.style.setProperty('--my', y.toFixed(3));
          if (this.target.classList.contains('hero')) {
            this.target.style.setProperty('--mx', x.toFixed(3));
            this.target.style.setProperty('--my', y.toFixed(3));
          }
          this.frame = null;
        });
      };
      this.onLeave = () => {
        this.style.setProperty('--mx', 0);
        this.style.setProperty('--my', 0);
        this.target.style.setProperty('--mx', 0);
        this.target.style.setProperty('--my', 0);
      };
      this.target.addEventListener('pointermove', this.onMove, { passive: true });
      this.target.addEventListener('pointerleave', this.onLeave);
    }
    disconnectedCallback() {
      if (this.target) {
        this.target.removeEventListener('pointermove', this.onMove);
        this.target.removeEventListener('pointerleave', this.onLeave);
      }
    }
  }
  customElements.define('depth-scene', DepthScene);

  /* ---------- Card tilt ---------- */
  const initTilt = (root = document) => {
    if (!canDepth()) return;
    $$('[data-tilt]', root).forEach((el) => {
      if (el.dataset.tiltReady) return;
      el.dataset.tiltReady = '1';
      let frame;
      el.addEventListener('pointermove', (e) => {
        if (frame) return;
        frame = requestAnimationFrame(() => {
          const r = el.getBoundingClientRect();
          const x = (e.clientX - r.left) / r.width - 0.5;
          const y = (e.clientY - r.top) / r.height - 0.5;
          el.style.setProperty('--ry', (x * 8).toFixed(2) + 'deg');
          el.style.setProperty('--rx', (y * -8).toFixed(2) + 'deg');
          frame = null;
        });
      }, { passive: true });
      el.addEventListener('pointerleave', () => {
        el.style.setProperty('--rx', '0deg');
        el.style.setProperty('--ry', '0deg');
      });
    });
  };

  /* ---------- Scroll reveal + parallax ---------- */
  const splitWords = (el) => {
    if (el.dataset.split) return;
    el.dataset.split = '1';
    let n = 0;
    const walk = (node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            const span = document.createElement('span');
            span.className = 'word';
            span.style.setProperty('--w', n++);
            span.textContent = part;
            frag.appendChild(span);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1) {
          walk(child);
        }
      });
    };
    walk(el);
  };

  let revealObserver;
  const initReveal = (root = document) => {
    const targets = $$('[data-reveal], [data-reveal-words]', root);
    if (!V.motion || !V.motion.reveal || reduceMotion.matches || !('IntersectionObserver' in window)) {
      targets.forEach((t) => t.classList.add('is-revealed'));
      return;
    }
    if (!revealObserver) {
      revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
            revealObserver.unobserve(entry.target);
          }
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    }
    targets.forEach((t) => {
      if (t.hasAttribute('data-reveal-words')) splitWords(t);
      revealObserver.observe(t);
    });
  };

  const initParallax = () => {
    if (reduceMotion.matches || !('IntersectionObserver' in window)) return;
    const items = $$('[data-parallax]');
    if (!items.length) return;
    const active = new Set();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? active.add(e.target) : active.delete(e.target)));
    }, { rootMargin: '20% 0px' });
    items.forEach((el) => io.observe(el));
    let ticking = false;
    const update = () => {
      const vh = window.innerHeight;
      active.forEach((el) => {
        const r = el.getBoundingClientRect();
        const offset = (r.top + r.height / 2 - vh / 2) * parseFloat(el.dataset.parallax);
        el.style.transform = 'translate3d(0,' + offset.toFixed(1) + 'px,0)';
      });
      ticking = false;
    };
    window.addEventListener('scroll', () => {
      if (!ticking && active.size) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  };

  /* ---------- Hotspots ---------- */
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-hotspot]');
    $$('[data-hotspot][aria-expanded="true"]').forEach((b) => {
      if (b !== btn) { b.setAttribute('aria-expanded', 'false'); document.getElementById(b.getAttribute('aria-controls')).hidden = true; }
    });
    if (!btn) return;
    const card = document.getElementById(btn.getAttribute('aria-controls'));
    const open = btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', String(open));
    card.hidden = !open;
  });

  /* ---------- Search modal + predictive search ---------- */
  document.addEventListener('click', (e) => {
    const opener = e.target.closest('[data-search-open]');
    const modal = $('[data-search-modal]');
    if (opener && modal && typeof modal.showModal === 'function') {
      e.preventDefault();
      modal.showModal();
      const input = $('input[type="search"]', modal);
      if (input) input.focus();
    }
    if (e.target.closest('[data-search-close]')) e.target.closest('dialog').close();
  });
  // Escape inside a search input clears it natively without closing the dialog; close explicitly.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const modal = e.target.closest && e.target.closest('dialog[data-search-modal]');
    if (modal && modal.open) { e.preventDefault(); modal.close(); }
  });
  document.addEventListener('close', (e) => {
    if (e.target.matches && e.target.matches('dialog[data-search-modal]')) {
      const opener = $('[data-search-open]');
      if (opener) opener.focus({ preventScroll: true });
    }
  }, true);

  class PredictiveSearch extends HTMLElement {
    connectedCallback() {
      this.input = $('input[type="search"]', this);
      this.results = $('[data-predictive-results]', this);
      this.status = $('[data-predictive-status]', this);
      this.controller = null;
      this.input.addEventListener('input', debounce(() => this.search(), 260));
      this.input.addEventListener('keydown', (e) => this.onKey(e));
    }
    async search() {
      const q = this.input.value.trim();
      if (!q) { this.results.innerHTML = ''; this.input.setAttribute('aria-expanded', 'false'); return; }
      if (this.controller) this.controller.abort();
      this.controller = new AbortController();
      try {
        const url = routes.predictiveSearch + '?q=' + encodeURIComponent(q) +
          '&resources[type]=product,collection,page,query&resources[limit]=6&resources[options][unavailable_products]=last&section_id=predictive-search';
        const res = await fetch(url, { signal: this.controller.signal });
        if (!res.ok) throw new Error(res.status);
        const doc = parseHTML(await res.text());
        const content = doc.querySelector('.predictive__results');
        this.results.innerHTML = content ? content.outerHTML : '';
        this.input.setAttribute('aria-expanded', content ? 'true' : 'false');
        if (this.status && content) this.status.textContent = content.dataset.resultsCount + ' results';
      } catch (err) {
        if (err.name !== 'AbortError') this.results.innerHTML = '';
      }
    }
    onKey(e) {
      const options = $$('[role="option"] a', this.results);
      if (!options.length || !['ArrowDown', 'ArrowUp'].includes(e.key)) return;
      e.preventDefault();
      const current = options.findIndex((o) => o.getAttribute('aria-selected') === 'true');
      options.forEach((o) => o.removeAttribute('aria-selected'));
      const next = e.key === 'ArrowDown' ? (current + 1) % options.length : (current - 1 + options.length) % options.length;
      options[next].setAttribute('aria-selected', 'true');
      options[next].focus();
    }
  }
  customElements.define('predictive-search', PredictiveSearch);

  /* ---------- Collection / search filtering ---------- */
  class FacetFilters extends HTMLElement {
    connectedCallback() {
      this.form = $('[data-facet-form]', this);
      this.sectionId = this.dataset.sectionId;
      const toggle = $('[data-facet-toggle]', this);
      if (toggle) toggle.addEventListener('click', () => this.setOpen(true));
      $$('[data-facet-close]', this).forEach((b) => b.addEventListener('click', () => this.setOpen(false)));
      this.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.setOpen(false); });
      this.form.addEventListener('change', debounce(() => this.apply(), 400));
      this.form.addEventListener('submit', (e) => { e.preventDefault(); this.apply(); });
    }
    setOpen(open) {
      this.classList.toggle('is-open', open);
      document.documentElement.classList.toggle('is-locked', open);
      const toggle = $('[data-facet-toggle]', this);
      if (toggle) toggle.setAttribute('aria-expanded', String(open));
      if (open) { const first = $('.facets__panel button, .facets__panel input', this); if (first) first.focus(); }
      else if (toggle) toggle.focus();
    }
    apply() {
      const params = new URLSearchParams(new FormData(this.form));
      // Drop empty price inputs
      Array.from(params.keys()).forEach((k) => { if (params.get(k) === '') params.delete(k); });
      FacetFilters.render(this.form.action.split('?')[0] + '?' + params.toString(), this.sectionId, this.classList.contains('is-open'));
    }
    static async render(url, sectionId, keepOpen) {
      const root = document.querySelector('[data-facet-root]');
      const results = $('[data-facet-results]', root);
      if (results) results.classList.add('is-loading');
      try {
        const fetchUrl = url + (url.includes('?') ? '&' : '?') + 'section_id=' + sectionId;
        const res = await fetch(fetchUrl);
        const doc = parseHTML(await res.text());
        const fresh = doc.querySelector('[data-facet-root]');
        if (fresh && root) {
          root.innerHTML = fresh.innerHTML;
          window.history.pushState({ facets: true }, '', url);
          initReveal(root);
          initTilt(root);
          const facets = $('facet-filters', root);
          if (keepOpen && facets) facets.setOpen(true);
        }
      } catch (_) {
        window.location.href = url;
      }
    }
  }
  customElements.define('facet-filters', FacetFilters);

  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-facet-link]');
    const facets = $('facet-filters');
    if (!link || !facets) return;
    e.preventDefault();
    FacetFilters.render(link.href, facets.dataset.sectionId, false);
  });
  window.addEventListener('popstate', (e) => {
    if (e.state && e.state.facets) window.location.reload();
  });

  /* ---------- Product recommendations ---------- */
  class ProductRecommendations extends HTMLElement {
    connectedCallback() {
      if (this.children.length || !this.dataset.url) return;
      const load = async () => {
        try {
          const res = await fetch(this.dataset.url);
          const doc = parseHTML(await res.text());
          const fresh = doc.querySelector('product-recommendations');
          if (fresh && fresh.innerHTML.trim()) {
            this.innerHTML = fresh.innerHTML;
            initReveal(this);
          }
        } catch (_) { /* leave empty */ }
      };
      if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver(([entry]) => {
          if (entry.isIntersecting) { io.disconnect(); load(); }
        }, { rootMargin: '0px 0px 400px 0px' });
        io.observe(this);
      } else load();
    }
  }
  customElements.define('product-recommendations', ProductRecommendations);

  /* ---------- Recently viewed (stored only in this browser) ---------- */
  const RV_KEY = 'velora:recently-viewed';
  const readRecent = () => {
    try { return JSON.parse(localStorage.getItem(RV_KEY)) || []; } catch (_) { return []; }
  };
  const pdp = $('[data-recently-viewed]');
  if (pdp) {
    try {
      const handle = pdp.dataset.recentlyViewed;
      const list = readRecent().filter((h) => h !== handle);
      list.unshift(handle);
      localStorage.setItem(RV_KEY, JSON.stringify(list.slice(0, 8)));
    } catch (_) { /* storage unavailable */ }
  }
  class RecentlyViewed extends HTMLElement {
    async connectedCallback() {
      const limit = parseInt(this.dataset.limit, 10) || 4;
      const handles = readRecent().filter((h) => h !== this.dataset.current).slice(0, limit);
      if (!handles.length) return;
      const list = $('[data-recent-list]', this);
      const cards = await Promise.all(handles.map(async (h) => {
        try {
          const res = await fetch(routes.root.replace(/\/$/, '') + '/products/' + encodeURIComponent(h) + '?section_id=product-card-fragment');
          if (!res.ok) return '';
          const doc = parseHTML(await res.text());
          const li = doc.querySelector('.product-grid__item');
          return li ? li.outerHTML : '';
        } catch (_) { return ''; }
      }));
      const html = cards.join('');
      if (html) { list.innerHTML = html; this.hidden = false; }
    }
  }
  customElements.define('recently-viewed', RecentlyViewed);

  /* ---------- Share ---------- */
  class ShareButton extends HTMLElement {
    connectedCallback() {
      const btn = $('[data-share]', this);
      const status = $('[data-share-status]', this);
      btn.addEventListener('click', async () => {
        const data = { title: this.dataset.title, url: this.dataset.url };
        try {
          if (navigator.share) await navigator.share(data);
          else {
            await navigator.clipboard.writeText(data.url);
            if (status) status.textContent = strings.copied;
            toast(strings.copied);
          }
        } catch (_) { /* user cancelled */ }
      });
    }
  }
  customElements.define('share-button', ShareButton);

  /* ---------- Newsletter validation ---------- */
  document.addEventListener('submit', (e) => {
    const form = e.target;
    if (!form.matches('[data-newsletter]')) return;
    const input = form.querySelector('input[type="email"]');
    const msg = form.querySelector('.newsletter-form__msg');
    const valid = input && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.value.trim());
    if (!valid) {
      e.preventDefault();
      input.setAttribute('aria-invalid', 'true');
      if (msg) { msg.textContent = strings.emailInvalid; msg.className = 'newsletter-form__msg is-error'; }
      input.focus();
    } else {
      input.removeAttribute('aria-invalid');
    }
  });

  /* ---------- Misc ---------- */
  document.addEventListener('change', (e) => {
    if (e.target.matches('[data-autosubmit]')) e.target.form.submit();
  });
  document.addEventListener('submit', (e) => {
    const msg = e.target.dataset && e.target.dataset.confirm;
    if (msg && !window.confirm(msg)) e.preventDefault();
  });

  // Sticky add-to-cart bar
  const stickyBuy = $('[data-sticky-buy]');
  const buyBlock = $('.pdp__buy');
  if (stickyBuy && buyBlock && 'IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      const past = entry.boundingClientRect.top < 0;
      const show = !entry.isIntersecting && past;
      stickyBuy.classList.toggle('is-visible', show);
      stickyBuy.setAttribute('aria-hidden', String(!show));
      const btn = $('[data-sticky-add]', stickyBuy);
      if (btn) btn.tabIndex = show ? 0 : -1;
    }).observe(buyBlock);
  }

  // 3D models: load Shopify's model viewer UI + AR only when a model exists
  if ($('model-viewer') && window.Shopify && typeof window.Shopify.loadFeatures === 'function') {
    window.Shopify.loadFeatures([
      { name: 'model-viewer-ui', version: '1.0', onLoad: (err) => { if (err) return; $$('model-viewer').forEach((mv) => { if (window.Shopify.ModelViewerUI) new window.Shopify.ModelViewerUI(mv); }); } },
      { name: 'shopify-xr', version: '1.0', onLoad: (err) => {
        if (err) return;
        const json = $('[data-product-models]');
        if (json && window.ShopifyXR) { window.ShopifyXR.addModels(JSON.parse(json.textContent)); window.ShopifyXR.setupXRElements(); }
      } }
    ]);
  }

  // Theme editor support: re-init effects when sections reload
  document.addEventListener('shopify:section:load', (e) => { initReveal(e.target); initTilt(e.target); });

  initReveal();
  initTilt();
  initParallax();
})();
