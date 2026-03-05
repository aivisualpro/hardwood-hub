<script setup lang="ts">
definePageMeta({
  layout: 'blank',
})
</script>

<template>
  <LayoutAuth reverse>
    <div class="flex flex-col items-center justify-center h-full">
      <div class="grid mx-auto max-w-sm gap-6">
        <div class="grid gap-2 text-center">
          <h1 class="text-2xl font-semibold tracking-tight">
            Welcome back
          </h1>
        </div>
        <AuthSignIn />
      </div>
      <p class="mt-auto pb-6 text-xs text-muted-foreground text-center">
        &copy; {{ new Date().getFullYear() }} Hardwood Hub. All rights reserved.
      </p>
    </div>
  </LayoutAuth>
</template>
