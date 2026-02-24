<script setup lang="ts">
import { columns } from '@/components/tasks/components/columns'
import tasks from '@/components/tasks/data/tasks.json'

const { setHeader } = usePageHeader()
setHeader({ title: 'Tasks', icon: 'i-lucide-calendar-check-2', description: 'Here\'s a list of your tasks for this month!' })
</script>

<template>
  <div class="-m-4 lg:-m-6">
    <TasksLayout
      :data="tasks.data"
      :columns="columns"
      :nav-collapsed-size="4"
    />
  </div>
</template>
