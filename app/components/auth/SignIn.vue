<script setup lang="ts">
import { toast } from 'vue-sonner'

const isLoading = ref(false)
const config = useRuntimeConfig()
const googleClientId = config.public.googleClientId as string

// Load Google Identity Services SDK
function loadGoogleScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts) return resolve()
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google SDK'))
    document.head.appendChild(script)
  })
}

async function loginWithGoogle() {
  if (!googleClientId) {
    toast.error('Configuration Error', { description: 'Google Client ID is not configured. Add GOOGLE_CLIENT_ID to your .env file.' })
    return
  }

  isLoading.value = true
  try {
    await loadGoogleScript()

    // Use Google's popup sign-in flow
    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: handleGoogleResponse,
      auto_select: false,
    })

    // Trigger the One Tap or popup
    window.google.accounts.id.prompt((notification: any) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        // Fallback: render a button-based popup
        const container = document.createElement('div')
        container.id = 'google-btn-container'
        container.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9999;'
        document.body.appendChild(container)

        window.google.accounts.id.renderButton(container, {
          theme: 'outline',
          size: 'large',
          type: 'standard',
          text: 'signin_with',
          width: 300,
        })

        // Auto-click the rendered button
        setTimeout(() => {
          const btn = container.querySelector('div[role="button"]') as HTMLElement
          if (btn) btn.click()
          else isLoading.value = false
        }, 200)
      }
    })
  }
  catch (e: any) {
    isLoading.value = false
    toast.error('Google Sign-In Error', { description: e?.message || 'Could not initialize Google Sign-In' })
  }
}

async function handleGoogleResponse(response: { credential: string }) {
  // Clean up any rendered container
  document.getElementById('google-btn-container')?.remove()

  try {
    const res = await $fetch<{ success: boolean, data: any }>('/api/auth/google', {
      method: 'POST',
      body: { credential: response.credential },
    })

    // Store user info in a regular cookie for the UI (profile display, etc.)
    const userCookie = useCookie('hardwood_user', { maxAge: 60 * 60 * 24 * 7 })
    userCookie.value = JSON.stringify(res.data)

    toast.success(`Welcome, ${res.data.employee}!`)
    navigateTo('/')
  }
  catch (e: any) {
    const msg = e?.data?.message || e?.message || 'Login failed'
    toast.error('Access Denied', { description: msg })
  }
  finally {
    isLoading.value = false
  }
}

// Extend window type for Google SDK
declare global {
  interface Window {
    google: {
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
</script>

<template>
  <div class="grid gap-4">
    <Button variant="outline" class="w-full gap-2 h-11 text-base" :disabled="isLoading" @click="loginWithGoogle">
      <Icon v-if="isLoading" name="i-lucide-loader-circle" class="size-5 animate-spin" />
      <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="size-5">
        <path
          d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
          fill="currentColor"
        />
      </svg>
      Sign in with Google
    </Button>
  </div>
</template>
