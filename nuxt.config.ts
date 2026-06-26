import tailwindcss from '@tailwindcss/vite'
// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: false },
  spaLoadingTemplate: false,

  app: {
    head: {
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32.png' },
        { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/logo-180.png' },
      ],
    },
  },

  experimental: {
    asyncContext: true,
  },

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

  nitro: {
    // sharp has prebuilt native bindings per platform (linux-x64) that must
    // stay in node_modules so Vercel's Lambda gets the right .node file.
    externals: {
      external: ['sharp'],
    },
    vercel: {
      functions: {
        maxDuration: 60,
        memory: 3008,
      },
    },
    rollupConfig: {
      onwarn(warning: any, warn: any) {
        // Suppress puppeteer-core ESM decorator rewriting noise
        if (warning.code === 'THIS_IS_UNDEFINED' && warning.id?.includes('puppeteer'))
          return
        if (warning.code === 'CIRCULAR_DEPENDENCY' && warning.message?.includes('nitropack'))
          return
        if (warning.code === 'CIRCULAR_DEPENDENCY' && warning.message?.includes('nitro'))
          return
        if (warning.code === 'CIRCULAR_DEPENDENCY' && warning.message?.includes('virtual:#imports'))
          return
        warn(warning)
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
    '@nuxt/image',
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
    // SWR caching for read-heavy API endpoints — speeds up SSR data fetching
    // NOTE: '/api/employees' SWR removed — it's a mutable list (status toggles,
    // create/edit/delete). SWR served a stale list for up to 30s after writes,
    // so refreshes showed the old status even though Mongo was already updated.
    // Edge cache also doesn't vary by ?page/?search/?status query params.
    // NOTE: '/api/workspaces' SWR removed — workspaces/permissions are edited in
    // admin settings and must reflect immediately. SWR served a stale list for up
    // to 60s after a save, so edits appeared to revert on refresh (Mongo was fine).
    '/api/dashboard/stats': { swr: 15 },
    // ⚠️ '/api/skills/tree' and '/api/app-settings' are still SWR-cached below and
    // are ALSO user-editable — expect the same "edit doesn't show for up to a
    // minute" behaviour there. Remove them too if you hit it.
    '/api/skills/tree': { swr: 60 },
    '/api/app-settings': { swr: 120 },
    // NOTE: '/api/dropdowns' SWR removed — Vercel edge cache doesn't vary by
    // query params, so ?name=X requests got the full-list cached response.
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
    // SESSION_SECRET is read directly from process.env in server/lib/session.ts.
    // It intentionally has NO fallback — the server will throw on startup if unset.
    sessionSecret: process.env.SESSION_SECRET,
    calendlyAccessToken: process.env.CALENDLY_ACCESS_TOKEN,
    calendlyUrl: process.env.CALENDLY_URL,

    // Vertex AI / Google Cloud
    googleCloudProjectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    googleCloudLocation: process.env.GOOGLE_CLOUD_LOCATION,
    googleClientEmail: process.env.GOOGLE_CLIENT_EMAIL,
    googlePrivateKey: process.env.GOOGLE_PRIVATE_KEY,

    // Gemini AI Studio API (https://aistudio.google.com/apikey)
    geminiApiKey: process.env.GEMINI_API_KEY,

    gfSiteUrl: process.env.GF_SITE_URL,
    gfConsumerKey: process.env.GF_CONSUMER_KEY,
    gfConsumerSecret: process.env.GF_CONSUMER_SECRET,
    gfPublicApiKey: process.env.GF_PUBLIC_API_KEY,
    gfPrivateApiKey: process.env.GF_PRIVATE_API_KEY,

    // CRM webhook auth — the Gravity Forms Webhooks add-on can only send a
    // STATIC header, so prefer the token. HMAC kept as a fallback for proxies.
    crmWebhookToken: process.env.CRM_WEBHOOK_TOKEN,
    crmWebhookSecret: process.env.CRM_WEBHOOK_SECRET,
    // Background CRM auto-sync (server interval) + external cron trigger
    crmAutosync: process.env.CRM_AUTOSYNC,
    crmAutosyncMinutes: process.env.CRM_AUTOSYNC_MINUTES,
    crmCronSecret: process.env.CRM_CRON_SECRET,
    gmailUser: process.env.GMAIL_USER,
    gmailAppPassword: process.env.GMAIL_APP_PASSWORD,
    gmailUserEstimates: process.env.GMAIL_USER_ESTIMATES,
    gmailAppPasswordEstimates: process.env.GMAIL_APP_PASSWORD_ESTIMATES,

    // Browserless.io — used for server-side PDF rendering
    browserlessToken: process.env.BROWSERLESS_TOKEN,

    // Vercel Blob — long-term PDF storage. Token is auto-provided by Vercel
    // once a Blob store is connected to the project.
    blobReadWriteToken: process.env.BLOB_READ_WRITE_TOKEN,
    public: {
      googleClientId: process.env.GOOGLE_CLIENT_ID,
    },
  },

  compatibilityDate: '2024-12-14',
})
