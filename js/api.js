const API = (() => {
  async function request(path, params = {}) {
    const url = new URL(path, window.location.origin);
    Object.entries(params).forEach(([k, v]) => {
      if (v != null && v !== '') url.searchParams.set(k, v);
    });
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data  = await res.json();
    const total = parseInt(res.headers.get('x-total-count') || '0', 10);
    return { data, total };
  }

  return {
    getProducts: ({ page = 1, perPage = CONFIG.PRODUCTS_PER_PAGE, category = null, q = null } = {}) =>
      request('/api/products', { page, per_page: perPage, category, q: q || undefined }),

    getCategories: () => request('/api/categories'),
  };
})();
