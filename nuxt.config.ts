// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    "@nuxt/a11y",
    "@nuxt/eslint",
    "@nuxt/hints",
    "@nuxt/icon",
    "@nuxtjs/tailwindcss",
  ],
  devtools: { enabled: process.env.NODE_ENV !== "production" },
  compatibilityDate: "2025-07-15",
  hints: {
    features: {
      lazyLoad: false,
    },
  },
  eslint: {
    // https://eslint.nuxt.com/packages/module#dev-server-checker
    checker: true,
    config: {
      stylistic: {
        // https://eslint.nuxt.com/packages/module#eslint-stylistic
        indent: 2,
        quotes: "double",
        semi: true,
      },
    },
  },
});
