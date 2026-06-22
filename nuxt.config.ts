// https://nuxt.com/docs/api/configuration/nuxt-config
const isDev = process.env.NODE_ENV !== "production";

export default defineNuxtConfig({
  sourcemap: {
    server: false,
    client: false,
  },
  nitro: {
    minify: true,
    routeRules: {
      "/api/buckets/**/empty-progress": { compress: false },
      "/api/buckets/**/delete-progress": { compress: false },
    },
  },
  modules: [
    "@nuxt/a11y",
    ...(isDev ? ["@nuxt/eslint", "@nuxt/hints"] : []),
    "@nuxtjs/tailwindcss",
  ],
  devtools: { enabled: false },
  compatibilityDate: "2025-07-15",
  vite: {
    optimizeDeps: {
      include: [
        'pretty-bytes',
        'shikiji',
        'timeago.js',
        'ts-pattern',
      ],
    },
  },
  hints: isDev
    ? {
      features: {
        hydration: false,
        lazyLoad: false,
        webVitals: false,
        thirdPartyScripts: false,
        htmlValidate: false,
      },
    }
    : undefined,
});
