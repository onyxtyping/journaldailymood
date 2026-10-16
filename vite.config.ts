import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Actions передає BASE_PATH=/<repo>/; локально — корінь.
const base = process.env.BASE_PATH || '/';

// Жорстка CSP: жодних мережевих запитів з рантайму, лише власні ресурси.
// Додається тільки в продакшн-збірку (dev-сервер Vite потребує inline-скриптів і WebSocket).
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'none'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

function cspMeta(): Plugin {
  return {
    name: 'journal-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace('<!--CSP-->', `<meta http-equiv="Content-Security-Policy" content="${CSP}" />`);
    },
  };
}

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };
const sha = (process.env.GITHUB_SHA ?? '').slice(0, 7);
const appVersion = sha ? `${pkg.version} (${sha})` : pkg.version;

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(appVersion) },
  build: { target: 'es2020', sourcemap: false },
  plugins: [
    preact(),
    cspMeta(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Журнал',
        short_name: 'Журнал',
        description: 'Офлайн-журнал службових подій. Дані не залишають пристрій.',
        lang: 'uk',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'any',
        background_color: '#0e1013',
        theme_color: '#0e1013',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        // Жодного runtime-кешування мережі: усе береться з precache.
        runtimeCaching: [],
      },
    }),
  ],
});
