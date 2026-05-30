<script setup lang="ts">
useHead({
  htmlAttrs: { class: 'blank-layout' },
  bodyAttrs: { class: 'blank-layout' },
})
</script>

<template>
  <div class="min-h-dvh">
    <slot />
  </div>
</template>

<style>
html.blank-layout, body.blank-layout, html.blank-layout #__nuxt, html.blank-layout #app {
  height: auto !important;
  min-height: 100dvh !important;
  overflow: auto !important;
  overscroll-behavior: auto !important;
}
</style>
