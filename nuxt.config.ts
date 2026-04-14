import tailwindcss from '@tailwindcss/vite'
// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: false },
  spaLoadingTemplate: false,

  watch: ['~/app.config.ts'],

  css: ['~/assets/css/tailwind.css'],
  vite: {
    plugins: [
      tailwindcss(),
    ],
    server: {
      watch: {
        usePolling: true,
        interval: 1000,
        ignored: ['**/node_modules/**', '**/.git/**'],
      },
    },
  },

  components: [
    {
      path: '~/components',
      extensions: ['.vue'],
    },
  ],

  modules: [
    'shadcn-nuxt',
    '@vueuse/nuxt',
    '@nuxt/eslint',
    '@nuxt/icon',
    '@pinia/nuxt',
    '@nuxtjs/color-mode',
    '@nuxt/fonts',
  ],

  shadcn: {
    /**
     * Prefix for all the imported component
     */
    prefix: '',
    /**
     * Directory that the component lives in.
     * @default "~/components/ui"
     */
    componentDir: '~/components/ui',
  },

  colorMode: {
    classSuffix: '',
  },

  eslint: {
    config: {
      standalone: false,
    },
  },

  fonts: {
    defaults: {
      weights: [300, 400, 500, 600, 700, 800],
    },
  },

  routeRules: {
    '/components': { redirect: '/components/accordion' },
  },

  imports: {
    dirs: [
      './lib',
    ],
  },

  runtimeConfig: {
    // Server-only secrets (from .env)
    cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME,
    cloudinaryApiKey: process.env.CLOUDINARY_API_KEY,
    cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET,
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    sessionSecret: process.env.SESSION_SECRET || 'hardwood-hub-default-secret-change-in-production',
    calendlyAccessToken: process.env.CALENDLY_ACCESS_TOKEN,
    calendlyUrl: process.env.CALENDLY_URL,
    
    // Vertex AI / Google Cloud
    googleCloudProjectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    googleCloudLocation: process.env.GOOGLE_CLOUD_LOCATION,
    googleClientEmail: process.env.GOOGLE_CLIENT_EMAIL,
    googlePrivateKey: process.env.GOOGLE_PRIVATE_KEY,

    gfSiteUrl: process.env.GF_SITE_URL,
    gfConsumerKey: process.env.GF_CONSUMER_KEY,
    gfConsumerSecret: process.env.GF_CONSUMER_SECRET,
    gfPublicApiKey: process.env.GF_PUBLIC_API_KEY,
    gfPrivateApiKey: process.env.GF_PRIVATE_API_KEY,
    gmailUser: process.env.GMAIL_USER,
    gmailAppPassword: process.env.GMAIL_APP_PASSWORD,
    public: {
      googleClientId: process.env.GOOGLE_CLIENT_ID,
    },
  },

  compatibilityDate: '2024-12-14',
})
