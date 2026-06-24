<script setup lang="ts">
import { toast } from 'vue-sonner'

const { setHeader } = usePageHeader()
setHeader({ title: 'TimeSheet', icon: 'i-lucide-clock', description: 'Track employee hours & project time' })

const { user } = useAuth()
const isAdmin = computed(() => ['Super Admin', 'Admin', 'Manager'].includes(user.value?.position || ''))

// ── State ────────────────────────────────────────────────────────────────────
interface TimeEntry {
  _id: string
  employeeId: string
  employeeName: string
  projectId: string | null
  projectName: string
  customerName: string
  clockIn: string
  clockOut: string | null
  duration: number | null
  notes: string
  status: 'active' | 'completed'
  createdAt: string
}

interface PipelineProject {
  _id: string
  name: string
  projectName: string
  customerName: string
}

const entries = ref<TimeEntry[]>([])
const loading = ref(true)
const clockingIn = ref(false)
const clockingOut = ref(false)
const activeEntry = ref<TimeEntry | null>(null)
const projects = ref<PipelineProject[]>([])
const loadingProjects = ref(false)

// Clock-in form
const selectedProjectId = ref('')
const clockInNotes = ref('')
const clockOutNotes = ref('')
const projectSearch = ref('')
const showProjectDropdown = ref(false)

// Filters
const searchQuery = ref('')
const filterStatus = ref('all')
const filterDateFrom = ref('')
const filterDateTo = ref('')

// Pagination
const page = ref(1)
const totalPages = ref(1)
const total = ref(0)
const LIMIT = 25

// Live timer
const elapsedDisplay = ref('00:00:00')
let timerInterval: ReturnType<typeof setInterval> | null = null

// ── Computed ─────────────────────────────────────────────────────────────────
const filteredProjects = computed(() => {
  const q = projectSearch.value.toLowerCase().trim()
  if (!q) return projects.value.slice(0, 20)
  return projects.value.filter(p =>
    (p.projectName || p.name || '').toLowerCase().includes(q)
    || (p.customerName || '').toLowerCase().includes(q),
  ).slice(0, 20)
})

const todayEntries = computed(() => {
  const todayStr = new Date().toISOString().split('T')[0] ?? ''
  return entries.value.filter(e => e.clockIn?.startsWith(todayStr))
})

const todayHours = computed(() => {
  let totalMin = 0
  for (const e of todayEntries.value) {
    if (e.duration) {
      totalMin += e.duration
    }
    else if (e.status === 'active') {
      const ms = Date.now() - new Date(e.clockIn).getTime()
      totalMin += Math.round(ms / 60000)
    }
  }
  const hrs = Math.floor(totalMin / 60)
  const mins = totalMin % 60
  return `${hrs}h ${mins}m`
})

const todayEntriesCount = computed(() => todayEntries.value.length)

// ── Fetch ────────────────────────────────────────────────────────────────────
async function fetchEntries(targetPage = page.value) {
  loading.value = true
  try {
    const params = new URLSearchParams({
      page: String(targetPage),
      limit: String(LIMIT),
    })
    if (searchQuery.value.trim()) params.set('search', searchQuery.value.trim())
    if (filterStatus.value !== 'all') params.set('status', filterStatus.value)
    if (filterDateFrom.value) params.set('dateFrom', filterDateFrom.value)
    if (filterDateTo.value) params.set('dateTo', filterDateTo.value)

    const res = await $fetch<{ success: boolean, data: TimeEntry[], pagination: any }>(`/api/timesheet?${params}`)
    entries.value = res.data || []
    page.value = res.pagination?.page || 1
    totalPages.value = res.pagination?.totalPages || 1
    total.value = res.pagination?.total || 0
  }
  catch (e: any) {
    toast.error('Error', { description: e?.message || 'Failed to load time entries' })
  }
  finally {
    loading.value = false
  }
}

async function fetchActiveEntry() {
  try {
    const res = await $fetch<{ success: boolean, data: TimeEntry | null }>('/api/timesheet/active')
    activeEntry.value = res.data
    if (res.data) startTimer()
  }
  catch { /* silent */ }
}

async function fetchProjects() {
  loadingProjects.value = true
  try {
    const res = await $fetch<{ success: boolean, data: PipelineProject[] }>('/api/pipeline?limit=100')
    projects.value = res.data || []
  }
  catch { /* silent */ }
  finally {
    loadingProjects.value = false
  }
}

// ── Clock Actions ────────────────────────────────────────────────────────────
async function clockIn() {
  clockingIn.value = true
  try {
    const project = projects.value.find(p => p._id === selectedProjectId.value)
    const res = await $fetch<{ success: boolean, data: TimeEntry }>('/api/timesheet', {
      method: 'POST',
      body: {
        projectId: selectedProjectId.value || null,
        projectName: project?.projectName || project?.name || '',
        customerName: project?.customerName || '',
        notes: clockInNotes.value,
      },
    })
    activeEntry.value = res.data
    toast.success('Clocked In!', { description: project?.projectName ? `Working on: ${project.projectName}` : 'Timer started' })
    selectedProjectId.value = ''
    clockInNotes.value = ''
    startTimer()
    fetchEntries(1)
  }
  catch (e: any) {
    toast.error('Clock-in failed', { description: e?.data?.message || e?.message || 'Unknown error' })
  }
  finally {
    clockingIn.value = false
  }
}

async function clockOut() {
  if (!activeEntry.value) return
  clockingOut.value = true
  try {
    const res = await $fetch<{ success: boolean, data: TimeEntry }>(`/api/timesheet/${activeEntry.value._id}`, {
      method: 'PUT',
      body: { notes: clockOutNotes.value || activeEntry.value.notes },
    })
    const dur = res.data.duration || 0
    const hrs = Math.floor(dur / 60)
    const mins = dur % 60
    toast.success('Clocked Out!', { description: `Total time: ${hrs}h ${mins}m` })
    activeEntry.value = null
    clockOutNotes.value = ''
    stopTimer()
    fetchEntries(1)
  }
  catch (e: any) {
    toast.error('Clock-out failed', { description: e?.data?.message || e?.message || 'Unknown error' })
  }
  finally {
    clockingOut.value = false
  }
}

async function deleteEntry(id: string) {
  try {
    await $fetch(`/api/timesheet/${id}`, { method: 'DELETE' })
    toast.success('Deleted', { description: 'Time entry removed' })
    fetchEntries()
  }
  catch (e: any) {
    toast.error('Delete failed', { description: e?.data?.message || e?.message || 'Unknown error' })
  }
}

// ── Timer ────────────────────────────────────────────────────────────────────
function startTimer() {
  stopTimer()
  updateElapsed()
  timerInterval = setInterval(updateElapsed, 1000)
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
  elapsedDisplay.value = '00:00:00'
}

function updateElapsed() {
  if (!activeEntry.value) return
  const ms = Date.now() - new Date(activeEntry.value.clockIn).getTime()
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const h = String(Math.floor(totalSec / 3600)).padStart(2, '0')
  const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0')
  const s = String(totalSec % 60).padStart(2, '0')
  elapsedDisplay.value = `${h}:${m}:${s}`
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTime(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function formatDuration(mins: number | null) {
  if (!mins && mins !== 0) return '—'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function selectProject(p: PipelineProject) {
  selectedProjectId.value = p._id
  projectSearch.value = p.projectName || p.name || ''
  showProjectDropdown.value = false
}

function clearProject() {
  selectedProjectId.value = ''
  projectSearch.value = ''
}

// ── Search debounce ──────────────────────────────────────────────────────────
let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(searchQuery, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => fetchEntries(1), 300)
})

watch([filterStatus, filterDateFrom, filterDateTo], () => fetchEntries(1))

// ── Init ─────────────────────────────────────────────────────────────────────
onMounted(async () => {
  await Promise.all([
    fetchEntries(1),
    fetchActiveEntry(),
    fetchProjects(),
  ])
})

onUnmounted(() => stopTimer())

// Close dropdown on outside click
function onDocClick() {
  showProjectDropdown.value = false
}
onMounted(() => document.addEventListener('click', onDocClick))
onUnmounted(() => document.removeEventListener('click', onDocClick))
</script>

<template>
  <div class="max-w-[1400px] mx-auto space-y-6 pb-12">
    <!-- ═══════════════════════════════════════════════════════════════════════
         CLOCK IN / OUT HERO CARD
         ═══════════════════════════════════════════════════════════════════════ -->
    <div class="bg-card rounded-2xl border shadow-sm overflow-hidden">
      <div class="px-6 py-4 border-b bg-gradient-to-r from-primary/5 via-transparent to-primary/5">
        <div class="flex items-center gap-3">
          <div class="relative">
            <Icon name="i-lucide-clock" class="size-6 text-primary" />
            <span
              v-if="activeEntry"
              class="absolute -top-0.5 -right-0.5 size-2.5 bg-emerald-500 rounded-full animate-ping"
            />
            <span
              v-if="activeEntry"
              class="absolute -top-0.5 -right-0.5 size-2.5 bg-emerald-500 rounded-full"
            />
          </div>
          <div>
            <h2 class="text-lg font-bold text-foreground">
              Time Clock
            </h2>
            <p class="text-xs text-muted-foreground">
              {{ activeEntry ? 'Currently clocked in' : 'Ready to start' }}
            </p>
          </div>
        </div>
      </div>

      <div class="p-6">
        <!-- ── Active Clock (Clocked In State) ──────────────────────────── -->
        <div v-if="activeEntry" class="space-y-5">
          <div class="flex flex-col sm:flex-row items-center gap-6">
            <!-- Live Timer -->
            <div class="flex-1 flex flex-col items-center sm:items-start gap-2">
              <div class="flex items-center gap-3">
                <span class="relative flex size-3">
                  <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span class="relative inline-flex rounded-full size-3 bg-emerald-500" />
                </span>
                <span class="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Live
                </span>
              </div>
              <p class="text-5xl sm:text-6xl font-black tabular-nums tracking-tight text-foreground font-mono">
                {{ elapsedDisplay }}
              </p>
              <div class="flex items-center gap-2 mt-1">
                <span v-if="activeEntry.projectName" class="text-xs font-bold uppercase tracking-wider bg-primary/10 text-primary px-2.5 py-1 rounded-full border border-primary/20">
                  {{ activeEntry.projectName }}
                </span>
                <span v-if="activeEntry.customerName" class="text-xs text-muted-foreground">
                  {{ activeEntry.customerName }}
                </span>
              </div>
              <p class="text-[10px] text-muted-foreground mt-1">
                Clocked in at {{ formatTime(activeEntry.clockIn) }}
              </p>
            </div>

            <!-- Clock Out Controls -->
            <div class="flex flex-col gap-3 w-full sm:w-auto sm:min-w-[280px]">
              <div class="space-y-2">
                <Label class="text-xs text-muted-foreground">Notes (optional)</Label>
                <Textarea
                  v-model="clockOutNotes"
                  placeholder="What did you work on?"
                  class="resize-none h-20 text-sm"
                />
              </div>
              <Button
                :disabled="clockingOut"
                class="w-full bg-red-600 hover:bg-red-700 text-white font-bold text-sm h-12 rounded-xl shadow-lg shadow-red-600/20 transition-all duration-200 hover:shadow-red-600/30 hover:scale-[1.01]"
                @click="clockOut"
              >
                <Icon v-if="clockingOut" name="i-lucide-loader-2" class="size-4 animate-spin mr-2" />
                <Icon v-else name="i-lucide-log-out" class="size-4 mr-2" />
                Clock Out
              </Button>
            </div>
          </div>
        </div>

        <!-- ── Clock In State ───────────────────────────────────────────── -->
        <div v-else class="space-y-5">
          <div class="flex flex-col sm:flex-row gap-4">
            <!-- Project Selector -->
            <div class="flex-1 space-y-2 relative" @click.stop>
              <Label class="text-xs font-semibold text-muted-foreground">Select Project</Label>
              <div class="relative">
                <Input
                  v-model="projectSearch"
                  placeholder="Search projects..."
                  class="pr-8"
                  @focus="showProjectDropdown = true"
                  @input="showProjectDropdown = true"
                />
                <button
                  v-if="selectedProjectId"
                  class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  @click.stop="clearProject"
                >
                  <Icon name="i-lucide-x" class="size-3.5" />
                </button>
              </div>
              <!-- Dropdown -->
              <div
                v-if="showProjectDropdown"
                class="absolute z-50 mt-1 w-full bg-popover border rounded-xl shadow-xl max-h-[250px] overflow-y-auto"
              >
                <div v-if="loadingProjects" class="p-4 text-center text-xs text-muted-foreground">
                  Loading projects...
                </div>
                <div v-else-if="filteredProjects.length === 0" class="p-4 text-center text-xs text-muted-foreground">
                  No projects found
                </div>
                <button
                  v-for="p in filteredProjects"
                  :key="p._id"
                  class="w-full text-left px-4 py-2.5 hover:bg-muted/50 transition-colors border-b border-border/30 last:border-0 flex flex-col gap-0.5"
                  :class="selectedProjectId === p._id ? 'bg-primary/5' : ''"
                  @click.stop="selectProject(p)"
                >
                  <span class="text-sm font-semibold text-foreground">{{ p.projectName || p.name || 'Untitled' }}</span>
                  <span v-if="p.customerName" class="text-[10px] text-muted-foreground uppercase tracking-wider">{{ p.customerName }}</span>
                </button>
              </div>
            </div>

            <!-- Notes -->
            <div class="flex-1 space-y-2">
              <Label class="text-xs font-semibold text-muted-foreground">Notes (optional)</Label>
              <Input v-model="clockInNotes" placeholder="e.g. Starting sanding phase" />
            </div>
          </div>

          <Button
            :disabled="clockingIn"
            class="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm h-12 px-10 rounded-xl shadow-lg shadow-emerald-600/20 transition-all duration-200 hover:shadow-emerald-600/30 hover:scale-[1.01]"
            @click="clockIn"
          >
            <Icon v-if="clockingIn" name="i-lucide-loader-2" class="size-4 animate-spin mr-2" />
            <Icon v-else name="i-lucide-play" class="size-4 mr-2" />
            Clock In
          </Button>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════════
         TODAY'S SUMMARY STRIP
         ═══════════════════════════════════════════════════════════════════════ -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <div class="bg-card rounded-xl border p-4 flex items-center gap-3">
        <div class="size-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon name="i-lucide-timer" class="size-5 text-primary" />
        </div>
        <div>
          <p class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            Today
          </p>
          <p class="text-lg font-black tabular-nums text-foreground">
            {{ todayHours }}
          </p>
        </div>
      </div>
      <div class="bg-card rounded-xl border p-4 flex items-center gap-3">
        <div class="size-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
          <Icon name="i-lucide-hash" class="size-5 text-blue-500" />
        </div>
        <div>
          <p class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            Entries
          </p>
          <p class="text-lg font-black tabular-nums text-foreground">
            {{ todayEntriesCount }}
          </p>
        </div>
      </div>
      <div class="bg-card rounded-xl border p-4 flex items-center gap-3">
        <div class="size-10 rounded-lg flex items-center justify-center shrink-0" :class="activeEntry ? 'bg-emerald-500/10' : 'bg-muted'">
          <Icon :name="activeEntry ? 'i-lucide-circle-check' : 'i-lucide-circle-pause'" class="size-5" :class="activeEntry ? 'text-emerald-500' : 'text-muted-foreground'" />
        </div>
        <div>
          <p class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            Status
          </p>
          <p class="text-sm font-bold" :class="activeEntry ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'">
            {{ activeEntry ? 'Clocked In' : 'Off Clock' }}
          </p>
        </div>
      </div>
      <div class="bg-card rounded-xl border p-4 flex items-center gap-3">
        <div class="size-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
          <Icon name="i-lucide-list" class="size-5 text-amber-500" />
        </div>
        <div>
          <p class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            Total Records
          </p>
          <p class="text-lg font-black tabular-nums text-foreground">
            {{ total }}
          </p>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════════
         TIME ENTRIES TABLE
         ═══════════════════════════════════════════════════════════════════════ -->
    <div class="bg-card rounded-2xl border shadow-sm overflow-hidden">
      <div class="px-6 py-4 border-b bg-muted/30 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div class="flex items-center gap-2 shrink-0">
          <Icon name="i-lucide-table-2" class="size-4 text-primary" />
          <h3 class="text-sm font-bold text-foreground">
            Time Entries
          </h3>
        </div>

        <div class="flex flex-wrap items-center gap-2 ml-auto w-full sm:w-auto">
          <!-- Search -->
          <div class="relative flex-1 sm:flex-initial sm:min-w-[200px]">
            <Icon name="i-lucide-search" class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input v-model="searchQuery" placeholder="Search..." class="pl-8 h-8 text-xs" />
          </div>
          <!-- Status filter -->
          <select
            v-model="filterStatus"
            class="h-8 px-2.5 rounded-md border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>
          <!-- Date range -->
          <Input v-model="filterDateFrom" type="date" class="h-8 text-xs w-[130px]" />
          <span class="text-xs text-muted-foreground">to</span>
          <Input v-model="filterDateTo" type="date" class="h-8 text-xs w-[130px]" />
        </div>
      </div>

      <!-- Table -->
      <div class="overflow-x-auto">
        <table class="w-full text-xs">
          <thead>
            <tr class="border-b bg-muted/20 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              <th class="p-3 text-left">Employee</th>
              <th class="p-3 text-left">Project</th>
              <th class="p-3 text-left">Clock In</th>
              <th class="p-3 text-left">Clock Out</th>
              <th class="p-3 text-left">Duration</th>
              <th class="p-3 text-left">Notes</th>
              <th class="p-3 text-left">Status</th>
              <th v-if="isAdmin" class="p-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading" class="border-b">
              <td :colspan="isAdmin ? 8 : 7" class="p-8 text-center">
                <div class="flex items-center justify-center gap-2 text-muted-foreground">
                  <Icon name="i-lucide-loader-2" class="size-4 animate-spin" />
                  Loading...
                </div>
              </td>
            </tr>
            <tr v-else-if="entries.length === 0" class="border-b">
              <td :colspan="isAdmin ? 8 : 7" class="p-8 text-center">
                <div class="flex flex-col items-center gap-2 text-muted-foreground">
                  <Icon name="i-lucide-clock" class="size-8 opacity-30" />
                  <p class="text-sm font-medium">No time entries found</p>
                  <p class="text-xs">Clock in to start tracking your time</p>
                </div>
              </td>
            </tr>
            <tr
              v-for="entry in entries"
              :key="entry._id"
              class="border-b hover:bg-muted/30 transition-colors"
              :class="entry.status === 'active' ? 'bg-emerald-500/5' : ''"
            >
              <td class="p-3">
                <span class="font-semibold text-foreground">{{ entry.employeeName }}</span>
              </td>
              <td class="p-3">
                <div class="flex flex-col gap-0.5">
                  <span class="font-semibold text-foreground">{{ entry.projectName || '—' }}</span>
                  <span v-if="entry.customerName" class="text-[10px] text-muted-foreground">{{ entry.customerName }}</span>
                </div>
              </td>
              <td class="p-3 tabular-nums">
                <div class="flex flex-col gap-0.5">
                  <span class="font-semibold">{{ formatTime(entry.clockIn) }}</span>
                  <span class="text-[10px] text-muted-foreground">{{ formatDate(entry.clockIn) }}</span>
                </div>
              </td>
              <td class="p-3 tabular-nums">
                <span v-if="entry.clockOut" class="font-semibold">{{ formatTime(entry.clockOut) }}</span>
                <span v-else class="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                  <span class="relative flex size-1.5">
                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span class="relative inline-flex rounded-full size-1.5 bg-emerald-500" />
                  </span>
                  Running
                </span>
              </td>
              <td class="p-3 tabular-nums font-bold">
                {{ entry.duration ? formatDuration(entry.duration) : '—' }}
              </td>
              <td class="p-3 max-w-[200px]">
                <span class="text-muted-foreground truncate block" :title="entry.notes">{{ entry.notes || '—' }}</span>
              </td>
              <td class="p-3">
                <span
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                  :class="entry.status === 'active'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    : 'bg-muted text-muted-foreground border border-border/50'"
                >
                  <span
                    class="size-1.5 rounded-full"
                    :class="entry.status === 'active' ? 'bg-emerald-500' : 'bg-muted-foreground/50'"
                  />
                  {{ entry.status }}
                </span>
              </td>
              <td v-if="isAdmin" class="p-3">
                <Button
                  variant="ghost"
                  size="icon"
                  class="size-7 text-destructive hover:bg-destructive/10"
                  @click="deleteEntry(entry._id)"
                >
                  <Icon name="i-lucide-trash-2" class="size-3.5" />
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="px-6 py-3 border-t bg-muted/20 flex items-center justify-between">
        <p class="text-xs text-muted-foreground">
          Page {{ page }} of {{ totalPages }} · {{ total }} entries
        </p>
        <div class="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            :disabled="page <= 1"
            class="h-7 text-xs"
            @click="fetchEntries(page - 1)"
          >
            <Icon name="i-lucide-chevron-left" class="size-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            :disabled="page >= totalPages"
            class="h-7 text-xs"
            @click="fetchEntries(page + 1)"
          >
            <Icon name="i-lucide-chevron-right" class="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
