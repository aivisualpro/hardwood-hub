<script setup lang="ts">
definePageMeta({
  layout: 'blank',
})
</script>

<template>
  <LayoutAuth reverse>
    <div class="flex flex-col items-center justify-center h-full gap-8">

      <!-- Card container -->
      <div class="w-full rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm shadow-xl p-8 space-y-6">

        <!-- Header -->
        <div class="text-center space-y-2">
          <div class="flex items-center justify-center mb-4">
            <div class="size-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center shadow-lg shadow-primary/5">
              <img src="/hardwood logo.png" alt="Hardwood Hub" class="size-10 rounded-lg" />
            </div>
          </div>
          <h1 class="text-2xl font-bold tracking-tight">
            Welcome back
          </h1>
          <p class="text-sm text-muted-foreground">
            Sign in to continue to Hardwood Hub
          </p>
        </div>

        <!-- Separator -->
        <div class="flex items-center gap-3">
          <div class="h-px flex-1 bg-border/60" />
          <span class="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60">Continue with</span>
          <div class="h-px flex-1 bg-border/60" />
        </div>

        <!-- Sign in button -->
        <AuthSignIn />

        <!-- Security note -->
        <div class="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground/60">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="size-3">
            <path fill-rule="evenodd" d="M8 1a3.5 3.5 0 0 0-3.5 3.5V7A1.5 1.5 0 0 0 3 8.5v5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11.5 7V4.5A3.5 3.5 0 0 0 8 1Zm2 6V4.5a2 2 0 1 0-4 0V7h4Z" clip-rule="evenodd" />
          </svg>
          Secured with Google OAuth 2.0
        </div>
      </div>

      <!-- Footer -->
      <p class="text-xs text-muted-foreground/40 text-center">
        &copy; {{ new Date().getFullYear() }} Hardwood Hub. All rights reserved.
      </p>
    </div>
  </LayoutAuth>
</template>
