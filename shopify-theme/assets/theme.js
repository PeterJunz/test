/* Vitalia theme – JavaScript */
(() => {
  const theme = window.theme || {};
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function formatMoney(cents) {
    const format = theme.moneyFormat || '{{amount}}';
    const value = Number(cents) / 100;
    const withDelimiters = (num, decimals, thousands, decimal) => {
      const [int, frac] = num.toFixed(decimals).split('.');
      return int.replace(/\B(?=(\d{3})+(?!\d))/g, thousands) + (frac ? decimal + frac : '');
    };
    return format.replace(/\{\{\s*(\w+)\s*\}\}/, (_, key) => {
      switch (key) {
        case 'amount_no_decimals': return withDelimiters(value, 0, ',', '.');
        case 'amount_with_comma_separator': return withDelimiters(value, 2, '.', ',');
        case 'amount_no_decimals_with_comma_separator': return withDelimiters(value, 0, '.', ',');
        case 'amount_with_space_separator': return withDelimiters(value, 2, ' ', ',');
        case 'amount_no_decimals_with_space_separator': return withDelimiters(value, 0, ' ', ',');
        case 'amount_with_apostrophe_separator': return withDelimiters(value, 2, "'", '.');
        default: return withDelimiters(value, 2, ',', '.');
      }
    });
  }

  /* ---------- Thanh thông báo ---------- */
  $$('[data-announcement]').forEach((track) => {
    const items = $$('.announcement__item', track);
    if (items.length < 2) return;
    let index = 0;
    const speed = (Number(track.dataset.speed) || 5) * 1000;
    setInterval(() => {
      const current = items[index];
      index = (index + 1) % items.length;
      current.classList.remove('is-active');
      current.classList.add('is-leaving');
      items[index].classList.add('is-active');
      setTimeout(() => current.classList.remove('is-leaving'), 600);
    }, speed);
  });

  /* ---------- Menu mobile ---------- */
  const mobileNav = $('[data-mobile-nav]');
  if (mobileNav) {
    mobileNav.addEventListener('toggle', () => {
      const header = $('[data-header]');
      if (header) {
        const bottom = header.getBoundingClientRect().bottom;
        document.documentElement.style.setProperty('--mobile-nav-top', `${bottom}px`);
      }
      document.body.style.overflow = mobileNav.open ? 'hidden' : '';
    });
  }

  /* ---------- Toast ---------- */
  const toast = $('#CartToast');
  let toastTimer;
  function showToast(message, isError = false) {
    if (!toast) return;
    $('.toast__text', toast).textContent = message;
    toast.classList.toggle('is-error', isError);
    $('.toast__link', toast).hidden = isError;
    requestAnimationFrame(() => toast.classList.add('is-visible'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 3200);
  }

  async function refreshCartCount() {
    try {
      const res = await fetch(`${theme.routes.cart_url}.js`, { headers: { Accept: 'application/json' } });
      const cart = await res.json();
      $$('[data-cart-count]').forEach((el) => {
        el.textContent = cart.item_count;
        el.hidden = cart.item_count === 0;
        el.classList.remove('is-bumped');
        void el.offsetWidth;
        el.classList.add('is-bumped');
      });
    } catch (e) { /* bỏ qua */ }
  }

  /* ---------- Thêm vào giỏ bằng AJAX ---------- */
  document.addEventListener('submit', async (event) => {
    const form = event.target.closest('form[data-ajax-cart]');
    if (!form) return;
    // Nút thanh toán nhanh (Buy it now) không đi qua submit thường
    event.preventDefault();
    const button = $('button[type="submit"]', form);
    button?.setAttribute('aria-busy', 'true');
    if (button) button.disabled = true;
    try {
      const res = await fetch(`${theme.routes.cart_add_url}.js`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new FormData(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.description || data.message || theme.strings.error);
      showToast(theme.strings.added);
      refreshCartCount();
    } catch (err) {
      showToast(err.message || theme.strings.error, true);
    } finally {
      button?.removeAttribute('aria-busy');
      if (button && !button.hasAttribute('data-sold-out')) button.disabled = false;
    }
  });

  /* ---------- Bộ chọn số lượng ---------- */
  document.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-qty-minus], [data-qty-plus]');
    if (!btn) return;
    const input = $('input', btn.closest('[data-qty]'));
    const min = Number(input.min || 0);
    const step = btn.hasAttribute('data-qty-plus') ? 1 : -1;
    input.value = Math.max(min, (Number(input.value) || 0) + step);
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });

  /* Tự cập nhật giỏ hàng khi đổi số lượng */
  let cartUpdateTimer;
  document.addEventListener('change', (event) => {
    if (event.target.matches('[data-auto-update]')) {
      clearTimeout(cartUpdateTimer);
      cartUpdateTimer = setTimeout(() => {
        const form = event.target.form;
        const update = document.createElement('input');
        update.type = 'hidden';
        update.name = 'update';
        update.value = '1';
        form.appendChild(update);
        form.submit();
      }, 600);
    }
    if (event.target.matches('[data-auto-submit]')) event.target.form.submit();
  });

  /* ---------- Trang sản phẩm: chọn biến thể & ảnh ---------- */
  $$('[data-product]').forEach((section) => {
    const jsonEl = $('[data-product-json]', section);
    const form = $('[data-product-form]', section);
    const product = jsonEl ? JSON.parse(jsonEl.textContent) : null;

    const showMedia = (mediaId) => {
      if (!mediaId) return;
      $$('[data-media-id]', section).forEach((el) => el.classList.toggle('is-active', el.dataset.mediaId === String(mediaId)));
      $$('[data-thumb]', section).forEach((el) => el.classList.toggle('is-active', el.dataset.thumb === String(mediaId)));
    };

    $$('[data-thumb]', section).forEach((thumb) => thumb.addEventListener('click', () => showMedia(thumb.dataset.thumb)));
    const firstActive = $('[data-media-id].is-active', section);
    if (firstActive) showMedia(firstActive.dataset.mediaId);

    if (!product || !form) return;
    const idInput = $('[data-variant-id]', form);
    const addButton = $('[data-add-button]', form);
    const addLabel = $('[data-add-label]', form);
    const priceCurrent = $('[data-price-current]', section);
    const priceCompare = $('[data-price-compare]', section);
    const priceWrap = $('[data-price]', section);
    const discountBadge = $('[data-discount-badge]', section);

    const selectedOptions = () => product.options.map((_, i) => {
      const checked = $(`input[data-option-index="${i}"]:checked`, form);
      return checked ? checked.value : null;
    });

    const updateAvailability = (selected) => {
      // Gạch các giá trị không có biến thể còn hàng khi kết hợp với lựa chọn hiện tại
      product.options.forEach((_, i) => {
        $$(`input[data-option-index="${i}"]`, form).forEach((input) => {
          const combo = [...selected];
          combo[i] = input.value;
          const ok = product.variants.some((v) => v.available && v.options.every((o, j) => o === combo[j]));
          input.closest('.option__pill').classList.toggle('is-unavailable', !ok);
        });
      });
    };

    const onChange = () => {
      const selected = selectedOptions();
      selected.forEach((value, i) => {
        const label = $(`[data-option-value="${i}"]`, form);
        if (label) label.textContent = value;
      });
      updateAvailability(selected);
      const variant = product.variants.find((v) => v.options.every((o, i) => o === selected[i]));

      if (!variant) {
        addButton.disabled = true;
        addButton.setAttribute('data-sold-out', '');
        addLabel.textContent = theme.strings.unavailable;
        return;
      }

      idInput.value = variant.id;
      addButton.disabled = !variant.available;
      addButton.toggleAttribute('data-sold-out', !variant.available);
      addLabel.textContent = variant.available ? theme.strings.addToCart : theme.strings.soldOut;

      if (priceCurrent) priceCurrent.textContent = formatMoney(variant.price);
      const onSale = variant.compare_at_price && variant.compare_at_price > variant.price;
      if (priceCompare) {
        priceCompare.hidden = !onSale;
        priceCompare.textContent = onSale ? formatMoney(variant.compare_at_price) : '';
      }
      priceWrap?.classList.toggle('price--on-sale', !!onSale);
      if (discountBadge) {
        discountBadge.hidden = !onSale;
        if (onSale) discountBadge.textContent = `-${Math.round((1 - variant.price / variant.compare_at_price) * 100)}%`;
      }

      if (variant.featured_media) showMedia(variant.featured_media.id);

      const url = new URL(window.location.href);
      url.searchParams.set('variant', variant.id);
      window.history.replaceState({}, '', url.toString());
    };

    form.addEventListener('change', (event) => {
      if (event.target.matches('[data-option-index]')) onChange();
    });
    if (product.options.length > 1 || product.variants.length > 1) updateAvailability(selectedOptions());
  });

  /* ---------- Slider ---------- */
  $$('[data-slider]').forEach((slider) => {
    const track = $('[data-slider-track]', slider);
    const scrollBy = (dir) => {
      const item = track.firstElementChild;
      const amount = item ? item.getBoundingClientRect().width + 24 : track.clientWidth;
      track.scrollBy({ left: dir * amount, behavior: 'smooth' });
    };
    $('[data-slider-prev]', slider)?.addEventListener('click', () => scrollBy(-1));
    $('[data-slider-next]', slider)?.addEventListener('click', () => scrollBy(1));
  });

  /* ---------- Sản phẩm liên quan ---------- */
  $$('[data-recommendations]').forEach(async (el) => {
    if (el.children.length || !el.dataset.url || el.dataset.url.includes('product_id=&')) return;
    try {
      const res = await fetch(el.dataset.url);
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const fresh = doc.querySelector('[data-recommendations]');
      if (fresh && fresh.innerHTML.trim()) el.innerHTML = fresh.innerHTML;
    } catch (e) { /* bỏ qua */ }
  });

  /* ---------- Đóng bộ lọc khi bấm ra ngoài ---------- */
  document.addEventListener('click', (event) => {
    $$('details.filter[open]').forEach((d) => { if (!d.contains(event.target)) d.removeAttribute('open'); });
  });
})();
