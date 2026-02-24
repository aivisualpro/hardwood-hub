<script setup lang="ts">
import type { Task, SubTask } from '../data/schema'
import { statuses, priorities, labels } from '../data/data'
import { projects, taskProjectMap } from '../data/projects'
import { computed, ref, watch } from 'vue'

const { t } = useLocale()

interface Props {
  task: Task | null
  open: boolean
  availableAssignees?: { id: string; name: string; avatar: string }[]
}

const props = withDefaults(defineProps<Props>(), {
  availableAssignees: () => [
    { id: 'u1', name: 'Adeel Jabbar', avatar: '/avatars/adeel.png' },
    { id: 'u2', name: 'Sarah Khan', avatar: '' },
    { id: 'u3', name: 'Ahmed Ali', avatar: '' },
    { id: 'u4', name: 'Maria Lopez', avatar: '' },
    { id: 'u5', name: 'John Smith', avatar: '' },
  ],
})

const emit = defineEmits<{
  'update:open': [val: boolean]
  'update:task': [task: Task]
}>()

const isOpen = computed({
  get: () => props.open,
  set: (val) => emit('update:open', val),
})

// Local reactive copy of task
const localTask = ref<Task | null>(null)

watch(() => props.task, (t) => {
  if (t) {
    localTask.value = JSON.parse(JSON.stringify(t))
    if (!localTask.value!.subtasks) localTask.value!.subtasks = []
    if (!localTask.value!.description) localTask.value!.description = ''
  }
}, { immediate: true, deep: true })

// Emit updates when local task changes
function emitUpdate() {
  if (localTask.value) {
    emit('update:task', JSON.parse(JSON.stringify(localTask.value)))
  }
}

// Project info
const projectInfo = computed(() => {
  if (!localTask.value) return null
  const mapping = taskProjectMap[localTask.value.id]
  if (!mapping) return null
  const project = projects.find(p => p.id === mapping.projectId)
  if (!project) return null
  const stage = project.stages.find(s => s.id === mapping.stageId)
  return { project, stage }
})

// Status/Priority display
const statusDef = computed(() => statuses.find(s => s.value === localTask.value?.status))
const priorityDef = computed(() => priorities.find(p => p.value === localTask.value?.priority))
const labelDef = computed(() => labels.find(l => l.value === localTask.value?.label))

// Sub-task management
const newSubTaskTitle = ref('')
const newSubTaskPriority = ref('medium')
const showAddSubTask = ref(false)

function addSubTask() {
  if (!newSubTaskTitle.value.trim() || !localTask.value) return
  const subtask: SubTask = {
    id: `ST-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    title: newSubTaskTitle.value.trim(),
    status: 'todo',
    priority: newSubTaskPriority.value,
    createdAt: new Date().toISOString().split('T')[0],
  }
  localTask.value.subtasks = [...(localTask.value.subtasks || []), subtask]
  newSubTaskTitle.value = ''
  newSubTaskPriority.value = 'medium'
  showAddSubTask.value = false
  emitUpdate()
}

function toggleSubTask(subtaskId: string) {
  if (!localTask.value?.subtasks) return
  const st = localTask.value.subtasks.find(s => s.id === subtaskId)
  if (st) {
    st.status = st.status === 'done' ? 'todo' : 'done'
    emitUpdate()
  }
}

function removeSubTask(subtaskId: string) {
  if (!localTask.value?.subtasks) return
  localTask.value.subtasks = localTask.value.subtasks.filter(s => s.id !== subtaskId)
  emitUpdate()
}

// Progress
const subtaskProgress = computed(() => {
  const subs = localTask.value?.subtasks || []
  if (subs.length === 0) return 0
  return Math.round((subs.filter(s => s.status === 'done').length / subs.length) * 100)
})

const completedCount = computed(() => (localTask.value?.subtasks || []).filter(s => s.status === 'done').length)
const totalCount = computed(() => (localTask.value?.subtasks || []).length)

// Format date
function formatDate(dateStr?: string) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

// Due date info
const dueDateInfo = computed(() => {
  if (!localTask.value?.dueDate) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(localTask.value.dueDate)
  due.setHours(0, 0, 0, 0)
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return { label: `${Math.abs(diffDays)}d overdue`, class: 'text-red-500 bg-red-500/10' }
  if (diffDays === 0) return { label: 'Due today', class: 'text-amber-500 bg-amber-500/10' }
  if (diffDays <= 3) return { label: `${diffDays}d left`, class: 'text-amber-500 bg-amber-500/10' }
  return { label: `${diffDays}d left`, class: 'text-emerald-500 bg-emerald-500/10' }
})

// Status change
function updateStatus(val: any) {
  if (localTask.value && typeof val === 'string') {
    localTask.value.status = val
    emitUpdate()
  }
}

function updatePriority(val: any) {
  if (localTask.value && typeof val === 'string') {
    localTask.value.priority = val
    emitUpdate()
  }
}

// Description editing
const isEditingDesc = ref(false)
const descInput = ref('')

function startEditDesc() {
  descInput.value = localTask.value?.description || ''
  isEditingDesc.value = true
}

function saveDesc() {
  if (localTask.value) {
    localTask.value.description = descInput.value
    emitUpdate()
  }
  isEditingDesc.value = false
}
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="sm:max-w-[680px] p-0 gap-0 overflow-hidden task-detail-dialog">
      <!-- Gradient Header -->
      <div class="relative px-6 pt-6 pb-4 bg-gradient-to-br from-primary/8 via-primary/4 to-transparent border-b border-border/50">
        <!-- Close is auto-added by DialogContent -->

        <!-- Project & Phase badges -->
        <div v-if="projectInfo" class="flex items-center gap-2 mb-3">
          <span class="inline-flex items-center gap-1.5 rounded-full bg-background/80 backdrop-blur-sm border border-border/60 px-2.5 py-1 text-xs font-medium shadow-sm">
            <Icon :name="projectInfo.project.icon" class="size-3.5 text-primary" />
            {{ projectInfo.project.name }}
          </span>
          <Icon name="lucide:chevron-right" class="size-3 text-muted-foreground/60" />
          <span v-if="projectInfo.stage" class="inline-flex items-center gap-1.5 rounded-full bg-background/80 backdrop-blur-sm border border-border/60 px-2.5 py-1 text-xs font-medium shadow-sm">
            <span class="size-2 rounded-full" :style="{ backgroundColor: projectInfo.stage.color }" />
            {{ projectInfo.stage.name }}
          </span>
        </div>

        <!-- Task ID & Title -->
        <div class="flex items-start gap-3">
          <span class="shrink-0 mt-0.5 inline-flex items-center rounded-md bg-muted/80 px-2 py-1 text-xs font-mono font-semibold text-muted-foreground">
            {{ localTask?.id }}
          </span>
          <h2 class="text-lg font-semibold leading-snug tracking-tight flex-1">
            {{ localTask?.title }}
          </h2>
        </div>

        <!-- Category badge -->
        <div v-if="labelDef" class="mt-2.5">
          <span class="inline-flex items-center rounded-md bg-primary/10 border border-primary/20 px-2 py-0.5 text-xs font-medium text-primary">
            {{ t(labelDef.labelKey as any) }}
          </span>
        </div>
      </div>

      <!-- Scrollable Body -->
      <div class="px-6 py-5 max-h-[60vh] overflow-y-auto space-y-6 custom-scrollbar">
        <!-- Meta Grid -->
        <div class="grid grid-cols-2 gap-4">
          <!-- Status -->
          <div class="space-y-1.5">
            <span class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</span>
            <Select :model-value="localTask?.status" @update:model-value="updateStatus">
              <SelectTrigger class="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="s in statuses" :key="s.value" :value="s.value">
                  <div class="flex items-center gap-2">
                    <component :is="s.icon" v-if="s.icon" class="size-3.5 text-muted-foreground" />
                    <span>{{ t(s.labelKey as any) }}</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <!-- Priority -->
          <div class="space-y-1.5">
            <span class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Priority</span>
            <Select :model-value="localTask?.priority" @update:model-value="updatePriority">
              <SelectTrigger class="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="p in priorities" :key="p.value" :value="p.value">
                  <div class="flex items-center gap-2">
                    <component :is="p.icon" v-if="p.icon" class="size-3.5 text-muted-foreground" />
                    <span>{{ t(p.labelKey as any) }}</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <!-- Created Date -->
          <div class="space-y-1.5">
            <span class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Created</span>
            <div class="flex items-center gap-2 h-9 px-3 bg-muted/40 rounded-md border border-border/50">
              <Icon name="lucide:calendar" class="size-3.5 text-muted-foreground" />
              <span class="text-sm">{{ formatDate(localTask?.createdAt) }}</span>
            </div>
          </div>

          <!-- Due Date -->
          <div class="space-y-1.5">
            <span class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Due Date</span>
            <div class="flex items-center gap-2 h-9 px-3 bg-muted/40 rounded-md border border-border/50">
              <Icon name="lucide:clock" class="size-3.5 text-muted-foreground" />
              <span class="text-sm">{{ formatDate(localTask?.dueDate) }}</span>
              <span v-if="dueDateInfo" :class="dueDateInfo.class" class="ml-auto text-[10px] font-semibold rounded-md px-1.5 py-0.5">
                {{ dueDateInfo.label }}
              </span>
            </div>
          </div>
        </div>

        <!-- Description -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Description</span>
            <button
              v-if="!isEditingDesc"
              class="text-xs text-primary hover:text-primary/80 transition-colors"
              @click="startEditDesc"
            >
              <Icon name="lucide:pencil" class="size-3 inline mr-0.5" />
              Edit
            </button>
          </div>
          <div v-if="isEditingDesc" class="space-y-2">
            <textarea
              v-model="descInput"
              class="w-full min-h-[80px] rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
              placeholder="Add a description..."
            />
            <div class="flex items-center gap-2 justify-end">
              <Button variant="ghost" size="sm" @click="isEditingDesc = false">Cancel</Button>
              <Button size="sm" @click="saveDesc">Save</Button>
            </div>
          </div>
          <div v-else class="rounded-lg bg-muted/30 border border-border/50 px-3 py-2.5 min-h-[48px]">
            <p v-if="localTask?.description" class="text-sm text-foreground/80 whitespace-pre-wrap">{{ localTask.description }}</p>
            <p v-else class="text-sm text-muted-foreground/60 italic">No description added yet.</p>
          </div>
        </div>

        <!-- Separator -->
        <div class="relative">
          <div class="absolute inset-0 flex items-center">
            <span class="w-full border-t border-border/50" />
          </div>
          <div class="relative flex justify-center text-xs uppercase">
            <span class="bg-background px-3 text-muted-foreground font-medium tracking-wider">Sub-Tasks</span>
          </div>
        </div>

        <!-- Sub-Tasks Section -->
        <div class="space-y-3">
          <!-- Progress Bar -->
          <div v-if="totalCount > 0" class="space-y-1.5">
            <div class="flex items-center justify-between text-xs">
              <span class="text-muted-foreground">
                <span class="font-semibold text-foreground">{{ completedCount }}</span> of <span class="font-semibold text-foreground">{{ totalCount }}</span> completed
              </span>
              <span class="font-semibold" :class="subtaskProgress === 100 ? 'text-emerald-500' : 'text-primary'">{{ subtaskProgress }}%</span>
            </div>
            <div class="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-500 ease-out"
                :class="subtaskProgress === 100 ? 'bg-emerald-500' : 'bg-primary'"
                :style="{ width: `${subtaskProgress}%` }"
              />
            </div>
          </div>

          <!-- Sub-Task List -->
          <div class="space-y-1">
            <TransitionGroup name="subtask">
              <div
                v-for="st in localTask?.subtasks || []"
                :key="st.id"
                class="group flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50 transition-all duration-200 border border-transparent hover:border-border/50"
              >
                <!-- Checkbox -->
                <button
                  class="shrink-0 flex items-center justify-center size-5 rounded-full border-2 transition-all duration-300"
                  :class="st.status === 'done'
                    ? 'bg-emerald-500 border-emerald-500 text-white scale-100'
                    : 'border-muted-foreground/40 hover:border-primary hover:scale-110'"
                  @click="toggleSubTask(st.id)"
                >
                  <Icon v-if="st.status === 'done'" name="lucide:check" class="size-3" />
                </button>

                <!-- Content -->
                <div class="flex-1 min-w-0">
                  <span
                    class="text-sm transition-all duration-300"
                    :class="st.status === 'done' ? 'line-through text-muted-foreground/60' : 'text-foreground'"
                  >
                    {{ st.title }}
                  </span>
                  <div v-if="st.dueDate" class="text-[10px] text-muted-foreground mt-0.5">
                    Due {{ formatDate(st.dueDate) }}
                  </div>
                </div>

                <!-- Priority indicator -->
                <span
                  class="shrink-0 size-2 rounded-full"
                  :class="{
                    'bg-red-500': st.priority === 'high',
                    'bg-amber-500': st.priority === 'medium',
                    'bg-blue-400': st.priority === 'low',
                  }"
                />

                <!-- Delete button -->
                <button
                  class="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500"
                  @click="removeSubTask(st.id)"
                >
                  <Icon name="lucide:x" class="size-3.5" />
                </button>
              </div>
            </TransitionGroup>
          </div>

          <!-- Add Sub-Task -->
          <div v-if="showAddSubTask" class="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3 subtask-add-enter">
            <Input
              v-model="newSubTaskTitle"
              placeholder="What needs to be done?"
              class="h-9 bg-background"
              @keydown.enter="addSubTask"
              autofocus
            />
            <div class="flex items-center gap-2">
              <Select v-model="newSubTaskPriority">
                <SelectTrigger class="h-8 w-[130px] text-xs">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="p in priorities" :key="p.value" :value="p.value">
                    <div class="flex items-center gap-1.5 text-xs">
                      <component :is="p.icon" v-if="p.icon" class="size-3 text-muted-foreground" />
                      <span>{{ t(p.labelKey as any) }}</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <div class="flex-1" />
              <Button variant="ghost" size="sm" class="h-8 text-xs" @click="showAddSubTask = false">Cancel</Button>
              <Button size="sm" class="h-8 text-xs" :disabled="!newSubTaskTitle.trim()" @click="addSubTask">
                <Icon name="lucide:plus" class="size-3 mr-1" />
                Add
              </Button>
            </div>
          </div>

          <button
            v-else
            class="w-full flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 group"
            @click="showAddSubTask = true"
          >
            <span class="flex items-center justify-center size-5 rounded-full border-2 border-dashed border-muted-foreground/30 group-hover:border-primary/60 transition-colors">
              <Icon name="lucide:plus" class="size-3" />
            </span>
            Add a sub-task
          </button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.task-detail-dialog {
  animation: dialog-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

@keyframes dialog-pop {
  0% {
    opacity: 0;
    transform: scale(0.95) translateY(8px);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: hsl(var(--muted-foreground) / 0.2);
  border-radius: 999px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: hsl(var(--muted-foreground) / 0.35);
}

/* Sub-task transitions */
.subtask-enter-active,
.subtask-leave-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.subtask-enter-from {
  opacity: 0;
  transform: translateX(-12px) scale(0.97);
}
.subtask-leave-to {
  opacity: 0;
  transform: translateX(12px) scale(0.97);
}

.subtask-add-enter {
  animation: slide-in-up 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

@keyframes slide-in-up {
  0% {
    opacity: 0;
    transform: translateY(8px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
