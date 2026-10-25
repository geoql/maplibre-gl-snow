import { fileURLToPath } from 'node:url';

// Cloudflare compatibility date — keep the two copies below in sync.
const COMPATIBILITY_DATE = '2026-10-22';

const HOST = 'maplibre-gl-snow.geoql.in';

export default defineNuxtConfig({
  compatibilityDate: COMPATIBILITY_DATE,

  modules: ['@nuxtjs/color-mode', '@nuxt/scripts', '@openpanel/nuxt'],

  devtools: { enabled: false },

  css: ['maplibre-gl/dist/maplibre-gl.css', '~/assets/css/main.css'],

  // The demo runs the layer from this repo's source, so every change to
  // src/ shows up here without a library build first.
  alias: {
    '@geoql/maplibre-gl-snow': fileURLToPath(
      new URL('../src/index.ts', import.meta.url),
    ),
  },

  // MapLibre and three/webgpu each ship as one large module. Give each its own
  // chunk so they download in parallel and cache apart from the app code.
  vite: {
    // Pre-bundled up front so the first dev load does not reload the page.
    optimizeDeps: {
      include: ['maplibre-gl', 'three/webgpu', 'three/tsl'],
    },
    build: {
      // The two library chunks are ~0.9 MB (maplibre-gl) and ~1.05 MB
      // (three/webgpu) minified; neither splits further. The limit sits just
      // above them, so app code that grows a chunk past it still warns.
      chunkSizeWarningLimit: 1100,
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              { name: 'maplibre', test: /node_modules[\\/]maplibre-gl[\\/]/ },
              { name: 'three', test: /node_modules[\\/]three[\\/]/ },
            ],
          },
        },
      },
    },
  },

  // Cookie-backed so the server renders the right class on <html>; the
  // module's inline head script resolves "system" before first paint.
  colorMode: {
    preference: 'system',
    fallback: 'dark',
    classSuffix: '',
    storage: 'cookie',
    storageKey: 'maplibre-gl-snow-color-mode',
  },

  // Public IDs ship in the HTML; they are not secrets. Override per env with
  // NUXT_PUBLIC_GTAG_ID, NUXT_PUBLIC_PLAUSIBLE_SCRIPT_ID, etc. GA4 stays off
  // while gtagId is empty.
  runtimeConfig: {
    public: {
      siteUrl: `https://${HOST}`,
      gtagId: '',
      plausibleScriptId: 'mf5DVqCKBrqcoVBKKHp_N',
      plausibleApiHost: 'https://analytics.geoql.in',
    },
  },

  openpanel: {
    clientId: 'c68992ff-0735-49af-a1fa-7bc4385ca8c4',
    apiUrl: 'https://events.geoql.in/api',
    trackScreenViews: true,
    trackOutgoingLinks: true,
    trackAttributes: true,
    proxy: false,
  },

  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        {
          rel: 'preload',
          href: '/fonts/satoshi-400.woff2',
          as: 'font',
          type: 'font/woff2',
          crossorigin: '',
        },
      ],
    },
  },

  typescript: {
    strict: true,
    tsConfig: {
      // three/webgpu and three/tsl ship no types; the library declares them.
      include: ['../../src/three-webgpu.d.ts'],
    },
  },

  nitro: {
    preset: 'cloudflare_module',
    cloudflare: {
      nodeCompat: true,
      deployConfig: true,
      // Merged into the generated .output/server/wrangler.json.
      wrangler: {
        name: 'maplibre-gl-snow-demo',
        account_id: 'bd11b1c42ee2759044a1769f80f704dd',
        compatibility_date: COMPATIBILITY_DATE,
        workers_dev: true,
        preview_urls: false,
        routes: [{ pattern: HOST, custom_domain: true }],
        observability: { enabled: true },
      },
    },
  },
});
