<script setup lang="ts">
import LearningCategoryView from '~/components/learning/LearningCategoryView.vue'
import { lcBySlug } from '~/constants/learning-center'

// Remount the page (and the view) when navigating between categories.
definePageMeta({ key: route => route.fullPath })

const route = useRoute()
const cfg = lcBySlug(route.params.category as string)
if (!cfg)
  throw createError({ statusCode: 404, statusMessage: 'Learning Center page not found' })
</script>

<template>
  <LearningCategoryView :category-key="cfg!.key" />
</template>
