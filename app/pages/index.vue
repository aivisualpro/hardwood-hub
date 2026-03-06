<script setup lang="ts">
definePageMeta({ layout: false })

// Root redirects are handled by auth middleware:
// - Unauthenticated → /login
// - Authenticated → /my-profile
// This page exists only as a fallback route.
onMounted(() => {
  navigateTo('/my-profile')
})
</script>

<template>
  <div class="min-h-screen bg-background" />
</template>
