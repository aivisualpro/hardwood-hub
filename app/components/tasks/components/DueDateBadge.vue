<script setup lang="ts">
const props = defineProps<{
  dueDate?: string
}>()

const { t } = useLocale()

const today = new Date()
today.setHours(0, 0, 0, 0)

const info = computed(() => {
  if (!props.dueDate) return null
  const due = new Date(props.dueDate)
  due.setHours(0, 0, 0, 0)
  const diffMs = due.getTime() - today.getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    return {
      tag: 'overdue',
      label: t('tasks.due.overdue' as any),
      remaining: `${Math.abs(diffDays)}d ${t('tasks.due.ago' as any)}`,
      classes: 'bg-red-500/15 text-red-500 border-red-500/25',
    }
  } else if (diffDays === 0) {
    return {
      tag: 'due',
      label: t('tasks.due.dueToday' as any),
      remaining: t('tasks.due.today' as any),
      classes: 'bg-amber-500/15 text-amber-500 border-amber-500/25',
    }
  } else if (diffDays <= 3) {
    return {
      tag: 'due',
      label: t('tasks.due.dueSoon' as any),
      remaining: `${diffDays}d ${t('tasks.due.left' as any)}`,
      classes: 'bg-amber-500/15 text-amber-500 border-amber-500/25',
    }
  } else {
    return {
      tag: 'onTrack',
      label: '',
      remaining: `${diffDays}d ${t('tasks.due.left' as any)}`,
      classes: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/25',
    }
  }
})

const formattedDate = computed(() => {
  if (!props.dueDate) return '—'
  const d = new Date(props.dueDate)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
})
</script>

<template>
  <div v-if="info" class="flex items-center gap-1.5">
    <span class="text-xs text-muted-foreground whitespace-nowrap">{{ formattedDate }}</span>
    <span
      class="inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold leading-none whitespace-nowrap"
      :class="info.classes"
    >
      {{ info.remaining }}
    </span>
  </div>
  <span v-else class="text-xs text-muted-foreground">—</span>
</template>
