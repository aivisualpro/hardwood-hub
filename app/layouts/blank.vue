<script setup lang="ts">
useHead({
  htmlAttrs: { style: 'height: auto !important; overflow: auto !important; min-height: 100vh;' },
  bodyAttrs: { style: 'height: auto !important; overflow: auto !important; min-height: 100vh;' }
})
</script>

<template>
  <div>
    <slot />
  </div>
</template>

<style>
/* Absolute nuclear option to ensure the blank layout ALWAYS permits scrolling even during Nuxt routing transitions */
html, body, #__nuxt, #app {
  height: auto !important;
  min-height: 100vh !important;
  overflow: auto !important;
}
</style>

