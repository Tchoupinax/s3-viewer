// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    "@nuxt/a11y",
    "@nuxt/eslint",
    "@nuxt/hints",
    "@nuxt/icon",
    "@nuxtjs/tailwindcss"
  ],
  devtools: { enabled: process.env.NODE_ENV !== "production" },
  compatibilityDate: "2025-07-15",
  vite: {
    optimizeDeps: {
      include: [
        "pretty-bytes",
        "timeago.js",
        "ts-pattern",
        "shikiji"
      ]
    }
  },
  hints: {
    features: {
      hydration: false,
      lazyLoad: false,
      webVitals: false,
      thirdPartyScripts: false,
      htmlValidate: false
    }
  }
});
