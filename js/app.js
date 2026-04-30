const App = (() => {
  // ── State ──────────────────────────────────────────────────────────────────
  const state = {
    catalog: { page: 1, total: 0, loading: false, category: null, query: '', products: [] },
  };
  const categoryIdMap = {}; // slug → Tiendanube category id

  // ── Helpers ────────────────────────────────────────────────────────────────
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  const productUrl   = p => p.permalink || `${CONFIG.STORE_URL}/productos/${p.id}`;
  const productImg   = p => p.images?.[0]?.src || p.images?.[0]?.url || null;
  const productName  = p => p.name?.es || (typeof p.name === 'string' ? p.name : '') || 'Producto';
  const productPrice = p => { const v = parseFloat(p.price); return isNaN(v) ? '' : `$${v.toLocaleString('es-AR')}`; };

  function buildProductCard(p) {
    const url   = productUrl(p);
    const img   = productImg(p);
    const name  = productName(p);
    const price = productPrice(p);
    return `
      <a class="product-card" href="${url}" target="_blank" rel="noopener">
        <div class="pc-img">
          ${img
            ? `<img src="${img}" alt="${name}" loading="lazy" />`
            : `<div class="pc-placeholder"><span>MRD</span></div>`}
          <div class="pc-overlay"><span>Ver producto</span></div>
        </div>
        <div class="pc-body">
          <p class="pc-name">${name}</p>
          ${price ? `<p class="pc-price">${price}</p>` : ''}
        </div>
      </a>`;
  }

  function buildSkeletons(n) {
    return Array.from({ length: n }, () => `
      <div class="product-card skel">
        <div class="pc-img" style="aspect-ratio:3/4"></div>
        <div class="pc-body">
          <div class="skel-line w80"></div>
          <div class="skel-line w40"></div>
        </div>
      </div>`).join('');
  }

  // ── NAV ────────────────────────────────────────────────────────────────────
  function initNav() {
    const nav    = $('#main-nav');
    const toggle = $('#menu-toggle');
    const menu   = $('#mobile-menu');

    window.addEventListener('scroll', () => {
      nav.classList.toggle('scrolled', window.scrollY > 50);
    }, { passive: true });

    toggle.addEventListener('click', () => {
      const open = menu.classList.toggle('open');
      toggle.classList.toggle('open', open);
      document.body.style.overflow = open ? 'hidden' : '';
    });

    $$('.mobile-link', menu).forEach(a =>
      a.addEventListener('click', () => {
        menu.classList.remove('open');
        toggle.classList.remove('open');
        document.body.style.overflow = '';
      })
    );

    // Dropdown nav → jump to catalog with filter
    $$('[data-filter-cat]').forEach(a =>
      a.addEventListener('click', e => {
        e.preventDefault();
        const slug = a.dataset.filterCat;
        const cat  = CONFIG.CATEGORIES.find(c => c.slug === slug);
        if (cat) setCatalogCategory(slug, cat.label);
        $('#catalogo')?.scrollIntoView({ behavior: 'smooth' });
      })
    );
  }

  // ── HERO CAROUSEL ──────────────────────────────────────────────────────────
  function initCarousel() {
    const track    = $('#hero-track');
    const slides   = $$('.hero-slide', track);
    const dots     = $$('.dot');
    const bar      = $('#hero-progress-bar');
    const DURATION = 5000;
    let current = 0;
    let timer   = null;

    function go(idx) {
      // Reset outgoing slide content
      slides[current].classList.remove('active');
      dots[current].classList.remove('active');

      current = ((idx % slides.length) + slides.length) % slides.length;

      // Force reflow so CSS transitions restart on new active slide
      void slides[current].offsetWidth;
      slides[current].classList.add('active');
      dots[current].classList.add('active');
      track.style.transform = `translateX(-${current * 100}%)`;

      // Restart progress bar
      bar.style.transition = 'none';
      bar.style.width = '0%';
      requestAnimationFrame(() => {
        bar.style.transition = `width ${DURATION}ms linear`;
        bar.style.width = '100%';
      });
    }

    const start = () => { clearInterval(timer); timer = setInterval(() => go(current + 1), DURATION); };
    const stop  = () => clearInterval(timer);

    go(0);
    start();

    $('#hero-next').addEventListener('click', () => { stop(); go(current + 1); start(); });
    $('#hero-prev').addEventListener('click', () => { stop(); go(current - 1); start(); });
    dots.forEach(d => d.addEventListener('click', () => { stop(); go(+d.dataset.dot); start(); }));

    const hero = $('.hero');
    hero.addEventListener('mouseenter', stop);
    hero.addEventListener('mouseleave', start);

    // Touch swipe
    let tx = 0;
    hero.addEventListener('touchstart', e => { tx = e.touches[0].clientX; }, { passive: true });
    hero.addEventListener('touchend',   e => {
      const dx = tx - e.changedTouches[0].clientX;
      if (Math.abs(dx) > 50) { stop(); go(current + (dx > 0 ? 1 : -1)); start(); }
    });
  }

  // ── SCROLL REVEAL ──────────────────────────────────────────────────────────
  let revealObs;
  function initScrollReveal() {
    revealObs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('revealed'); revealObs.unobserve(e.target); }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    $$('[data-reveal]').forEach(el => revealObs.observe(el));
  }

  // ── CATEGORIES (API mapping) ───────────────────────────────────────────────
  async function initCategories() {
    try {
      const { data } = await API.getCategories();
      CONFIG.CATEGORIES.forEach(cat => {
        if (!cat.slug) return;
        const match = data.find(c => {
          const n = (c.name?.es || c.name || '').toLowerCase();
          return n.includes(cat.slug.replace(/-/g, ' ')) || n.includes(cat.label.toLowerCase());
        });
        if (match) categoryIdMap[cat.slug] = match.id;
      });
    } catch (e) { console.warn('Categories:', e.message); }
  }

  // ── FEATURED BENTO ─────────────────────────────────────────────────────────
  async function loadFeatured() {
    const grid = $('#bento-grid');
    grid.innerHTML = Array.from({ length: CONFIG.FEATURED_COUNT }, () =>
      '<div class="bento-item bento-skel"></div>'
    ).join('');

    try {
      const { data } = await API.getProducts({ perPage: CONFIG.FEATURED_COUNT });
      if (!data.length) { grid.innerHTML = ''; return; }
      grid.innerHTML = data.map(p => {
        const url   = productUrl(p);
        const img   = productImg(p);
        const name  = productName(p);
        const price = productPrice(p);
        return `
          <a class="bento-item" href="${url}" target="_blank" rel="noopener">
            <div class="bento-bg">
              ${img ? `<img src="${img}" alt="${name}" loading="lazy" />` : '<div class="bento-blank"><span>MRD</span></div>'}
            </div>
            <div class="bento-hover-cta"><span>Ver producto</span></div>
            <div class="bento-info">
              <p class="bento-name">${name}</p>
              ${price ? `<p class="bento-price">${price}</p>` : ''}
            </div>
          </a>`;
      }).join('');
    } catch (e) { console.warn('Featured:', e.message); grid.innerHTML = ''; }
  }

  // ── CATEGORY STRIPS ────────────────────────────────────────────────────────
  async function loadCategoryStrips() {
    const container = $('#category-strips');
    const cats = CONFIG.CATEGORIES.filter(c => c.slug);

    for (const cat of cats) {
      const section = document.createElement('section');
      section.className = 'cat-strip';
      section.innerHTML = `
        <div class="strip-header" data-reveal>
          <div>
            <p class="section-label">— Categoría</p>
            <h2 class="strip-title">${cat.label}</h2>
          </div>
          <a class="section-link" href="#catalogo" data-strip-slug="${cat.slug}">
            Ver todos <span>↗</span>
          </a>
        </div>
        <div class="strip-track" id="strip-${cat.slug}">
          ${Array.from({ length: 5 }, () => `
            <div class="strip-card skel">
              <div class="pc-img" style="aspect-ratio:3/4"></div>
              <div class="pc-body">
                <div class="skel-line w80"></div>
                <div class="skel-line w40"></div>
              </div>
            </div>`).join('')}
        </div>`;

      container.appendChild(section);

      section.querySelector('[data-strip-slug]')?.addEventListener('click', e => {
        e.preventDefault();
        setCatalogCategory(cat.slug, cat.label);
        $('#catalogo')?.scrollIntoView({ behavior: 'smooth' });
      });

      $$('[data-reveal]', section).forEach(el => revealObs?.observe(el));

      // Load products for this strip asynchronously
      const catId = categoryIdMap[cat.slug] || null;
      API.getProducts({ perPage: CONFIG.STRIP_COUNT, category: catId })
        .then(({ data }) => {
          const track = $(`#strip-${cat.slug}`);
          if (!track) return;
          if (!data.length) { track.innerHTML = ''; return; }
          track.innerHTML = data.map(p =>
            `<div class="strip-card">${buildProductCard(p)}</div>`
          ).join('');
        })
        .catch(e => {
          console.warn(`Strip ${cat.slug}:`, e.message);
          const track = $(`#strip-${cat.slug}`);
          if (track) track.innerHTML = '';
        });
    }
  }

  // ── CATALOG TABS ───────────────────────────────────────────────────────────
  function initCatalogTabs() {
    const wrap = $('#cat-tabs');
    CONFIG.CATEGORIES.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'cat-tab' + (!cat.slug ? ' active' : '');
      btn.textContent = cat.label;
      btn.dataset.slug = cat.slug || '';
      btn.addEventListener('click', () => setCatalogCategory(cat.slug, cat.label));
      wrap.appendChild(btn);
    });
  }

  function setCatalogCategory(slug, label) {
    state.catalog.category = slug;
    state.catalog.page = 1;
    state.catalog.query = '';
    const input = $('#search-input');
    if (input) input.value = '';
    $$('.cat-tab').forEach(b => b.classList.toggle('active', (b.dataset.slug || null) === slug));
    const title = $('#catalog-title');
    if (title) title.innerHTML = slug ? `${label}` : 'Colección<br/>Completa';
    loadCatalog(false);
  }

  // ── CATALOG ────────────────────────────────────────────────────────────────
  async function loadCatalog(append = false) {
    if (state.catalog.loading) return;
    state.catalog.loading = true;

    const grid       = $('#products-grid');
    const moreWrap   = $('#load-more-wrap');
    const countEl    = $('#total-count');

    if (!append) {
      grid.innerHTML = buildSkeletons(CONFIG.PRODUCTS_PER_PAGE);
      if (moreWrap) moreWrap.style.display = 'none';
    } else {
      grid.insertAdjacentHTML('beforeend', buildSkeletons(4));
    }

    try {
      const catId = state.catalog.category
        ? (categoryIdMap[state.catalog.category] || null)
        : null;
      const { data, total } = await API.getProducts({
        page: state.catalog.page,
        category: catId,
        q: state.catalog.query || null,
      });

      state.catalog.total = total;
      state.catalog.products = append ? [...state.catalog.products, ...data] : data;

      if (!append) {
        grid.innerHTML = '';
      } else {
        $$('.skel', grid).forEach(el => el.remove());
      }

      if (countEl) countEl.textContent = total > 0 ? `${total} productos` : '';

      if (!state.catalog.products.length) {
        grid.innerHTML = '<p class="empty-msg">Sin resultados</p>';
      } else {
        const cards = (append ? data : state.catalog.products).map(buildProductCard).join('');
        append ? grid.insertAdjacentHTML('beforeend', cards) : (grid.innerHTML = cards);
      }

      if (moreWrap) {
        moreWrap.style.display = state.catalog.products.length < state.catalog.total ? 'flex' : 'none';
      }
    } catch (err) {
      grid.innerHTML = '<p class="empty-msg">Error al cargar. Intentá de nuevo.</p>';
      console.error(err);
    }

    state.catalog.loading = false;
  }

  function initSearch() {
    const input = $('#search-input');
    const btn   = $('#search-btn');
    if (!input || !btn) return;
    const run = () => {
      state.catalog.query    = input.value.trim();
      state.catalog.page     = 1;
      state.catalog.category = null;
      $$('.cat-tab').forEach(b => b.classList.toggle('active', !b.dataset.slug));
      const title = $('#catalog-title');
      if (title) title.innerHTML = 'Colección<br/>Completa';
      loadCatalog(false);
    };
    btn.addEventListener('click', run);
    input.addEventListener('keydown', e => e.key === 'Enter' && run());
  }

  function initLoadMore() {
    $('#load-more')?.addEventListener('click', () => {
      state.catalog.page++;
      loadCatalog(true);
    });
  }

  // ── INIT ───────────────────────────────────────────────────────────────────
  async function init() {
    initNav();
    initCarousel();
    initScrollReveal();
    initCatalogTabs();
    initSearch();
    initLoadMore();

    await initCategories();
    loadFeatured();
    loadCategoryStrips();
    loadCatalog(false);
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', App.init);
