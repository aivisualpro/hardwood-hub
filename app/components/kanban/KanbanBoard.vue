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
  addTask, updateTask, removeTask, setColumns,
  addSubtask, toggleSubtask, removeSubtask,
  addComment, removeComment,
} = useKanban()

// Get current user for comments
const userCookie = useCookie<{ employee: string, profileImage: string } | null>('hardwood_user')

onMounted(() => fetchBoard())

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
const newTask = reactive<NewTask>({
  title: '',
  description: '',
  priority: undefined,
  dueDate: undefined,
  status: '',
  labels: undefined,
})
function resetData() {
  dueDate.value = undefined
  dueTime.value = '00:00'
}
watch(() => showModalTask.value.open, (newVal) => {
  if (!newVal) resetData()
})

function openNewTask(colId: string) {
  showModalTask.value = { type: 'create', open: true, columnId: colId }
  newTask.title = ''
  newTask.description = ''
  newTask.priority = undefined
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

function onTaskDrop() {
  nextTick(() => setColumns([...board.value.columns]))
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
  <div class="flex gap-4 overflow-x-auto overflow-y-hidden pb-4 h-[calc(100vh-theme(spacing.24))] px-2">

    <!-- Loading State -->
    <template v-if="loading">
      <div v-for="i in 4" :key="i" class="flex-1 min-w-[250px] rounded-xl border border-border/50 bg-card p-4 space-y-3 self-start">
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
        class="flex gap-4 w-full h-full"
        item-key="id"
        :animation="180"
        handle=".col-handle"
        ghost-class="opacity-50"
        @end="onTaskDrop"
      >
        <template #item="{ element: col }: { element: Column }">
          <Card class="flex-1 min-w-[250px] py-2 gap-0 flex flex-col h-full">
            <CardHeader class="flex flex-row items-center justify-between gap-2 px-3 shrink-0">
              <CardTitle class="font-semibold text-sm flex items-center gap-2">
                <Icon :name="columnIcon(col.id)" class="size-4 col-handle cursor-grab" :class="columnColor(col.id)" />
                <span>{{ col.title }}</span>
                <Badge variant="secondary" class="h-5 min-w-5 px-1.5 font-mono tabular-nums text-[10px]">
                  {{ columnTotals[col.id] || col.tasks.length }}
                </Badge>
              </CardTitle>
              <CardAction class="flex">
                <Button size="icon-sm" variant="ghost" class="size-7 text-muted-foreground" @click="openNewTask(col.id)">
                  <Icon name="lucide:plus" />
                </Button>
              </CardAction>
            </CardHeader>

            <CardContent
              class="px-2 overflow-y-auto flex-1 min-h-0"
              @scroll="onColumnScroll($event, col.id)"
            >
              <!-- Tasks within the column -->
              <Draggable
                v-model="col.tasks"
                :group="{ name: 'kanban-tasks', pull: true, put: true }"
                item-key="id"
                :animation="180"
                class="flex flex-col gap-2 min-h-[24px] p-0.5"
                ghost-class="opacity-50"
                @end="onTaskDrop"
              >
                <template #item="{ element: t }: { element: Task }">
                  <div class="rounded-xl border bg-card px-3 py-2 shadow-sm hover:bg-accent/50 cursor-pointer transition-colors">
                    <div class="flex items-start justify-between gap-2">
                      <div class="text-[11px] text-muted-foreground font-mono">
                        {{ t.id }}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger as-child>
                          <Button size="icon-sm" variant="ghost" class="size-6 text-muted-foreground" title="More actions">
                            <Icon name="lucide:ellipsis-vertical" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent class="w-20" align="start">
                          <DropdownMenuItem @click="showEditTask(col.id, t.id)">
                            <Icon name="lucide:edit-2" class="size-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" class="text-destructive" @click="removeTask(col.id, t.id)">
                            <Icon name="lucide:trash-2" class="size-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <p class="font-medium leading-5 mt-1 text-sm">
                      {{ t.title }}
                    </p>
                    <div v-if="t.labels?.length" class="mt-2 flex items-center gap-1 flex-wrap">
                      <Badge v-for="label in t.labels" :key="label" variant="outline" class="text-[10px] px-1.5 py-0">
                        {{ label }}
                      </Badge>
                    </div>
                    <div class="mt-2 flex items-center justify-between gap-2">
                      <div class="flex items-center gap-2">
                        <!-- Subtasks Popover -->
                        <Popover>
                          <PopoverTrigger as-child>
                            <button class="flex items-center text-xs text-muted-foreground gap-1 hover:text-foreground transition-colors cursor-pointer">
                              <Icon name="lucide:square-check-big" class="size-3.5" />
                              <span class="tabular-nums">{{ t.subtasks?.filter(s => s.completed).length || 0 }}/{{ t.subtasks?.length || 0 }}</span>
                            </button>
                          </PopoverTrigger>
                          <PopoverContent class="w-72 p-0" align="start" @click.stop>
                            <div class="px-3 py-2 border-b">
                              <p class="text-sm font-semibold">Subtasks</p>
                            </div>
                            <div class="max-h-48 overflow-y-auto">
                              <div v-if="!t.subtasks?.length" class="px-3 py-4 text-sm text-muted-foreground text-center">
                                No subtasks yet
                              </div>
                              <div v-for="st in t.subtasks" :key="st.id" class="flex items-center gap-2 px-3 py-1.5 hover:bg-accent/50 group">
                                <Checkbox :checked="st.completed" @update:checked="toggleSubtask(col.id, t.id, st.id)" />
                                <span class="text-sm flex-1" :class="st.completed ? 'line-through text-muted-foreground' : ''">{{ st.title }}</span>
                                <button class="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all cursor-pointer" @click="removeSubtask(col.id, t.id, st.id)">
                                  <Icon name="lucide:x" class="size-3.5" />
                                </button>
                              </div>
                            </div>
                            <div class="border-t px-2 py-2">
                              <form class="flex gap-1.5" @submit.prevent="() => { if (newSubtaskTitle.trim()) { addSubtask(col.id, t.id, newSubtaskTitle.trim()); newSubtaskTitle = '' } }">
                                <Input v-model="newSubtaskTitle" placeholder="Add subtask..." class="h-7 text-xs" />
                                <Button type="submit" size="icon" variant="ghost" class="size-7 shrink-0">
                                  <Icon name="lucide:plus" class="size-3.5" />
                                </Button>
                              </form>
                            </div>
                          </PopoverContent>
                        </Popover>

                        <!-- Comments Popover -->
                        <Popover>
                          <PopoverTrigger as-child>
                            <button class="flex items-center text-xs text-muted-foreground gap-1 hover:text-foreground transition-colors cursor-pointer">
                              <Icon name="lucide:message-square" class="size-3.5" />
                              <span class="tabular-nums">{{ t.comments?.length || 0 }}</span>
                            </button>
                          </PopoverTrigger>
                          <PopoverContent class="w-80 p-0" align="start" @click.stop>
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
                                    <button class="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all cursor-pointer" @click="removeComment(col.id, t.id, cm.id)">
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
                                <Input v-model="newCommentText" placeholder="Write a comment..." class="h-7 text-xs" />
                                <Button type="submit" size="icon" variant="ghost" class="size-7 shrink-0">
                                  <Icon name="lucide:send" class="size-3.5" />
                                </Button>
                              </form>
                            </div>
                          </PopoverContent>
                        </Popover>

                        <div v-if="t.dueDate" class="flex items-center text-xs text-muted-foreground gap-1">
                          <Icon name="lucide:clock-fading" class="size-3.5" />
                          <span>{{ useTimeAgo(t.dueDate ?? '', OPTIONS) }}</span>
                        </div>
                      </div>
                      <div class="flex items-center gap-2">
                        <Tooltip>
                          <TooltipTrigger as-child>
                            <Icon v-if="t.priority" :name="iconPriority(t.priority)" class="size-4" :class="colorPriority(t.priority)" />
                          </TooltipTrigger>
                          <TooltipContent class="capitalize">
                            {{ t.priority }}
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip v-if="t.assignee">
                          <TooltipTrigger as-child>
                            <Avatar class="size-6">
                              <AvatarImage :src="t.assignee.avatar || ''" :alt="t.assignee.name" />
                              <AvatarFallback class="text-[10px]">
                                {{ t.assignee.name?.slice(0, 2).toUpperCase() }}
                              </AvatarFallback>
                            </Avatar>
                          </TooltipTrigger>
                          <TooltipContent>{{ t.assignee.name }}</TooltipContent>
                        </Tooltip>
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

            <CardFooter class="px-2 mt-auto shrink-0">
              <Button size="sm" variant="ghost" class="text-muted-foreground w-full justify-start" @click="openNewTask(col.id)">
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
    <DialogContent class="sm:max-w-[520px]">
      <DialogHeader>
        <DialogTitle>{{ showModalTask.type === 'create' ? 'New Task' : 'Edit Task' }}</DialogTitle>
        <DialogDescription class="sr-only">
          {{ showModalTask.type === 'create' ? 'Add a new task to the board' : 'Edit the task' }}
        </DialogDescription>
      </DialogHeader>
      <div class="flex flex-col gap-3">
        <div class="grid items-baseline grid-cols-1 md:grid-cols-4 md:[&>label]:col-span-1 *:col-span-3 gap-3">
          <Label>Title</Label>
          <Input v-model="newTask.title" placeholder="Title" />
          <Label>Description</Label>
          <Textarea v-model="newTask.description" placeholder="Description (optional)" rows="4" />
          <Label>Priority</Label>
          <Select v-model="newTask.priority">
            <SelectTrigger class="w-full">
              <SelectValue placeholder="Select a priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
          <Label>Due Date</Label>
          <div class="flex items-center gap-1">
            <Popover>
              <PopoverTrigger as-child>
                <Button
                  variant="outline"
                  :class="cn(
                    'flex-1 justify-start text-left font-normal px-3',
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
              class="flex-1 bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
            />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="secondary" @click="showModalTask.open = false">
          Cancel
        </Button>
        <Button @click="showModalTask.type === 'create' ? createTask() : editTask()">
          {{ showModalTask.type === 'create' ? 'Create' : 'Update' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script lang="ts">
const PAGE_SIZE = 20
</script>
