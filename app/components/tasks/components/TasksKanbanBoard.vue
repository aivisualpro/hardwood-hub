<script setup lang="ts">
import type { Task } from '../data/schema'
import { statuses, priorities } from '../data/data'
import { inject, ref } from 'vue'
import Draggable from 'vuedraggable'

const props = defineProps<{
  data: Task[]
}>()

const emit = defineEmits<{
  taskClick: [task: Task]
  addTask: []
  updateData: [tasks: Task[]]
}>()

const { t } = useLocale()

const context = inject<{
  updateTask: (taskId: string, updates: Partial<Task>) => void
  availableAssignees: { id: string; name: string; avatar: string }[]
}>('task-table-context')

// Build columns from statuses
const statusColumns = computed(() => {
  return statuses.map(s => ({
    id: s.value,
    title: t(s.labelKey as any),
    labelKey: s.labelKey,
    icon: s.icon,
    tasks: props.data.filter(task => task.status === s.value),
  }))
})

// Make a mutable copy for dragging
const columns = ref<{ id: string; title: string; labelKey: string; icon: any; tasks: Task[] }[]>([])

watch(() => statusColumns.value, (val) => {
  columns.value = val.map(c => ({ ...c, tasks: [...c.tasks] }))
}, { immediate: true, deep: true })

// Color map for column headers
const columnColors: Record<string, string> = {
  backlog: 'bg-slate-500',
  todo: 'bg-blue-500',
  'in progress': 'bg-amber-500',
  done: 'bg-emerald-500',
  canceled: 'bg-red-500',
}

// Priority styling
function priorityColor(p: string) {
  if (p === 'high') return 'text-rose-500'
  if (p === 'medium') return 'text-amber-500'
  return 'text-sky-500'
}

function priorityIcon(p: string) {
  if (p === 'high') return 'lucide:arrow-up'
  if (p === 'medium') return 'lucide:minus'
  return 'lucide:arrow-down'
}

// Assignee helpers
function getAssignees(task: Task) {
  const ids = task.assignees || []
  if (!context?.availableAssignees) return []
  return ids
    .map(id => context.availableAssignees.find(a => a.id === id))
    .filter(Boolean) as { id: string; name: string; avatar: string }[]
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

const avatarColors = [
  'bg-violet-500/80', 'bg-sky-500/80', 'bg-emerald-500/80', 'bg-amber-500/80',
  'bg-rose-500/80', 'bg-indigo-500/80', 'bg-teal-500/80', 'bg-pink-500/80',
]

function getAvatarColor(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash)
  return avatarColors[Math.abs(hash) % avatarColors.length]
}

// Handle drag across columns
function onTaskDrop() {
  nextTick(() => {
    // Sync statuses based on column placement
    for (const col of columns.value) {
      for (const task of col.tasks) {
        if (task.status !== col.id) {
          context?.updateTask(task.id, { status: col.id })
        }
      }
    }
  })
}

// Due date display
function dueLabel(d?: string) {
  if (!d) return ''
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(d)
  due.setHours(0, 0, 0, 0)
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000)
  if (diff < 0) return `${Math.abs(diff)}d ago`
  if (diff === 0) return 'Today'
  return `${diff}d`
}

function dueClass(d?: string) {
  if (!d) return ''
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(d)
  due.setHours(0, 0, 0, 0)
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000)
  if (diff < 0) return 'text-red-500'
  if (diff <= 3) return 'text-amber-500'
  return 'text-muted-foreground'
}
</script>

<template>
  <div class="flex gap-4 overflow-x-auto overflow-y-hidden pb-4 h-full">
    <div
      v-for="col in columns"
      :key="col.id"
      class="flex flex-col w-[280px] shrink-0 rounded-xl border bg-card/50 backdrop-blur-sm"
    >
      <!-- Column Header -->
      <div class="flex items-center gap-2 px-3 py-2.5 border-b">
        <span class="size-2 rounded-full shrink-0" :class="columnColors[col.id] || 'bg-slate-500'" />
        <span class="text-sm font-semibold flex-1">{{ col.title }}</span>
        <Badge variant="secondary" class="h-5 min-w-5 px-1.5 font-mono tabular-nums text-[10px]">
          {{ col.tasks.length }}
        </Badge>
      </div>

      <!-- Draggable Tasks -->
      <div class="flex-1 overflow-y-auto p-2">
        <Draggable
          v-model="col.tasks"
          :group="{ name: 'tasks-kanban', pull: true, put: true }"
          item-key="id"
          :animation="200"
          class="flex flex-col gap-2 min-h-[40px]"
          ghost-class="opacity-40"
          @end="onTaskDrop"
        >
          <template #item="{ element: task }: { element: Task }">
            <div
              class="rounded-xl border bg-card px-3 py-2.5 shadow-sm hover:shadow-md hover:border-primary/20 cursor-pointer transition-all duration-200 group"
              @click="emit('taskClick', task)"
            >
              <!-- Task ID -->
              <div class="flex items-center justify-between">
                <span class="text-[10px] font-mono text-muted-foreground/70">{{ task.id }}</span>
                <Icon
                  :name="priorityIcon(task.priority)"
                  class="size-3.5"
                  :class="priorityColor(task.priority)"
                />
              </div>

              <!-- Title -->
              <p class="text-sm font-medium leading-snug mt-1.5 line-clamp-2">{{ task.title }}</p>

              <!-- Labels -->
              <div class="mt-2 flex items-center gap-1 flex-wrap">
                <span class="inline-flex items-center rounded-md bg-primary/8 border border-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary/80">
                  {{ task.label }}
                </span>
              </div>

              <!-- Footer -->
              <div class="mt-2.5 flex items-center justify-between">
                <!-- Due date -->
                <div v-if="task.dueDate" class="flex items-center gap-1 text-[10px]" :class="dueClass(task.dueDate)">
                  <Icon name="lucide:clock" class="size-3" />
                  <span class="font-medium">{{ dueLabel(task.dueDate) }}</span>
                </div>
                <div v-else />

                <!-- Assignees -->
                <div class="flex -space-x-1">
                  <Tooltip v-for="a in getAssignees(task).slice(0, 2)" :key="a.id">
                    <TooltipTrigger as-child>
                      <div
                        class="flex items-center justify-center size-5 rounded-full border-[1.5px] border-background text-[8px] font-bold text-white"
                        :class="getAvatarColor(a.id)"
                      >
                        {{ getInitials(a.name) }}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" :side-offset="2">
                      <p class="text-xs">{{ a.name }}</p>
                    </TooltipContent>
                  </Tooltip>
                  <div
                    v-if="getAssignees(task).length > 2"
                    class="flex items-center justify-center size-5 rounded-full border-[1.5px] border-background bg-muted text-[8px] font-bold text-muted-foreground"
                  >
                    +{{ getAssignees(task).length - 2 }}
                  </div>
                </div>
              </div>
            </div>
          </template>
        </Draggable>
      </div>
    </div>
  </div>
</template>
