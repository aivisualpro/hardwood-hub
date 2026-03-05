<script setup lang="ts">
import KanbanBoard from '~/components/kanban/KanbanBoard.vue'

const { setHeader } = usePageHeader()
setHeader({ titleKey: 'kanban.title', icon: 'i-lucide-kanban', descriptionKey: 'kanban.description' })
</script>

<template>
  <div class="h-full">
    <KanbanBoard />
  </div>
</template>
