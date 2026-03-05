<script setup lang="ts">
defineProps<{
  reverse?: boolean
}>()
</script>

<template>
  <div class="relative flex min-h-dvh overflow-hidden bg-background">
    <!-- ══════ Background ambient glow ══════ -->
    <div class="fixed inset-0 pointer-events-none overflow-hidden">
      <div class="absolute -top-1/2 -left-1/4 w-[80vw] h-[80vh] rounded-full bg-primary/5 blur-[120px]" />
      <div class="absolute -bottom-1/3 -right-1/4 w-[60vw] h-[60vh] rounded-full bg-amber-500/5 blur-[100px]" />
    </div>

    <!-- ══════ LEFT: Branding panel (hidden on mobile) ══════ -->
    <div
      class="relative hidden lg:flex flex-col w-[45%] min-h-dvh overflow-hidden"
      :class="reverse ? 'order-2' : 'order-1'"
    >
      <!-- Background image -->
      <img
        src="/hardwood image.png"
        alt="Hardwood craftsmanship"
        class="absolute inset-0 w-full h-full object-cover object-center"
      />
      <!-- Gradient overlays -->
      <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/30" />
      <div class="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent" />

      <!-- Content on image -->
      <div class="relative z-10 flex flex-col h-full p-10">
        <!-- Logo + name -->
        <div class="flex items-center gap-3">
          <img
            src="/hardwood logo.png"
            alt="Hardwood Hub"
            class="size-11 rounded-xl shadow-lg"
          />
          <div>
            <h2 class="text-white font-bold text-lg tracking-tight">Hardwood Hub</h2>
            <p class="text-white/50 text-xs font-medium">Workforce Management</p>
          </div>
        </div>

        <!-- Spacer -->
        <div class="flex-1" />

        <!-- Feature badges -->
        <div class="flex flex-wrap gap-2 mb-6">
          <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 text-white/80 text-xs font-medium">
            <span class="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Skills Tracking
          </span>
          <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 text-white/80 text-xs font-medium">
            <span class="size-1.5 rounded-full bg-blue-400 animate-pulse" />
            Daily Production
          </span>
          <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 text-white/80 text-xs font-medium">
            <span class="size-1.5 rounded-full bg-amber-400 animate-pulse" />
            Task Management
          </span>
        </div>

        <!-- Quote -->
        <blockquote class="space-y-3">
          <p class="text-xl font-medium leading-relaxed text-white/90">
            &ldquo;Manage employee skills, track performance, and streamline workforce development — all from one powerful platform.&rdquo;
          </p>
          <div class="flex items-center gap-3 pt-2">
            <div class="h-px flex-1 bg-gradient-to-r from-white/20 to-transparent" />
          </div>
        </blockquote>
      </div>
    </div>

    <!-- ══════ RIGHT: Auth form ══════ -->
    <div
      class="relative flex-1 flex items-center justify-center px-6 py-12"
      :class="reverse ? 'order-1' : 'order-2'"
    >
      <!-- Subtle pattern background -->
      <div class="absolute inset-0 opacity-[0.02]" style="background-image: radial-gradient(circle, currentColor 1px, transparent 1px); background-size: 24px 24px;" />

      <!-- Mobile logo (shown only on small screens) -->
      <div class="absolute top-8 left-1/2 -translate-x-1/2 flex items-center gap-3 lg:hidden">
        <img
          src="/hardwood logo.png"
          alt="Hardwood Hub"
          class="size-10 rounded-xl shadow-lg"
        />
        <h2 class="font-bold text-lg tracking-tight">Hardwood Hub</h2>
      </div>

      <div class="w-full max-w-sm">
        <slot />
      </div>
    </div>
  </div>
</template>
