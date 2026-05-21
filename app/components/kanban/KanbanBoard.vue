<script setup lang="ts">
import type { DateValue } from '@internationalized/date'
import type { UseTimeAgoMessages, UseTimeAgoOptions, UseTimeAgoUnitNamesDefault } from '@vueuse/core'
import type { Column, NewTask, Task } from '~/types/kanban'
import {
  CalendarDate,
  CalendarDateTime,
  DateFormatter,
  getLocalTimeZone,
  parseAbsoluteToLocal,
  today,
} from '@internationalized/date'
import Draggable from 'vuedraggable'
import { toast } from 'vue-sonner'
import { useKanban } from '~/composables/useKanban'
import CardFooter from '../ui/card/CardFooter.vue'

const {
  board, loading, loadingMore, hasMore, columnTotals,
  fetchBoard, loadMore,
  addTask, updateTask, removeTask, setColumns, takeSnapshot,
  addSubtask, toggleSubtask, removeSubtask,
  addComment, removeComment,
} = useKanban()

// Get current user for comments
const userCookie = useCookie<any>('hardwood_user')
const currentUser = computed(() => {
  if (!userCookie.value) return null
  if (typeof userCookie.value === 'string') {
    try {
      return JSON.parse(userCookie.value)
    } catch {
      return null
    }
  }
  return userCookie.value
})
const isSuperAdmin = computed(() => currentUser.value?.position === 'Super Admin')

// Permissions
const { canCreate, canUpdate, canDelete } = usePermissions('/tasks')

const canCreateTasks = computed(() => {
  if (isSuperAdmin.value) return true
  return canCreate()
})
const canUpdateTasks = computed(() => {
  if (isSuperAdmin.value) return true
  return canUpdate()
})
const canDeleteTasks = computed(() => {
  if (isSuperAdmin.value) return true
  return canDelete()
})

// Fetch employees for assignee dropdown
const employees = ref<any[]>([])
async function fetchEmployees() {
  try {
    const res = await $fetch<any>('/api/employees')
    employees.value = (res.data || []).filter((e: any) => e.status === 'Active').sort((a: any, b: any) => (a.employee || '').localeCompare(b.employee || ''))
  } catch (e) {
    console.error('[KanbanBoard] Failed to fetch employees', e)
  }
}

onMounted(() => {
  fetchBoard()
  fetchEmployees()
})

const newSubtaskTitle = ref('')
const newCommentText = ref('')

const df = new DateFormatter('en-US', { dateStyle: 'medium' })
const dueDate = ref<DateValue | undefined>()
const dueTime = ref<string | undefined>('00:00')

watch(() => dueTime.value, (newVal) => {
  if (!newVal) return
  if (dueDate.value) {
    const [hours, minutes] = newVal.split(':').map(Number)
    dueDate.value = new CalendarDateTime(
      dueDate.value.year,
      dueDate.value.month,
      dueDate.value.day,
      hours,
      minutes,
    )
  }
})

const showModalTask = ref<{ type: 'create' | 'edit', open: boolean, columnId: string | null, taskId?: string | null }>({
  type: 'create',
  open: false,
  columnId: null,
  taskId: null,
})
const selectedAssignees = ref<{ _id: string, employee: string, profileImage?: string }[]>([])
const newTask = reactive<NewTask>({
  title: '',
  description: '',
  priority: 'low',
  dueDate: undefined,
  status: '',
  labels: undefined,
  assignees: undefined,
})
function resetData() {
  dueDate.value = undefined
  dueTime.value = '00:00'
  selectedAssignees.value = []
  assigneeSearch.value = ''
}
watch(() => showModalTask.value.open, (newVal) => {
  if (!newVal) resetData()
})

function openNewTask(colId: string) {
  showModalTask.value = { type: 'create', open: true, columnId: colId }
  newTask.title = ''
  newTask.description = ''
  newTask.priority = 'low'
  selectedAssignees.value = []
  // Default due date = tomorrow
  const tomorrow = today(getLocalTimeZone()).add({ days: 1 })
  dueDate.value = new CalendarDateTime(tomorrow.year, tomorrow.month, tomorrow.day, 0, 0)
  dueTime.value = '00:00'
  taskFormTouched.value = false
}

// ─── Due Date +/- Day Adjustment ──────────────────────────
const minDueDate = computed(() => today(getLocalTimeZone()))

function adjustDueDate(days: number) {
  if (!dueDate.value) {
    const d = today(getLocalTimeZone()).add({ days: Math.max(1, days) })
    dueDate.value = new CalendarDateTime(d.year, d.month, d.day, 0, 0)
    return
  }
  const adjusted = dueDate.value.add({ days })
  const min = minDueDate.value
  // Don't allow due date before today
  if (adjusted.compare(new CalendarDateTime(min.year, min.month, min.day, 0, 0)) < 0) return
  dueDate.value = adjusted
}

// ─── Form Validation ──────────────────────────────────────
const taskFormTouched = ref(false)
const taskFormErrors = computed(() => {
  if (!taskFormTouched.value) return {}
  const errors: Record<string, string> = {}
  if (!newTask.title.trim()) errors.title = 'Title is required'
  if (!newTask.priority) errors.priority = 'Priority is required'
  if (!selectedAssignees.value.length) errors.assignees = 'At least one assignee is required'
  if (!dueDate.value) errors.dueDate = 'Due date is required'
  return errors
})
const isTaskFormValid = computed(() => {
  return !!newTask.title.trim() && !!newTask.priority && selectedAssignees.value.length > 0 && !!dueDate.value
})
function createTask() {
  taskFormTouched.value = true
  if (!showModalTask.value.columnId || !isTaskFormValid.value) return
  const payload: NewTask = {
    title: newTask.title.trim(),
    description: newTask.description?.trim(),
    priority: newTask.priority,
    dueDate: dueDate.value?.toDate(getLocalTimeZone()),
    status: showModalTask.value.columnId,
    labels: newTask.labels,
    assignees: selectedAssignees.value.map(a => a._id),
    createdBy: currentUser.value?._id || undefined,
  }
  addTask(showModalTask.value.columnId, payload)
  showModalTask.value.open = false
}

function editTask() {
  if (!showModalTask.value.columnId || !newTask.title.trim()) return
  const payload: Record<string, any> = {
    title: newTask.title.trim(),
    description: newTask.description?.trim(),
    priority: newTask.priority,
    dueDate: dueDate.value?.toDate(getLocalTimeZone()),
    status: showModalTask.value.columnId,
    labels: newTask.labels,
    assignees: selectedAssignees.value.length ? selectedAssignees.value.map(a => a._id) : undefined,
  }
  updateTask(showModalTask.value.columnId, showModalTask.value.taskId!, payload)
  showModalTask.value.open = false
}

function showEditTask(colId: string, taskId: string) {
  const task = board.value.columns.find(c => c.id === colId)?.tasks.find(t => t.id === taskId)
  if (!task) return
  newTask.title = task.title
  newTask.description = task.description
  newTask.priority = task.priority
  selectedAssignees.value = task.assignees?.length ? [...task.assignees] : []
  if (task.dueDate) {
    try {
      const d = typeof task.dueDate === 'string' ? task.dueDate : new Date(task.dueDate as any).toISOString()
      dueDate.value = parseAbsoluteToLocal(d)
      dueTime.value = `${dueDate.value.hour < 10 ? `0${dueDate.value?.hour}` : dueDate.value?.hour}:${dueDate.value.minute < 10 ? `0${dueDate.value?.minute}` : dueDate.value?.minute}`
    } catch { /* ignore invalid dates */ }
  }
  newTask.status = task.status
  newTask.labels = task.labels
  showModalTask.value = { type: 'edit', open: true, columnId: colId, taskId }
}

const isDragging = ref(false)

function onDragStart() {
  isDragging.value = true
  takeSnapshot()
}

async function onTaskDrop() {
  isDragging.value = false
  try {
    await nextTick()
    await setColumns([...board.value.columns])
  } catch (e: any) {
    // Approval gate — revert and show toast
    const msg = e?.data?.message || e?.message || 'Failed to reorder'
    toast.error(msg)
    await fetchBoard()
  }
}

// ─── Approval ───────────────────────────────────────
async function approveTask(colId: string, task: Task) {
  if (!(task as any)._id) return
  try {
    const res = await $fetch<any>(`/api/tasks/${(task as any)._id}`, {
      method: 'PUT',
      body: {
        approvedBy: currentUser.value?._id || null,
        status: 'done',
        _changedBy: currentUser.value?.employee || undefined,
        _changedById: currentUser.value?._id || currentUser.value?.id || '',
      },
    })
    if (res.data) {
      // Move task from current column to Done
      const fromCol = board.value.columns.find(c => c.id === colId)
      const toCol = board.value.columns.find(c => c.id === 'done')
      if (fromCol && toCol) {
        fromCol.tasks = fromCol.tasks.filter(t => t.id !== task.id)
        task.approvedBy = res.data.approvedBy
        task.status = 'done'
        toCol.tasks.unshift(task)
      }
      viewTask.value = null
      toast.success('Task approved and moved to Done')
    }
  } catch (e: any) {
    toast.error(e?.data?.message || 'Failed to approve task')
  }
}

// ─── Task Detail Popup ──────────────────────────────
const viewTask = ref<{ colId: string, task: Task } | null>(null)

function findTaskCol(taskId: string): { colId: string, task: Task } | null {
  for (const col of board.value.columns) {
    const t = col.tasks.find(t => t.id === taskId)
    if (t) return { colId: col.id, task: t }
  }
  return null
}

function openTaskDetail(colId: string, t: Task) {
  // Only open if not a drag
  if (isDragging.value) return
  viewTask.value = { colId, task: t }
}

async function openTaskWithComment(colId: string, t: Task) {
  viewTask.value = { colId, task: t }
  await nextTick()
  // Focus the comment input inside the sheet
  const input = document.querySelector('[data-comment-input]') as HTMLInputElement | null
  input?.focus()
}

// ─── Infinite Scroll Handler ──────────────────────
function onColumnScroll(event: Event, columnId: string) {
  const el = event.target as HTMLElement
  const scrollBottom = el.scrollHeight - el.scrollTop - el.clientHeight
  if (scrollBottom < 100 && hasMore.value[columnId] && !loadingMore.value[columnId]) {
    loadMore(columnId)
  }
}

function colorPriority(p?: Task['priority']) {
  if (!p) return 'text-muted-foreground'
  if (p === 'low') return 'text-blue-500'
  if (p === 'medium') return 'text-amber-500'
  return 'text-red-500'
}

function iconPriority(p?: Task['priority']) {
  if (!p) return 'lucide:minus'
  if (p === 'low') return 'lucide:arrow-down-circle'
  if (p === 'medium') return 'lucide:alert-circle'
  return 'lucide:alert-triangle'
}

function columnIcon(id: string) {
  const map: Record<string, string> = {
    'todo': 'i-lucide-circle',
    'in-progress': 'i-lucide-loader',
    'in-review': 'i-lucide-eye',
    'done': 'i-lucide-check-circle-2',
  }
  return map[id] || 'i-lucide-circle'
}

function columnColor(id: string) {
  const map: Record<string, string> = {
    'todo': 'text-blue-400',
    'in-progress': 'text-amber-400',
    'in-review': 'text-violet-400',
    'done': 'text-emerald-400',
  }
  return map[id] || 'text-muted-foreground'
}

const SHORT_MESSAGES = {
  justNow: 'now',
  past: (n: string, _isPast: boolean) => n,
  future: (n: string, _isPast: boolean) => n,
  invalid: '',
  second: (n: number, _isPast: boolean) => `${n}sec`,
  minute: (n: number, _isPast: boolean) => `${n}min`,
  hour: (n: number, _isPast: boolean) => `${n}h`,
  day: (n: number, _isPast: boolean) => `${n}d`,
  week: (n: number, _isPast: boolean) => `${n}w`,
  month: (n: number, _isPast: boolean) => `${n}m`,
  year: (n: number, _isPast: boolean) => `${n}y`,
} as const satisfies UseTimeAgoMessages<UseTimeAgoUnitNamesDefault>

const OPTIONS: UseTimeAgoOptions<false, UseTimeAgoUnitNamesDefault> = {
  messages: SHORT_MESSAGES,
  showSecond: true,
  rounding: 'floor',
  updateInterval: 1000,
}

function handleAddComment(colId: string, taskId: string) {
  if (newCommentText.value.trim()) {
    addComment(colId, taskId, newCommentText.value.trim(), currentUser.value?.employee, currentUser.value?.profileImage)
    newCommentText.value = ''
  }
}

// ─── Sheet Assignee Toggle ──────────────────────────
function toggleSheetAssignee(emp: any) {
  if (!viewTask.value) return
  const task = viewTask.value.task
  const current = task.assignees || []
  const exists = current.some((a: any) => a._id === emp._id)

  if (exists) {
    task.assignees = current.filter((a: any) => a._id !== emp._id)
  } else {
    task.assignees = [...current, { _id: emp._id, employee: emp.employee, profileImage: emp.profileImage || '' }]
  }

  // Persist: send ObjectId array to API
  updateTask(viewTask.value.colId, task.id, { assignees: (task.assignees || []).map((a: any) => a._id) } as any)
}

// ─── Remaining Days Helpers ─────────────────────────
function remainingDaysLabel(dueDate: any): string {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const due = new Date(dueDate)
  due.setHours(0, 0, 0, 0)
  const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diff < 0) return `${Math.abs(diff)}d overdue`
  if (diff === 0) return 'Due today'
  if (diff === 1) return '1 day left'
  return `${diff} days left`
}

function remainingDaysClass(dueDate: any): string {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const due = new Date(dueDate)
  due.setHours(0, 0, 0, 0)
  const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diff < 0) return 'bg-red-700 text-white'
  if (diff <= 2) return 'bg-amber-700 text-white'
  return 'bg-emerald-700 text-white'
}

function completedInDaysLabel(createdAt: any): string {
  const created = new Date(createdAt)
  created.setHours(0, 0, 0, 0)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const diff = Math.ceil((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
  if (diff <= 0) return 'Completed today'
  if (diff === 1) return 'Completed in 1 day'
  return `Completed in ${diff} days`
}

// ─── Search ────────────────────────────────────────────
const searchQuery = ref('')
const assigneeSearch = ref('')

// Filter tasks within each column based on search query
function filteredTasks(tasks: Task[]): Task[] {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return tasks
  return tasks.filter(t => {
    const titleMatch = t.title?.toLowerCase().includes(q)
    const descMatch = t.description?.toLowerCase().includes(q)
    const priorityMatch = t.priority?.toLowerCase().includes(q)
    const assigneeMatch = (t.assignees || []).some((a: any) => a.employee?.toLowerCase().includes(q))
    const labelMatch = (t.labels || []).some((l: string) => l.toLowerCase().includes(q))
    const creatorMatch = (t.createdBy as any)?.employee?.toLowerCase().includes(q)
    return titleMatch || descMatch || priorityMatch || assigneeMatch || labelMatch || creatorMatch
  })
}

const totalSearchResults = computed(() => {
  if (!searchQuery.value.trim()) return 0
  return board.value.columns.reduce((sum, c) => sum + filteredTasks(c.tasks).length, 0)
})

const filteredEmployees = computed(() => {
  const q = assigneeSearch.value.trim().toLowerCase()
  if (!q) return employees.value
  return employees.value.filter((e: any) => e.employee?.toLowerCase().includes(q) || e.position?.toLowerCase().includes(q))
})

function isTaskCreator(task: Task | null): boolean {
  if (!task) return false
  if (!currentUser.value) return false

  // 1. Compare by ID
  const creatorId = typeof task.createdBy === 'object' ? (task.createdBy as any)?._id || (task.createdBy as any)?.id : task.createdBy
  const currentUserId = currentUser.value?._id || currentUser.value?.id
  if (creatorId && currentUserId && String(creatorId).trim() === String(currentUserId).trim()) {
    return true
  }

  // 2. Compare by Employee Name (fallback/legacy/robustness)
  const creatorName = typeof task.createdBy === 'object' ? (task.createdBy as any)?.employee || (task.createdBy as any)?.name : null
  const currentUserName = currentUser.value?.employee || currentUser.value?.name
  if (creatorName && currentUserName && String(creatorName).trim().toLowerCase() === String(currentUserName).trim().toLowerCase()) {
    return true
  }

  return false
}

// Permission: can current user edit/delete this task?
function canEditTask(task: Task | null): boolean {
  if (!task) return false
  if (isSuperAdmin.value) return true
  return isTaskCreator(task)
}
</script>

<template>
  <!-- Teleport search into the main page header toolbar -->
  <Teleport to="#header-toolbar">
    <div class="flex items-center gap-2 w-full justify-end">
      <div class="relative w-full max-w-xs">
        <Icon name="lucide:search" class="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <Input
          v-model="searchQuery"
          placeholder="Search tasks..."
          class="pl-8 h-8 text-sm bg-background"
        />
        <button
          v-if="searchQuery"
          class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          @click="searchQuery = ''"
        >
          <Icon name="lucide:x" class="size-3.5" />
        </button>
      </div>
      <span v-if="searchQuery" class="text-xs text-muted-foreground whitespace-nowrap">
        {{ totalSearchResults }} result{{ totalSearchResults !== 1 ? 's' : '' }}
      </span>
    </div>
  </Teleport>

  <div class="flex gap-4 overflow-x-auto overflow-y-hidden h-[calc(100vh-theme(spacing.24))] snap-x snap-mandatory sm:snap-none">

    <!-- Loading State -->
    <template v-if="loading">
      <div v-for="i in 4" :key="i" class="flex-1 min-w-[220px] sm:min-w-[250px] rounded-xl border border-border/50 bg-card p-3 sm:p-4 space-y-3 self-start snap-center">
        <div class="h-5 w-24 bg-muted/40 rounded animate-pulse" />
        <div v-for="j in 3" :key="j" class="rounded-lg border border-border/30 p-3 space-y-2">
          <div class="h-3 w-16 bg-muted/30 rounded animate-pulse" />
          <div class="h-4 w-3/4 bg-muted/40 rounded animate-pulse" />
          <div class="h-3 w-1/2 bg-muted/30 rounded animate-pulse" />
        </div>
      </div>
    </template>

    <!-- Columns -->
    <template v-else>
      <Draggable
        v-model="board.columns"
        class="flex gap-2.5 sm:gap-4 w-full h-full"
        item-key="id"
        :animation="200"
        handle=".col-handle"
        ghost-class="opacity-40"
        :disabled="!!searchQuery"
        @start="onDragStart"
        @end="onTaskDrop"
      >
        <template #item="{ element: col }: { element: Column }">
          <Card class="flex-1 min-w-[220px] sm:min-w-[250px] py-2 gap-0 flex flex-col h-full snap-center">
            <CardHeader class="flex flex-row items-center justify-between gap-2 px-2.5 sm:px-3 shrink-0">
              <CardTitle class="font-semibold text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2">
                <Icon :name="columnIcon(col.id)" class="size-3.5 sm:size-4 col-handle cursor-grab" :class="columnColor(col.id)" />
                <span class="truncate">{{ col.title }}</span>
                <Badge variant="secondary" class="h-5 min-w-5 px-1.5 font-mono tabular-nums text-[10px]">
                  {{ searchQuery ? filteredTasks(col.tasks).length : (columnTotals[col.id] || col.tasks.length) }}
                </Badge>
              </CardTitle>
              <CardAction v-if="col.id === 'todo' && canCreateTasks" class="flex">
                <Button size="icon-sm" variant="ghost" class="size-7 sm:size-7 text-muted-foreground" @click="openNewTask(col.id)">
                  <Icon name="lucide:plus" />
                </Button>
              </CardAction>
            </CardHeader>

            <CardContent
              class="px-1.5 sm:px-2 overflow-y-auto flex-1 min-h-0"
              @scroll="onColumnScroll($event, col.id)"
            >
              <!-- Tasks within the column -->
              <Draggable
                v-model="col.tasks"
                :group="canUpdateTasks ? { name: 'kanban-tasks', pull: true, put: true } : { name: 'kanban-tasks', pull: false, put: false }"
                item-key="id"
                :animation="150"
                class="flex flex-col gap-1.5 sm:gap-2 min-h-[200px] p-0.5"
                ghost-class="opacity-50"
                :disabled="!canUpdateTasks || !!searchQuery"
                @start="onDragStart"
                @end="onTaskDrop"
              >
                <template #item="{ element: t }: { element: Task }">
                  <div v-show="filteredTasks(col.tasks).some(ft => ft.id === t.id)" class="rounded-xl border bg-card px-3 py-2.5 shadow-sm hover:bg-accent/50 cursor-pointer transition-colors" @click="openTaskDetail(col.id, t)">
                    <!-- Row 1: Created By & Created At -->
                    <div class="flex items-center gap-1.5 mb-1.5">
                      <Tooltip v-if="t.createdBy">
                        <TooltipTrigger as-child>
                          <Avatar class="size-5 shrink-0">
                            <AvatarImage :src="t.createdBy.profileImage || ''" :alt="t.createdBy.employee" />
                            <AvatarFallback class="text-[7px]">{{ t.createdBy.employee?.slice(0, 2).toUpperCase() }}</AvatarFallback>
                          </Avatar>
                        </TooltipTrigger>
                        <TooltipContent>{{ t.createdBy.employee }}</TooltipContent>
                      </Tooltip>
                      <span class="text-[11px] font-medium text-muted-foreground truncate">{{ t.createdBy?.employee || 'Unknown' }}</span>
                      <span class="text-[10px] text-muted-foreground/50 ml-auto shrink-0">{{ useTimeAgo(t.createdAt ?? '', OPTIONS) }}</span>
                    </div>
                    <!-- Row 2: Title -->
                    <p class="font-semibold leading-5 text-[13px] sm:text-sm">{{ t.title }}</p>
                    <!-- Row 3: Description (3 lines max) -->
                    <p v-if="t.description" class="text-xs text-muted-foreground leading-relaxed mt-1 line-clamp-3">{{ t.description }}</p>
                    <!-- Row 4: Due Date & Remaining / Completed -->
                    <div v-if="col.id === 'done'" class="flex items-center justify-between gap-2 mt-2">
                      <div class="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Icon name="lucide:check-circle" class="size-3" />
                        <span>Done</span>
                      </div>
                      <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-700 text-white">{{ completedInDaysLabel(t.createdAt) }}</span>
                    </div>
                    <div v-else-if="t.dueDate" class="flex items-center justify-between gap-2 mt-2">
                      <div class="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Icon name="lucide:calendar" class="size-3" />
                        <span>{{ new Date(t.dueDate as any).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }}</span>
                      </div>
                      <span
                        class="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                        :class="remainingDaysClass(t.dueDate)"
                      >{{ remainingDaysLabel(t.dueDate) }}</span>
                    </div>
                    <!-- Row 5: Comments counter & Priority -->
                    <div class="flex items-center justify-between gap-2 mt-2 pt-1.5 border-t border-border/30">
                      <Popover>
                        <PopoverTrigger as-child>
                          <button
                            class="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                            @click.stop
                          >
                            <Icon name="lucide:message-circle" class="size-3.5" />
                            <span class="tabular-nums">{{ t.comments?.length || 0 }}</span>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent class="w-[280px] sm:w-80 p-0" align="start" @click.stop>
                          <div class="px-3 py-2 border-b">
                            <p class="text-sm font-semibold">Comments</p>
                          </div>
                          <div class="max-h-56 overflow-y-auto">
                            <div v-if="!t.comments?.length" class="px-3 py-4 text-sm text-muted-foreground text-center">
                              No comments yet
                            </div>
                            <div v-for="cm in t.comments" :key="cm.id" class="px-3 py-2 border-b last:border-b-0 group">
                              <div class="flex items-center justify-between gap-2">
                                <div class="flex items-center gap-2">
                                  <Avatar class="size-5">
                                    <AvatarImage :src="cm.avatar || ''" :alt="cm.author" />
                                    <AvatarFallback class="text-[8px]">{{ cm.author?.slice(0, 2).toUpperCase() }}</AvatarFallback>
                                  </Avatar>
                                  <span class="text-xs font-medium">{{ cm.author }}</span>
                                </div>
                                <div class="flex items-center gap-1">
                                  <span class="text-[10px] text-muted-foreground">{{ useTimeAgo(cm.createdAt ?? '', OPTIONS) }}</span>
                                  <button class="sm:opacity-0 sm:group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all cursor-pointer p-1" @click="removeComment(col.id, t.id, cm.id)">
                                    <Icon name="lucide:x" class="size-3" />
                                  </button>
                                </div>
                              </div>
                              <p class="text-xs text-muted-foreground mt-1 leading-relaxed pl-7">{{ cm.text }}</p>
                            </div>
                          </div>
                          <div class="border-t px-2 py-2">
                            <form class="flex gap-1.5 items-end" @submit.prevent="handleAddComment(col.id, t.id)">
                              <Textarea v-model="newCommentText" placeholder="Write a comment..." class="text-xs min-h-[56px] max-h-[120px] resize-none" rows="2" />
                              <Button type="submit" size="icon" variant="ghost" class="size-7 shrink-0">
                                <Icon name="lucide:send" class="size-3.5" />
                              </Button>
                            </form>
                          </div>
                        </PopoverContent>
                      </Popover>
                      <Tooltip v-if="t.priority">
                        <TooltipTrigger as-child>
                          <Icon :name="iconPriority(t.priority)" class="size-4" :class="colorPriority(t.priority)" />
                        </TooltipTrigger>
                        <TooltipContent class="capitalize">{{ t.priority }} priority</TooltipContent>
                      </Tooltip>

                      <!-- Approve button for in-review tasks (visible only to the task creator) -->
                      <Tooltip v-if="col.id === 'in-review' && !t.approvedBy && isTaskCreator(t)">
                        <TooltipTrigger as-child>
                          <button
                            class="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25 transition-colors cursor-pointer"
                            @click.stop="approveTask(col.id, t)"
                          >
                            <Icon name="lucide:check-circle" class="size-3" />
                            Approve
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Approve and move to Done</TooltipContent>
                      </Tooltip>

                      <div class="flex items-center gap-1.5">
                        <div v-if="t.assignees?.length" class="flex items-center -space-x-1.5">
                          <Tooltip v-for="a in t.assignees.slice(0, 3)" :key="a._id">
                            <TooltipTrigger as-child>
                              <Avatar class="size-5 ring-2 ring-card">
                                <AvatarImage :src="a.profileImage || ''" :alt="a.employee" />
                                <AvatarFallback class="text-[7px]">{{ a.employee?.slice(0, 2).toUpperCase() }}</AvatarFallback>
                              </Avatar>
                            </TooltipTrigger>
                            <TooltipContent>{{ a.employee }}</TooltipContent>
                          </Tooltip>
                          <span v-if="t.assignees.length > 3" class="size-5 rounded-full bg-muted ring-2 ring-card flex items-center justify-center text-[8px] font-semibold text-muted-foreground">
                            +{{ t.assignees.length - 3 }}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </template>
              </Draggable>

              <!-- Load More Spinner -->
              <div v-if="loadingMore[col.id]" class="flex justify-center py-3">
                <Icon name="i-lucide-loader-2" class="size-5 text-muted-foreground animate-spin" />
              </div>

              <!-- End of list indicator -->
              <div v-if="!hasMore[col.id] && col.tasks.length > PAGE_SIZE" class="text-center py-2">
                <span class="text-[10px] text-muted-foreground/40 uppercase tracking-widest">All loaded</span>
              </div>
            </CardContent>

            <CardFooter v-if="col.id === 'todo' && canCreateTasks" class="px-1.5 sm:px-2 mt-auto shrink-0">
              <Button size="sm" variant="ghost" class="text-muted-foreground w-full justify-start text-xs sm:text-sm h-8 sm:h-9" @click="openNewTask(col.id)">
                <Icon name="lucide:plus" />
                Add Task
              </Button>
            </CardFooter>
          </Card>
        </template>
      </Draggable>
    </template>
  </div>

  <!-- New/Edit Task Dialog -->
  <Dialog v-model:open="showModalTask.open">
    <DialogContent class="max-w-[calc(100vw-2rem)] sm:max-w-[520px]">
      <DialogHeader>
        <DialogTitle>{{ showModalTask.type === 'create' ? 'New Task' : 'Edit Task' }}</DialogTitle>
        <DialogDescription class="sr-only">
          {{ showModalTask.type === 'create' ? 'Add a new task to the board' : 'Edit the task' }}
        </DialogDescription>
      </DialogHeader>
      <div class="flex flex-col gap-3">
        <div class="grid items-baseline grid-cols-1 md:grid-cols-4 md:[&>label]:col-span-1 *:col-span-3 gap-2 sm:gap-3">
          <Label>Title <span class="text-red-500">*</span></Label>
          <div class="flex flex-col gap-0.5">
            <Input v-model="newTask.title" placeholder="Title" class="h-9 sm:h-10" :class="taskFormErrors.title ? 'border-red-500' : ''" />
            <span v-if="taskFormErrors.title" class="text-[10px] text-red-500">{{ taskFormErrors.title }}</span>
          </div>
          <Label>Description</Label>
          <Textarea v-model="newTask.description" placeholder="Description (optional)" rows="3" class="text-sm" />
          <Label>Priority <span class="text-red-500">*</span></Label>
          <div class="flex flex-col gap-0.5">
            <Select v-model="newTask.priority">
              <SelectTrigger class="w-full h-9 sm:h-10" :class="taskFormErrors.priority ? 'border-red-500' : ''">
                <SelectValue placeholder="Select a priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
            <span v-if="taskFormErrors.priority" class="text-[10px] text-red-500">{{ taskFormErrors.priority }}</span>
          </div>
          <Label>Assignees <span class="text-red-500">*</span></Label>
          <div class="flex flex-col gap-0.5">
            <Popover>
              <PopoverTrigger as-child>
                <Button variant="outline" class="w-full justify-start h-auto min-h-9 sm:min-h-10 font-normal py-1.5 flex-wrap gap-1" :class="taskFormErrors.assignees ? 'border-red-500' : ''">
                  <template v-if="selectedAssignees.length">
                    <div v-for="a in selectedAssignees" :key="a._id" class="flex items-center gap-1 bg-muted rounded-full pl-0.5 pr-2 py-0.5">
                      <Avatar class="size-4">
                        <AvatarImage :src="a.profileImage || ''" :alt="a.employee" />
                        <AvatarFallback class="text-[7px]">{{ a.employee?.slice(0, 2).toUpperCase() }}</AvatarFallback>
                      </Avatar>
                      <span class="text-[10px] font-medium">{{ a.employee }}</span>
                    </div>
                  </template>
                  <template v-else>
                    <Icon name="lucide:users" class="mr-2 size-4 text-muted-foreground" />
                    <span class="text-muted-foreground">Select assignees</span>
                  </template>
                </Button>
              </PopoverTrigger>
              <PopoverContent class="w-[260px] p-1" align="start">
                <div class="px-2 py-1.5 border-b mb-1 flex items-center justify-between">
                  <p class="text-xs font-semibold text-muted-foreground">Employees</p>
                  <button v-if="selectedAssignees.length" class="text-[10px] text-muted-foreground hover:text-foreground transition-colors" @click="selectedAssignees = []">
                    Clear all
                  </button>
                </div>
                <div class="px-1.5 pb-1.5">
                  <Input v-model="assigneeSearch" placeholder="Search..." class="h-7 text-xs" />
                </div>
                <div class="max-h-48 overflow-y-auto space-y-0.5">
                  <button
                    v-for="emp in filteredEmployees"
                    :key="emp._id"
                    class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors"
                    :class="selectedAssignees.some(a => a._id === emp._id) ? 'bg-accent' : ''"
                    @click="selectedAssignees.some(a => a._id === emp._id) ? selectedAssignees = selectedAssignees.filter(a => a._id !== emp._id) : selectedAssignees.push({ _id: emp._id, employee: emp.employee, profileImage: emp.profileImage || '' })"
                  >
                    <Avatar class="size-5">
                      <AvatarImage :src="emp.profileImage || ''" :alt="emp.employee" />
                      <AvatarFallback class="text-[8px]">{{ emp.employee?.slice(0, 2).toUpperCase() }}</AvatarFallback>
                    </Avatar>
                    <div class="flex flex-col items-start flex-1">
                      <span>{{ emp.employee }}</span>
                      <span class="text-[10px] text-muted-foreground">{{ emp.position }}</span>
                    </div>
                    <Icon v-if="selectedAssignees.some(a => a._id === emp._id)" name="lucide:check" class="size-4 ml-auto text-primary" />
                  </button>
                </div>
              </PopoverContent>
            </Popover>
            <span v-if="taskFormErrors.assignees" class="text-[10px] text-red-500">{{ taskFormErrors.assignees }}</span>
          </div>
          <Label>Due Date <span class="text-red-500">*</span></Label>
          <div class="flex flex-col gap-0.5">
            <div class="flex items-center gap-1">
              <Button size="icon" variant="outline" class="size-9 sm:size-10 shrink-0" @click="adjustDueDate(-1)" :disabled="!dueDate || dueDate.compare(new CalendarDateTime(minDueDate.year, minDueDate.month, minDueDate.day, 0, 0)) <= 0">
                <Icon name="lucide:minus" class="size-4" />
              </Button>
              <Popover>
                <PopoverTrigger as-child>
                  <Button
                    variant="outline"
                    :class="cn(
                      'flex-1 justify-start text-left font-normal px-3 h-9 sm:h-10',
                      !dueDate && 'text-muted-foreground',
                      taskFormErrors.dueDate ? 'border-red-500' : '',
                    )"
                  >
                    <Icon name="lucide:calendar" class="mr-2" />
                    {{ dueDate ? df.format(dueDate.toDate(getLocalTimeZone())) : "Pick a date" }}
                  </Button>
                </PopoverTrigger>
                <PopoverContent class="w-auto p-0">
                  <Calendar v-model="dueDate" :min-value="minDueDate" initial-focus />
                </PopoverContent>
              </Popover>
              <Button size="icon" variant="outline" class="size-9 sm:size-10 shrink-0" @click="adjustDueDate(1)">
                <Icon name="lucide:plus" class="size-4" />
              </Button>
            </div>
            <div class="flex items-center gap-1">
              <Input
                id="time-picker"
                v-model="dueTime"
                type="time"
                step="60"
                default-value="00:00"
                class="flex-1 bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none h-9 sm:h-10"
              />
            </div>
            <span v-if="taskFormErrors.dueDate" class="text-[10px] text-red-500">{{ taskFormErrors.dueDate }}</span>
          </div>
        </div>
      </div>
      <DialogFooter class="flex-col sm:flex-row gap-2 sm:gap-0">
        <Button variant="secondary" class="w-full sm:w-auto" @click="showModalTask.open = false">
          Cancel
        </Button>
        <Button class="w-full sm:w-auto" :disabled="showModalTask.type === 'create' && taskFormTouched && !isTaskFormValid" @click="showModalTask.type === 'create' ? createTask() : editTask()">
          {{ showModalTask.type === 'create' ? 'Create' : 'Update' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- ═══════ Task Detail Sheet ═══════ -->
  <Sheet :open="!!viewTask" @update:open="(v: boolean) => { if (!v) viewTask = null }">
    <SheetContent class="sm:max-w-lg overflow-y-auto p-0">
      <template v-if="viewTask">
        <!-- Row 1: Title -->
        <div class="px-5 pt-6 pb-2">
          <SheetTitle class="text-lg font-bold leading-snug">{{ viewTask.task.title }}</SheetTitle>
        </div>

        <!-- Row 2: Description -->
        <div class="px-5 pb-4 border-b border-border/50">
          <SheetDescription v-if="viewTask.task.description" class="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{{ viewTask.task.description }}</SheetDescription>
          <p v-else class="text-sm text-muted-foreground/50 italic">No description</p>
        </div>

        <!-- Row 3: Assignees (editable) -->
        <div class="px-5 py-4 border-b border-border/50">
          <div class="flex items-center justify-between mb-2">
            <p class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Assignees</p>
            <Popover>
              <PopoverTrigger as-child>
                <button class="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 transition-colors font-medium cursor-pointer">
                  <Icon name="i-lucide-user-plus" class="size-3" />
                  Manage
                </button>
              </PopoverTrigger>
              <PopoverContent class="w-[250px] p-1" align="end" @click.stop>
                <div class="space-y-0.5 max-h-[200px] overflow-y-auto">
                  <button
                    v-for="emp in employees"
                    :key="emp._id"
                    class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors"
                    :class="viewTask!.task.assignees?.some((a: any) => a._id === emp._id) ? 'bg-accent' : ''"
                    @click="toggleSheetAssignee(emp)"
                  >
                    <Avatar class="size-5">
                      <AvatarImage :src="emp.profileImage || ''" :alt="emp.employee" />
                      <AvatarFallback class="text-[7px]">{{ emp.employee?.slice(0, 2).toUpperCase() }}</AvatarFallback>
                    </Avatar>
                    <span class="flex-1 text-left truncate">{{ emp.employee }}</span>
                    <Icon v-if="viewTask!.task.assignees?.some((a: any) => a._id === emp._id)" name="lucide:check" class="size-4 text-primary shrink-0" />
                  </button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <div v-if="viewTask.task.assignees?.length" class="flex flex-wrap gap-2">
            <Tooltip v-for="a in viewTask.task.assignees" :key="a._id">
              <TooltipTrigger as-child>
                <div class="flex items-center gap-1.5 bg-muted/50 rounded-full pl-1 pr-2.5 py-1 group/chip">
                  <Avatar class="size-5">
                    <AvatarImage :src="a.profileImage || ''" :alt="a.employee" />
                    <AvatarFallback class="text-[7px]">{{ a.employee?.slice(0, 2).toUpperCase() }}</AvatarFallback>
                  </Avatar>
                  <span class="text-xs font-medium">{{ a.employee }}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>{{ a.employee }}</TooltipContent>
            </Tooltip>
          </div>
          <span v-else class="text-sm text-muted-foreground/50">Unassigned</span>
        </div>

        <!-- Row 4: Priority, Status, Due Date, Remaining -->
        <div class="px-5 py-4 border-b border-border/50 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <!-- Priority -->
          <div>
            <p class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Priority</p>
            <div class="flex items-center gap-1.5 h-8">
              <Icon v-if="viewTask.task.priority" :name="iconPriority(viewTask.task.priority)" class="size-3.5" :class="colorPriority(viewTask.task.priority)" />
              <span class="text-sm capitalize">{{ viewTask.task.priority || '—' }}</span>
            </div>
          </div>
          <!-- Status -->
          <div>
            <p class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Status</p>
            <Select
              v-if="isSuperAdmin || isTaskCreator(viewTask.task)"
              :model-value="viewTask.task.status || 'todo'"
              @update:model-value="(val: any) => { if (viewTask) { updateTask(viewTask.colId, viewTask.task.id, { status: val }); viewTask.task.status = val; } }"
            >
              <SelectTrigger class="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todo">
                  <div class="flex items-center gap-2"><Icon name="i-lucide-circle" class="size-3.5 text-blue-400" /><span>To Do</span></div>
                </SelectItem>
                <SelectItem value="in-progress">
                  <div class="flex items-center gap-2"><Icon name="i-lucide-loader" class="size-3.5 text-amber-400" /><span>In Progress</span></div>
                </SelectItem>
                <SelectItem value="in-review">
                  <div class="flex items-center gap-2"><Icon name="i-lucide-eye" class="size-3.5 text-violet-400" /><span>In Review</span></div>
                </SelectItem>
                <SelectItem value="done">
                  <div class="flex items-center gap-2"><Icon name="i-lucide-check-circle-2" class="size-3.5 text-emerald-400" /><span>Done</span></div>
                </SelectItem>
              </SelectContent>
            </Select>
            <div v-else class="flex items-center gap-1.5 h-8">
              <Icon :name="columnIcon(viewTask.task.status || '')" class="size-3.5" :class="columnColor(viewTask.task.status || '')" />
              <span class="text-sm capitalize">{{ (viewTask.task.status || 'todo').replace('-', ' ') }}</span>
            </div>
          </div>
          <!-- Due Date -->
          <div>
            <p class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Due Date</p>
            <div v-if="viewTask.task.dueDate" class="flex items-center gap-1.5 h-8 text-sm">
              <Icon name="i-lucide-calendar" class="size-3.5 text-muted-foreground" />
              <span>{{ new Date(viewTask.task.dueDate as any).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }}</span>
            </div>
            <span v-else class="text-sm text-muted-foreground/50 h-8 flex items-center">—</span>
          </div>
          <!-- Remaining Days -->
          <div>
            <p class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Remaining</p>
            <div class="h-8 flex items-center">
              <template v-if="viewTask.task.dueDate">
                <span
                  class="text-xs font-semibold px-2 py-0.5 rounded-md"
                  :class="remainingDaysClass(viewTask.task.dueDate)"
                >{{ remainingDaysLabel(viewTask.task.dueDate) }}</span>
              </template>
              <span v-else class="text-sm text-muted-foreground/50">—</span>
            </div>
          </div>
        </div>

        <!-- Row 5: Created By & Created At -->
        <div class="px-5 py-4 border-b border-border/50 grid grid-cols-2 gap-4">
          <div>
            <p class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Created By</p>
            <div v-if="viewTask.task.createdBy" class="flex items-center gap-2">
              <Avatar class="size-6">
                <AvatarImage :src="viewTask.task.createdBy.profileImage || ''" :alt="viewTask.task.createdBy.employee" />
                <AvatarFallback class="text-[8px]">{{ viewTask.task.createdBy.employee?.slice(0, 2).toUpperCase() }}</AvatarFallback>
              </Avatar>
              <span class="text-sm font-medium truncate">{{ viewTask.task.createdBy.employee }}</span>
            </div>
            <span v-else class="text-sm text-muted-foreground/50">—</span>
          </div>
          <div>
            <p class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Created At</p>
            <span class="text-sm text-muted-foreground">{{ useTimeAgo(viewTask.task.createdAt ?? '', OPTIONS) }}</span>
          </div>
        </div>

        <!-- Row 6: Comments -->
        <div class="px-5 py-4">
          <p class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Comments
            <span class="text-muted-foreground/60 ml-1">{{ viewTask.task.comments?.length || 0 }}</span>
          </p>
          <div v-if="viewTask.task.comments?.length" class="space-y-3 mb-4">
            <div v-for="cm in viewTask.task.comments" :key="cm.id" class="group">
              <div class="flex items-center justify-between gap-2 mb-1">
                <div class="flex items-center gap-2">
                  <Avatar class="size-5">
                    <AvatarImage :src="cm.avatar || ''" :alt="cm.author" />
                    <AvatarFallback class="text-[8px]">{{ cm.author?.slice(0, 2).toUpperCase() }}</AvatarFallback>
                  </Avatar>
                  <span class="text-xs font-semibold">{{ cm.author }}</span>
                  <span class="text-[10px] text-muted-foreground">{{ useTimeAgo(cm.createdAt ?? '', OPTIONS) }}</span>
                </div>
                <button class="sm:opacity-0 sm:group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-0.5" @click="removeComment(viewTask!.colId, viewTask!.task.id, cm.id)">
                  <Icon name="i-lucide-x" class="size-3" />
                </button>
              </div>
              <p class="text-sm text-muted-foreground leading-relaxed pl-7">{{ cm.text }}</p>
            </div>
          </div>
          <form class="flex gap-1.5 items-end" @submit.prevent="() => { if (newCommentText.trim()) { addComment(viewTask!.colId, viewTask!.task.id, newCommentText.trim(), currentUser?.employee, currentUser?.profileImage); newCommentText = '' } }">
            <Textarea v-model="newCommentText" placeholder="Write a comment..." class="text-xs min-h-[64px] max-h-[160px] resize-y" rows="2" data-comment-input />
            <Button type="submit" size="icon" variant="ghost" class="size-8 shrink-0">
              <Icon name="i-lucide-send" class="size-3.5" />
            </Button>
          </form>
        </div>

        <!-- Approval Status (only when in-review) -->
        <div v-if="viewTask.task.status === 'in-review'" class="px-5 py-3 border-t border-border/50">
          <div v-if="viewTask.task.approvedBy" class="flex items-center gap-2 text-sm">
            <Icon name="i-lucide-check-circle-2" class="size-4 text-emerald-500" />
            <span class="text-emerald-600 font-medium">Approved</span>
            <span class="text-muted-foreground text-xs">by {{ viewTask.task.approvedBy.employee }}</span>
          </div>
          <div v-else class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 text-sm">
              <Icon name="i-lucide-clock" class="size-4 text-amber-500" />
              <span class="text-amber-600 font-medium">Awaiting Approval</span>
            </div>
            <Button
              v-if="isTaskCreator(viewTask.task)"
              size="sm"
              class="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              @click="approveTask(viewTask!.colId, viewTask!.task)"
            >
              <Icon name="i-lucide-check" class="size-3.5 mr-1.5" />
              Approve
            </Button>
          </div>
        </div>

        <!-- Actions Footer -->
        <div class="px-5 py-3 border-t border-border/50 flex items-center gap-2">
          <Button v-if="canUpdateTasks && canEditTask(viewTask?.task)" size="sm" variant="outline" class="h-8 text-xs" @click="showEditTask(viewTask!.colId, viewTask!.task.id); viewTask = null">
            <Icon name="i-lucide-edit-2" class="size-3.5 mr-1.5" />
            Edit
          </Button>
          <Button v-if="canDeleteTasks && canEditTask(viewTask?.task)" size="sm" variant="outline" class="h-8 text-xs text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5" @click="removeTask(viewTask!.colId, viewTask!.task.id); viewTask = null">
            <Icon name="i-lucide-trash-2" class="size-3.5 mr-1.5" />
            Delete
          </Button>
        </div>
      </template>
    </SheetContent>
  </Sheet>
</template>

<script lang="ts">
const PAGE_SIZE = 20
</script>
