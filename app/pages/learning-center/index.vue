<script setup lang="ts">
import { LC_CATEGORIES } from '~/constants/learning-center'

// /learning-center has no view of its own — send people to the first sub-page.
await navigateTo(`/learning-center/${LC_CATEGORIES[0]!.slug}`, { replace: true })
</script>

<template>
  <div />
</template>
