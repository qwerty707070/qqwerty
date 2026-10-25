/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Публичные страницы читают настройки на каждый запрос (см. app/page.tsx),
  // поэтому агрессивный кэш CDN выключен на уровне заголовков в next.config.
  async headers() {
    return [
      {
        // Настройки сайта никогда не должны попадать в кэш браузера/CDN:
        // именно из-за этого «правка в админке не видна на сайте».
        source: '/api/settings',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0' },
          { key: 'CDN-Cache-Control', value: 'no-store' },
          { key: 'Vercel-CDN-Cache-Control', value: 'no-store' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
