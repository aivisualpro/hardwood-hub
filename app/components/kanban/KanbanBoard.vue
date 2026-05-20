<script setup lang="ts">
import type { DateValue } from '@internationalized/date'
import type { UseTimeAgoMessages, UseTimeAgoOptions, UseTimeAgoUnitNamesDefault } from '@vueuse/core'
import type { Column, NewTask, Task } from '~/types/kanban'
import {
  CalendarDateTime,
  DateFormatter,
  getLocalTimeZone,
  parseAbsoluteToLocal,
} from '@internationalized/date'
import Draggable from 'vuedraggable'
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
const userCookie = useCookie<{ employee: string, profileImage: string } | null>('hardwood_user')

// Permissions
const { canCreate, canUpdate, canDelete } = usePermissions('/tasks')

// Fetch employees for assignee dropdown
const employees = ref<any[]>([])
async function fetchEmployees() {
  try {
    const res = await $fetch<any>('/api/employees')
    employees.value = (res.data || []).filter((e: any) => e.status === 'Active')
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
const selectedAssignees = ref<{ id: string, name: string, avatar?: string }[]>([])
const newTask = reactive<NewTask>({
  title: '',
  description: '',
  priority: undefined,
  dueDate: undefined,
  status: '',
  labels: undefined,
  assignees: undefined,
})
function resetData() {
  dueDate.value = undefined
  dueTime.value = '00:00'
  selectedAssignees.value = []
}
watch(() => showModalTask.value.open, (newVal) => {
  if (!newVal) resetData()
})

function openNewTask(colId: string) {
  showModalTask.value = { type: 'create', open: true, columnId: colId }
  newTask.title = ''
  newTask.description = ''
  newTask.priority = undefined
  selectedAssignees.value = []
}
function createTask() {
  if (!showModalTask.value.columnId || !newTask.title.trim()) return
  const payload: NewTask = {
    title: newTask.title.trim(),
    description: newTask.description?.trim(),
    priority: newTask.priority,
    dueDate: dueDate.value?.toDate(getLocalTimeZone()),
    status: showModalTask.value.columnId,
    labels: newTask.labels,
    assignees: selectedAssignees.value.length ? selectedAssignees.value : undefined,
    createdBy: userCookie.value ? {
      id: '',
      name: userCookie.value.employee,
      avatar: userCookie.value.profileImage || '',
    } : undefined,
  }
  addTask(showModalTask.value.columnId, payload)
  showModalTask.value.open = false
}

function editTask() {
  if (!showModalTask.value.columnId || !newTask.title.trim()) return
  const payload: Partial<Task> = {
    title: newTask.title.trim(),
    description: newTask.description?.trim(),
    priority: newTask.priority,
    dueDate: dueDate.value?.toDate(getLocalTimeZone()),
    status: showModalTask.value.columnId,
    labels: newTask.labels,
    assignees: selectedAssignees.value.length ? selectedAssignees.value : undefined,
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

function onTaskDrop() {
  isDragging.value = false
  nextTick(() => setColumns([...board.value.columns]))
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

// ─── Infinite Scroll Handler ──────────────────────
function onColumnScroll(event: Event, columnId: string) {
  const el = event.target as HTMLElement
  const scrollBottom = el.scrollHeight - el.scrollTop - el.clientHeight
  if (scrollBottom < 100 && hasMore.value[columnId] && !loadingMore.value[columnId]) {
    loadMore(columnId)
  }
}

function colorPriority(p?: Task['priority']) {
  if (!p) return 'text-warning'
  if (p === 'low') return 'text-blue-500'
  if (p === 'medium') return 'text-warning'
  return 'text-destructive'
}

function iconPriority(p?: Task['priority']) {
  if (!p) return 'lucide:equal'
  if (p === 'low') return 'lucide:chevron-down'
  if (p === 'medium') return 'lucide:equal'
  return 'lucide:chevron-up'
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
    addComment(colId, taskId, newCommentText.value.trim(), userCookie.value?.employee, userCookie.value?.profileImage)
    newCommentText.value = ''
  }
}
</script>

<template>
  <div class="flex gap-2.5 sm:gap-4 overflow-x-auto overflow-y-hidden pb-4 h-[calc(100vh-theme(spacing.24))] px-1.5 sm:px-2 snap-x snap-mandatory sm:snap-none">

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
        :animation="100"
        handle=".col-handle"
        ghost-class="opacity-50"
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
                  {{ columnTotals[col.id] || col.tasks.length }}
                </Badge>
              </CardTitle>
              <CardAction v-if="canCreate()" class="flex">
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
                :group="canUpdate() ? { name: 'kanban-tasks', pull: true, put: true } : { name: 'kanban-tasks', pull: false, put: false }"
                item-key="id"
                :animation="100"
                class="flex flex-col gap-1.5 sm:gap-2 min-h-[24px] p-0.5"
                ghost-class="opacity-50"
                :disabled="!canUpdate()"
                @start="onDragStart"
                @end="onTaskDrop"
              >
                <template #item="{ element: t }: { element: Task }">
                  <div class="rounded-xl border bg-card px-2.5 sm:px-3 py-2 shadow-sm hover:bg-accent/50 cursor-pointer transition-colors" @click="openTaskDetail(col.id, t)">
                    <div class="flex items-center justify-between gap-1.5 sm:gap-2">
                      <div class="flex items-center gap-1.5 min-w-0">
                        <Tooltip v-if="t.createdBy">
                          <TooltipTrigger as-child>
                            <Avatar class="size-4 sm:size-5 shrink-0">
                              <AvatarImage :src="t.createdBy.avatar || ''" :alt="t.createdBy.name" />
                              <AvatarFallback class="text-[7px] sm:text-[8px]">{{ t.createdBy.name?.slice(0, 2).toUpperCase() }}</AvatarFallback>
                            </Avatar>
                          </TooltipTrigger>
                          <TooltipContent>Created by {{ t.createdBy.name }}</TooltipContent>
                        </Tooltip>
                        <span class="text-[10px] sm:text-[11px] text-muted-foreground font-mono truncate">{{ t.id }}</span>
                        <span class="text-[9px] sm:text-[10px] text-muted-foreground/60">{{ useTimeAgo(t.createdAt ?? '', OPTIONS) }}</span>
                      </div>
                      <DropdownMenu v-if="canUpdate() || canDelete()">
                        <DropdownMenuTrigger as-child>
                          <Button size="icon-sm" variant="ghost" class="size-6 sm:size-6 text-muted-foreground shrink-0" title="More actions">
                            <Icon name="lucide:ellipsis-vertical" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent class="w-20" align="start">
                          <DropdownMenuItem v-if="canUpdate()" @click="showEditTask(col.id, t.id)">
                            <Icon name="lucide:edit-2" class="size-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator v-if="canUpdate() && canDelete()" />
                          <DropdownMenuItem v-if="canDelete()" variant="destructive" class="text-destructive" @click="removeTask(col.id, t.id)">
                            <Icon name="lucide:trash-2" class="size-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <p class="font-medium leading-5 mt-1 text-[13px] sm:text-sm">
                      {{ t.title }}
                    </p>
                    <div v-if="t.labels?.length" class="mt-1.5 sm:mt-2 flex items-center gap-1 flex-wrap">
                      <Badge v-for="label in t.labels" :key="label" variant="outline" class="text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0">
                        {{ label }}
                      </Badge>
                    </div>
                    <div class="mt-1.5 sm:mt-2 flex items-center justify-between gap-2">
                      <div class="flex items-center gap-2 sm:gap-2">
                        <!-- Subtasks Popover -->
                        <Popover>
                          <PopoverTrigger as-child>
                            <button class="flex items-center text-[10px] sm:text-xs text-muted-foreground gap-0.5 sm:gap-1 hover:text-foreground transition-colors cursor-pointer min-h-[28px] sm:min-h-0 px-1 sm:px-0">
                              <Icon name="lucide:square-check-big" class="size-3.5" />
                              <span class="tabular-nums">{{ t.subtasks?.filter(s => s.completed).length || 0 }}/{{ t.subtasks?.length || 0 }}</span>
                            </button>
                          </PopoverTrigger>
                          <PopoverContent class="w-[260px] sm:w-72 p-0" align="start" @click.stop>
                            <div class="px-3 py-2 border-b">
                              <p class="text-sm font-semibold">Subtasks</p>
                            </div>
                            <div class="max-h-48 overflow-y-auto">
                              <div v-if="!t.subtasks?.length" class="px-3 py-4 text-sm text-muted-foreground text-center">
                                No subtasks yet
                              </div>
                              <div v-for="st in t.subtasks" :key="st.id" class="flex items-center gap-2 px-3 py-2 sm:py-1.5 hover:bg-accent/50 group">
                                <Checkbox :checked="st.completed" @update:checked="toggleSubtask(col.id, t.id, st.id)" />
                                <span class="text-xs sm:text-sm flex-1" :class="st.completed ? 'line-through text-muted-foreground' : ''">{{ st.title }}</span>
                                <button class="sm:opacity-0 sm:group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all cursor-pointer p-1" @click="removeSubtask(col.id, t.id, st.id)">
                                  <Icon name="lucide:x" class="size-3.5" />
                                </button>
                              </div>
                            </div>
                            <div class="border-t px-2 py-2">
                              <form class="flex gap-1.5" @submit.prevent="() => { if (newSubtaskTitle.trim()) { addSubtask(col.id, t.id, newSubtaskTitle.trim()); newSubtaskTitle = '' } }">
                                <Input v-model="newSubtaskTitle" placeholder="Add subtask..." class="h-8 sm:h-7 text-xs" />
                                <Button type="submit" size="icon" variant="ghost" class="size-8 sm:size-7 shrink-0">
                                  <Icon name="lucide:plus" class="size-3.5" />
                                </Button>
                              </form>
                            </div>
                          </PopoverContent>
                        </Popover>

                        <!-- Comments Popover -->
                        <Popover>
                          <PopoverTrigger as-child>
                            <button class="flex items-center text-[10px] sm:text-xs text-muted-foreground gap-0.5 sm:gap-1 hover:text-foreground transition-colors cursor-pointer min-h-[28px] sm:min-h-0 px-1 sm:px-0">
                              <Icon name="lucide:message-square" class="size-3.5" />
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
                                      <AvatarFallback class="text-[8px]">
                                        {{ cm.author?.slice(0, 2).toUpperCase() }}
                                      </AvatarFallback>
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
                                <p class="text-xs text-muted-foreground mt-1 leading-relaxed">
                                  {{ cm.text }}
                                </p>
                              </div>
                            </div>
                            <div class="border-t px-2 py-2">
                              <form class="flex gap-1.5" @submit.prevent="handleAddComment(col.id, t.id)">
                                <Input v-model="newCommentText" placeholder="Write a comment..." class="h-8 sm:h-7 text-xs" />
                                <Button type="submit" size="icon" variant="ghost" class="size-8 sm:size-7 shrink-0">
                                  <Icon name="lucide:send" class="size-3.5" />
                                </Button>
                              </form>
                            </div>
                          </PopoverContent>
                        </Popover>

                        <div v-if="t.dueDate" class="flex items-center text-[10px] sm:text-xs text-muted-foreground gap-0.5 sm:gap-1">
                          <Icon name="lucide:clock-fading" class="size-3 sm:size-3.5" />
                          <span>{{ useTimeAgo(t.dueDate ?? '', OPTIONS) }}</span>
                        </div>
                      </div>
                      <div class="flex items-center gap-1.5 sm:gap-2">
                        <Tooltip>
                          <TooltipTrigger as-child>
                            <Icon v-if="t.priority" :name="iconPriority(t.priority)" class="size-3.5 sm:size-4" :class="colorPriority(t.priority)" />
                          </TooltipTrigger>
                          <TooltipContent class="capitalize">
                            {{ t.priority }}
                          </TooltipContent>
                        </Tooltip>
                        <div v-if="t.assignees?.length" class="flex items-center -space-x-1.5">
                          <Tooltip v-for="a in t.assignees.slice(0, 3)" :key="a.id">
                            <TooltipTrigger as-child>
                              <Avatar class="size-5 sm:size-6 ring-2 ring-card">
                                <AvatarImage :src="a.avatar || ''" :alt="a.name" />
                                <AvatarFallback class="text-[9px] sm:text-[10px]">
                                  {{ a.name?.slice(0, 2).toUpperCase() }}
                                </AvatarFallback>
                              </Avatar>
                            </TooltipTrigger>
                            <TooltipContent>{{ a.name }}</TooltipContent>
                          </Tooltip>
                          <span v-if="t.assignees.length > 3" class="size-5 sm:size-6 rounded-full bg-muted ring-2 ring-card flex items-center justify-center text-[9px] font-semibold text-muted-foreground">
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

            <CardFooter v-if="canCreate()" class="px-1.5 sm:px-2 mt-auto shrink-0">
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
          <Label>Title</Label>
          <Input v-model="newTask.title" placeholder="Title" class="h-9 sm:h-10" />
          <Label>Description</Label>
          <Textarea v-model="newTask.description" placeholder="Description (optional)" rows="3" class="text-sm" />
          <Label>Priority</Label>
          <Select v-model="newTask.priority">
            <SelectTrigger class="w-full h-9 sm:h-10">
              <SelectValue placeholder="Select a priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
          <Label>Assignees</Label>
          <Popover>
            <PopoverTrigger as-child>
              <Button variant="outline" class="w-full justify-start h-auto min-h-9 sm:min-h-10 font-normal py-1.5 flex-wrap gap-1">
                <template v-if="selectedAssignees.length">
                  <div v-for="a in selectedAssignees" :key="a.id" class="flex items-center gap-1 bg-muted rounded-full pl-0.5 pr-2 py-0.5">
                    <Avatar class="size-4">
                      <AvatarImage :src="a.avatar || ''" :alt="a.name" />
                      <AvatarFallback class="text-[6px]">{{ a.name?.slice(0, 2).toUpperCase() }}</AvatarFallback>
                    </Avatar>
                    <span class="text-xs">{{ a.name }}</span>
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
              <div class="max-h-48 overflow-y-auto space-y-0.5">
                <button
                  v-for="emp in employees"
                  :key="emp._id"
                  class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors"
                  :class="selectedAssignees.some(a => a.id === emp._id) ? 'bg-accent' : ''"
                  @click="selectedAssignees.some(a => a.id === emp._id) ? selectedAssignees = selectedAssignees.filter(a => a.id !== emp._id) : selectedAssignees.push({ id: emp._id, name: emp.employee, avatar: emp.profileImage || '' })"
                >
                  <Avatar class="size-5">
                    <AvatarImage :src="emp.profileImage || ''" :alt="emp.employee" />
                    <AvatarFallback class="text-[8px]">{{ emp.employee?.slice(0, 2).toUpperCase() }}</AvatarFallback>
                  </Avatar>
                  <div class="flex flex-col items-start flex-1">
                    <span>{{ emp.employee }}</span>
                    <span class="text-[10px] text-muted-foreground">{{ emp.position }}</span>
                  </div>
                  <Icon v-if="selectedAssignees.some(a => a.id === emp._id)" name="lucide:check" class="size-4 ml-auto text-primary" />
                </button>
              </div>
            </PopoverContent>
          </Popover>
          <Label>Due Date</Label>
          <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 sm:gap-1">
            <Popover>
              <PopoverTrigger as-child>
                <Button
                  variant="outline"
                  :class="cn(
                    'flex-1 justify-start text-left font-normal px-3 h-9 sm:h-10',
                    !dueDate && 'text-muted-foreground',
                  )"
                >
                  <Icon name="lucide:calendar" class="mr-2" />
                  {{ dueDate ? df.format(dueDate.toDate(getLocalTimeZone())) : "Pick a date" }}
                </Button>
              </PopoverTrigger>
              <PopoverContent class="w-auto p-0">
                <Calendar v-model="dueDate" initial-focus />
              </PopoverContent>
            </Popover>
            <Input
              id="time-picker"
              v-model="dueTime"
              type="time"
              step="60"
              default-value="00:00"
              class="flex-1 bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none h-9 sm:h-10"
            />
          </div>
        </div>
      </div>
      <DialogFooter class="flex-col sm:flex-row gap-2 sm:gap-0">
        <Button variant="secondary" class="w-full sm:w-auto" @click="showModalTask.open = false">
          Cancel
        </Button>
        <Button class="w-full sm:w-auto" @click="showModalTask.type === 'create' ? createTask() : editTask()">
          {{ showModalTask.type === 'create' ? 'Create' : 'Update' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- ═══════ Task Detail Sheet ═══════ -->
  <Sheet :open="!!viewTask" @update:open="(v: boolean) => { if (!v) viewTask = null }">
    <SheetContent class="sm:max-w-lg overflow-y-auto p-0">
      <template v-if="viewTask">
        <div class="px-5 pt-5 pb-4 border-b border-border/50">
          <div class="flex items-center gap-2 mb-3">
            <span class="text-[10px] font-mono text-muted-foreground bg-muted/60 px-2 py-0.5 rounded">{{ viewTask.task.id }}</span>
            <Badge v-if="viewTask.task.priority" :variant="viewTask.task.priority === 'high' ? 'destructive' : 'secondary'" class="text-[10px] capitalize">
              <Icon :name="iconPriority(viewTask.task.priority)" class="size-3 mr-0.5" :class="colorPriority(viewTask.task.priority)" />
              {{ viewTask.task.priority }}
            </Badge>
            <Badge variant="outline" class="text-[10px] capitalize ml-auto">
              <Icon :name="columnIcon(viewTask.task.status || '')" class="size-3 mr-1" :class="columnColor(viewTask.task.status || '')" />
              {{ (viewTask.task.status || '').replace('-', ' ') }}
            </Badge>
          </div>
          <SheetTitle class="text-lg font-bold leading-snug mb-1">{{ viewTask.task.title }}</SheetTitle>
          <SheetDescription v-if="viewTask.task.description" class="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{{ viewTask.task.description }}</SheetDescription>
          <p v-else class="text-sm text-muted-foreground/50 italic">No description</p>
        </div>

        <!-- Meta Info -->
        <div class="px-5 py-4 border-b border-border/50 grid grid-cols-2 gap-4">
          <!-- Assignees -->
          <div class="col-span-2">
            <p class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Assignees</p>
            <div v-if="viewTask.task.assignees?.length" class="flex flex-wrap gap-2">
              <div v-for="a in viewTask.task.assignees" :key="a.id" class="flex items-center gap-1.5 bg-muted/50 rounded-full pl-1 pr-2.5 py-1">
                <Avatar class="size-5">
                  <AvatarImage :src="a.avatar || ''" :alt="a.name" />
                  <AvatarFallback class="text-[7px]">{{ a.name?.slice(0, 2).toUpperCase() }}</AvatarFallback>
                </Avatar>
                <span class="text-xs font-medium">{{ a.name }}</span>
              </div>
            </div>
            <span v-else class="text-sm text-muted-foreground/50">Unassigned</span>
          </div>
          <!-- Creator -->
          <div>
            <p class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Created By</p>
            <div v-if="viewTask.task.createdBy" class="flex items-center gap-2">
              <Avatar class="size-6">
                <AvatarImage :src="viewTask.task.createdBy.avatar || ''" :alt="viewTask.task.createdBy.name" />
                <AvatarFallback class="text-[8px]">{{ viewTask.task.createdBy.name?.slice(0, 2).toUpperCase() }}</AvatarFallback>
              </Avatar>
              <span class="text-sm font-medium truncate">{{ viewTask.task.createdBy.name }}</span>
            </div>
            <span v-else class="text-sm text-muted-foreground/50">—</span>
          </div>
          <!-- Due Date -->
          <div>
            <p class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Due Date</p>
            <div v-if="viewTask.task.dueDate" class="flex items-center gap-1.5 text-sm">
              <Icon name="i-lucide-calendar" class="size-3.5 text-muted-foreground" />
              <span>{{ new Date(viewTask.task.dueDate as any).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }}</span>
            </div>
            <span v-else class="text-sm text-muted-foreground/50">No due date</span>
          </div>
          <!-- Created At -->
          <div>
            <p class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Created</p>
            <span class="text-sm text-muted-foreground">{{ useTimeAgo(viewTask.task.createdAt ?? '', OPTIONS) }}</span>
          </div>
        </div>

        <!-- Labels -->
        <div v-if="viewTask.task.labels?.length" class="px-5 py-3 border-b border-border/50">
          <p class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Labels</p>
          <div class="flex flex-wrap gap-1.5">
            <Badge v-for="label in viewTask.task.labels" :key="label" variant="outline" class="text-xs">{{ label }}</Badge>
          </div>
        </div>

        <!-- Subtasks -->
        <div class="px-5 py-4 border-b border-border/50">
          <div class="flex items-center justify-between mb-3">
            <p class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Subtasks
              <span class="text-muted-foreground/60 ml-1">{{ viewTask.task.subtasks?.filter(s => s.completed).length || 0 }}/{{ viewTask.task.subtasks?.length || 0 }}</span>
            </p>
          </div>
          <div v-if="viewTask.task.subtasks?.length" class="space-y-1.5 mb-3">
            <div v-for="st in viewTask.task.subtasks" :key="st.id"
                 class="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-muted/30 group transition-colors">
              <Checkbox :checked="st.completed" @update:checked="toggleSubtask(viewTask!.colId, viewTask!.task.id, st.id)" />
              <span class="text-sm flex-1" :class="st.completed ? 'line-through text-muted-foreground' : ''">{{ st.title }}</span>
              <button class="sm:opacity-0 sm:group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-0.5" @click="removeSubtask(viewTask!.colId, viewTask!.task.id, st.id)">
                <Icon name="i-lucide-x" class="size-3.5" />
              </button>
            </div>
          </div>
          <form class="flex gap-1.5" @submit.prevent="() => { if (newSubtaskTitle.trim()) { addSubtask(viewTask!.colId, viewTask!.task.id, newSubtaskTitle.trim()); newSubtaskTitle = '' } }">
            <Input v-model="newSubtaskTitle" placeholder="Add subtask..." class="h-8 text-xs" />
            <Button type="submit" size="icon" variant="ghost" class="size-8 shrink-0">
              <Icon name="i-lucide-plus" class="size-3.5" />
            </Button>
          </form>
        </div>

        <!-- Comments -->
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
          <form class="flex gap-1.5" @submit.prevent="() => { if (newCommentText.trim()) { addComment(viewTask!.colId, viewTask!.task.id, newCommentText.trim(), userCookie?.employee, userCookie?.profileImage); newCommentText = '' } }">
            <Input v-model="newCommentText" placeholder="Write a comment..." class="h-8 text-xs" />
            <Button type="submit" size="icon" variant="ghost" class="size-8 shrink-0">
              <Icon name="i-lucide-send" class="size-3.5" />
            </Button>
          </form>
        </div>

        <!-- Actions Footer -->
        <div class="px-5 py-3 border-t border-border/50 flex items-center gap-2">
          <Button v-if="canUpdate()" size="sm" variant="outline" class="h-8 text-xs" @click="showEditTask(viewTask!.colId, viewTask!.task.id); viewTask = null">
            <Icon name="i-lucide-edit-2" class="size-3.5 mr-1.5" />
            Edit
          </Button>
          <Button v-if="canDelete()" size="sm" variant="outline" class="h-8 text-xs text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5" @click="removeTask(viewTask!.colId, viewTask!.task.id); viewTask = null">
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
