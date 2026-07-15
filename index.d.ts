import type { AppSettings } from '~/types/appSettings'

declare module 'nuxt/schema' {
  interface AppConfigInput {
    /** App settings */
    appSettings: AppSettings
  }
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void
          prompt: (callback?: (notification: any) => void) => void
          renderButton: (container: HTMLElement, config: any) => void
          revoke: (email: string, callback: () => void) => void
        }
      }
    }
  }
}

// It is always important to ensure you import/export something when augmenting a type
export {}
