const CONFIG = {
  // Las credenciales viven en el servidor (variables de entorno).
  // El cliente solo necesita la ruta del proxy.
  BASE_URL: '/api',
  PRODUCTS_PER_PAGE: 12,
  FEATURED_COUNT: 3,
  STRIP_COUNT: 8,
  STORE_URL: 'https://www.tiendanube.com/tienda/7637571',

  // Ajustá estos labels/slugs para que coincidan con los nombres reales
  // de tus categorías en el admin de Tiendanube
  CATEGORIES: [
    { label: 'Todo',    slug: null },
    { label: 'Snow',    slug: 'snow-clothing' },
    { label: 'Hoodies', slug: 'hoodies' },
    { label: 'Tees',    slug: 'tees' },
    { label: 'Pants',   slug: 'pants' },
  ],
};
