const API = (() => {
  const headers = {
    Authentication: `bearer ${CONFIG.ACCESS_TOKEN}`,
    'User-Agent': CONFIG.USER_AGENT,
  };

  async function request(endpoint, params = {}) {
    const url = new URL(`${CONFIG.BASE_URL}/${CONFIG.STORE_ID}/${endpoint}`);
    Object.entries(params).forEach(([k, v]) => {
      if (v != null && v !== '') url.searchParams.set(k, v);
    });
    const res = await fetch(url.toString(), { headers });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    const total = parseInt(res.headers.get('x-total-count') || '0', 10);
    return { data, total };
  }

  return {
    getProducts: ({ page = 1, perPage = CONFIG.PRODUCTS_PER_PAGE, category = null, q = null } = {}) =>
      request('products', { page, per_page: perPage, category, q: q || undefined }),

    getCategories: () => request('categories'),
  };
})();
