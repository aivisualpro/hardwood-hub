<script setup lang="ts">
</script>

<template>
  <div>
    <slot />
  </div>
</template>

<style scoped>
/* Override global overflow:hidden on html/body so public pages can scroll */
:global(html),
:global(body) {
  overflow: auto !important;
  height: auto !important;
  min-height: 100vh;
}
</style>
