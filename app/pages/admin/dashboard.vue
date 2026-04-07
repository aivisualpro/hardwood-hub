<script setup lang="ts">
import NumberFlow from '@number-flow/vue'
import { toast } from 'vue-sonner'

const { setHeader } = usePageHeader()
setHeader({ title: 'Dashboard', icon: 'i-lucide-layout-dashboard', description: 'Overview of your workspace' })

// ─── State ───────────────────────────────────────────────
interface DashboardStats {
  employees: {
    total: number; active: number; inactive: number
    list: { _id: string; name: string; status: string; position: string; image: string }[]
  }
  tasks: { total: number; byStatus: Record<string, number> }
  skills: { total: number; categories: number; subCategories: number }
  production: {
    total: number
    trend: { date: string; sqft: number; hours: number; entries: number }[]
    topProducers: { name: string; sqft: number; hours: number; entries: number; onTimeRate: number }[]
  }
  communications: { total: number }
  contracts: { total: number; byStatus: Record<string, number> }
  crm: { total: number; byType: Record<string, number>; byStatus: Record<string, number> }
  stainSignOffs: { total: number; signed: number }
  performance: {
    total: number; byLevel: Record<string, number>
    trend: { date: string; reviews: number }[]
  }
  activity: { _id: string; user: string; action: string; module: string; description: string; targetName: string; userImage: string; createdAt: string }[]
  recent: {
    production: { _id: string; employeeName: string; date: string; block1Category: string; squareFeetCompleted: number; productionHours: number }[]
    tasks: { _id: string; title: string; status: string; priority: string; assigneeName: string; assigneeAvatar: string; createdAt: string }[]
    employees: { _id: string; employee: string; position: string; profileImage: string; status: string; createdAt: string }[]
  }
}

const stats = ref<DashboardStats | null>(null)
const loading = ref(true)

// Animated counters
const counters = ref({
  employees: 0, activeEmployees: 0, tasks: 0, skills: 0, categories: 0,
  production: 0, communications: 0, contracts: 0, crm: 0, perfReviews: 0,
})

async function fetchStats() {
  loading.value = true
  try {
    const res = await $fetch<{ success: boolean; data: DashboardStats }>('/api/dashboard/stats')
    stats.value = res.data
    await nextTick()
    counters.value = {
      employees: res.data.employees.total,
      activeEmployees: res.data.employees.active,
      tasks: res.data.tasks.total,
      skills: res.data.skills.total,
      categories: res.data.skills.categories,
      production: res.data.production.total,
      communications: res.data.communications.total,
      contracts: res.data.contracts.total,
      crm: res.data.crm.total,
      perfReviews: res.data.performance.total,
    }
  }
  catch (e: any) {
    toast.error('Failed to load dashboard', { description: e?.message })
  }
  finally { loading.value = false }
}

onMounted(fetchStats)

// ─── Helpers ──────────────────────────────────────────────
function statusColor(status: string) {
  const s = status.toLowerCase()
  if (s === 'done' || s === 'completed' || s === 'signed') return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
  if (s === 'in progress' || s === 'in_progress' || s === 'in-progress' || s === 'rolling' || s === 'pending' || s === 'sent') return 'bg-blue-500/15 text-blue-400 border-blue-500/30'
  if (s === 'in-review' || s === 'in review') return 'bg-violet-500/15 text-violet-400 border-violet-500/30'
  if (s === 'todo' || s === 'to do' || s === 'draft') return 'bg-amber-500/15 text-amber-400 border-amber-500/30'
  if (s === 'cancelled') return 'bg-red-500/15 text-red-400 border-red-500/30'
  return 'bg-muted text-muted-foreground border-border/40'
}

function priorityIcon(p: string) {
  if (p === 'high' || p === 'urgent') return 'i-lucide-alert-triangle'
  if (p === 'medium') return 'i-lucide-minus'
  return 'i-lucide-arrow-down'
}

function priorityColor(p: string) {
  if (p === 'high' || p === 'urgent') return 'text-red-400'
  if (p === 'medium') return 'text-amber-400'
  return 'text-blue-400'
}

function timeAgo(dateStr: string) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return d.toLocaleDateString()
}

function fmtDate(d: string) {
  if (!d) return ''
  const dt = new Date(d)
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const taskStatusEntries = computed(() => {
  if (!stats.value) return []
  return Object.entries(stats.value.tasks.byStatus).sort((a, b) => b[1] - a[1])
})

const contractStatusEntries = computed(() => {
  if (!stats.value) return []
  return Object.entries(stats.value.contracts.byStatus).sort((a, b) => b[1] - a[1])
})

const crmTypeEntries = computed(() => {
  if (!stats.value) return []
  return Object.entries(stats.value.crm.byType).sort((a, b) => b[1] - a[1])
})

// Perf level data
const perfLevelColors: Record<string, string> = {
  Mastered: 'bg-emerald-500',
  Proficient: 'bg-blue-500',
  'Needs Improvement': 'bg-amber-500',
}

// Action color mapping
function actionColor(action: string) {
  if (action === 'create') return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
  if (action === 'update') return 'bg-blue-500/15 text-blue-400 border-blue-500/30'
  if (action === 'delete') return 'bg-red-500/15 text-red-400 border-red-500/30'
  if (action === 'login') return 'bg-violet-500/15 text-violet-400 border-violet-500/30'
  return 'bg-muted text-muted-foreground border-border/40'
}

function actionIcon(action: string) {
  if (action === 'create') return 'i-lucide-plus'
  if (action === 'update') return 'i-lucide-pencil'
  if (action === 'delete') return 'i-lucide-trash-2'
  if (action === 'login') return 'i-lucide-log-in'
  if (action === 'logout') return 'i-lucide-log-out'
  return 'i-lucide-activity'
}

// Production chart — compute max for bar heights
const maxSqft = computed(() => {
  if (!stats.value?.production.trend.length) return 1
  return Math.max(...stats.value.production.trend.map(d => d.sqft), 1)
})

// Performance review trend chart max
const maxReviews = computed(() => {
  if (!stats.value?.performance.trend.length) return 1
  return Math.max(...stats.value.performance.trend.map(d => d.reviews), 1)
})

// KPI Gauges
const kpiGauges = computed(() => {
  if (!stats.value) return []
  const s = stats.value
  const activeRate = s.employees.total ? Math.round((s.employees.active / s.employees.total) * 100) : 0
  const signRate = s.stainSignOffs.total ? Math.round((s.stainSignOffs.signed / s.stainSignOffs.total) * 100) : 0
  const taskDone = (s.tasks.byStatus.done || 0) + (s.tasks.byStatus.Done || 0) + (s.tasks.byStatus.completed || 0) + (s.tasks.byStatus.Completed || 0)
  const taskRate = s.tasks.total ? Math.round((taskDone / s.tasks.total) * 100) : 0
  const perfMastered = s.performance.byLevel.Mastered || 0
  const perfProficient = s.performance.byLevel.Proficient || 0
  const proficiencyRate = s.performance.total ? Math.round(((perfMastered + perfProficient) / s.performance.total) * 100) : 0

  return [
    { label: 'Employee Active Rate', value: `${activeRate}%`, percent: activeRate, color: activeRate >= 80 ? 'bg-emerald-500' : 'bg-amber-500' },
    { label: 'Task Completion', value: `${taskRate}%`, percent: taskRate, color: taskRate >= 60 ? 'bg-emerald-500' : 'bg-amber-500' },
    { label: 'Skill Proficiency', value: `${proficiencyRate}%`, percent: proficiencyRate, color: proficiencyRate >= 70 ? 'bg-emerald-500' : 'bg-amber-500' },
    { label: 'Sign-Off Rate', value: `${signRate}%`, percent: signRate, color: signRate >= 80 ? 'bg-emerald-500' : 'bg-amber-500' },
  ]
})

// Metric cards
const metricCards = computed(() => [
  {
    label: 'Employees',
    value: counters.value.employees,
    sub: `${counters.value.activeEmployees} active`,
    icon: 'i-lucide-users',
    gradient: 'from-violet-500/20 to-purple-500/5',
    borderColor: 'border-violet-500/20',
    iconColor: 'text-violet-400',
    link: '/hr/employees',
  },
  {
    label: 'Tasks',
    value: counters.value.tasks,
    sub: `${stats.value?.tasks.byStatus?.['in-progress'] || 0} in progress`,
    icon: 'i-lucide-check-square',
    gradient: 'from-blue-500/20 to-sky-500/5',
    borderColor: 'border-blue-500/20',
    iconColor: 'text-blue-400',
    link: '/tasks',
  },
  {
    label: 'Skills',
    value: counters.value.skills,
    sub: `${counters.value.categories} categories`,
    icon: 'i-lucide-graduation-cap',
    gradient: 'from-emerald-500/20 to-green-500/5',
    borderColor: 'border-emerald-500/20',
    iconColor: 'text-emerald-400',
    link: '/admin/skills',
  },
  {
    label: 'Production',
    value: counters.value.production,
    sub: 'daily entries',
    icon: 'i-lucide-clipboard-list',
    gradient: 'from-amber-500/20 to-orange-500/5',
    borderColor: 'border-amber-500/20',
    iconColor: 'text-amber-400',
    link: '/daily-production',
  },
  {
    label: 'Contracts',
    value: counters.value.contracts,
    sub: `${stats.value?.contracts.byStatus?.signed || 0} signed`,
    icon: 'i-lucide-file-signature',
    gradient: 'from-cyan-500/20 to-teal-500/5',
    borderColor: 'border-cyan-500/20',
    iconColor: 'text-cyan-400',
    link: '/contracts',
  },
  {
    label: 'CRM Leads',
    value: counters.value.crm,
    sub: `${stats.value?.crm.byStatus?.new || 0} new`,
    icon: 'i-lucide-contact',
    gradient: 'from-rose-500/20 to-pink-500/5',
    borderColor: 'border-rose-500/20',
    iconColor: 'text-rose-400',
    link: '/crm',
  },
])
</script>

<template>
  <div class="h-[calc(100vh-theme(spacing.16))] overflow-y-auto">
    <div class="w-full flex flex-col gap-4 sm:gap-6 p-3 sm:p-6 max-w-[100rem] mx-auto">

      <!-- ══════ Loading Skeleton ══════ -->
      <template v-if="loading">
        <div class="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
          <div v-for="i in 6" :key="i" class="h-28 sm:h-32 rounded-xl border bg-card animate-pulse" />
        </div>
        <div class="grid grid-cols-1 xl:grid-cols-12 gap-3 sm:gap-4">
          <div class="xl:col-span-8 h-72 rounded-xl border bg-card animate-pulse" />
          <div class="xl:col-span-4 h-72 rounded-xl border bg-card animate-pulse" />
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
          <div v-for="i in 3" :key="i" class="h-56 rounded-xl border bg-card animate-pulse" />
        </div>
      </template>

      <template v-else-if="stats">
        <!-- ══════ METRIC CARDS ══════ -->
        <div class="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
          <NuxtLink
            v-for="(card, idx) in metricCards"
            :key="card.label"
            :to="card.link"
            class="group relative rounded-xl border bg-card p-3.5 sm:p-5 flex flex-col gap-2 sm:gap-3 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer overflow-hidden"
            :class="card.borderColor"
          >
            <div
              class="absolute inset-0 rounded-xl bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
              :class="card.gradient"
            />
            <div class="relative flex items-center justify-between">
              <div
                class="size-8 sm:size-10 rounded-lg bg-gradient-to-br flex items-center justify-center border"
                :class="[card.gradient, card.borderColor]"
              >
                <Icon :name="card.icon" class="size-4 sm:size-5" :class="card.iconColor" />
              </div>
              <Icon name="i-lucide-arrow-up-right" class="size-3.5 text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-all" />
            </div>
            <div class="relative">
              <p class="text-xl sm:text-2xl font-bold tabular-nums">
                <NumberFlow :value="card.value" />
              </p>
              <p class="text-[10px] sm:text-xs text-muted-foreground font-medium mt-0.5">{{ card.label }}</p>
            </div>
            <span class="relative text-[9px] sm:text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wider">{{ card.sub }}</span>
          </NuxtLink>
        </div>

        <!-- ══════ ROW 1: Production Chart + Team Health Grid ══════ -->
        <div class="grid grid-cols-1 xl:grid-cols-12 gap-3 sm:gap-4">

          <!-- Production Trend (Area Chart) -->
          <div class="xl:col-span-8 rounded-xl border border-border/50 bg-card shadow-xs overflow-hidden">
            <div class="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-border/50">
              <div class="flex items-center gap-2.5">
                <div class="size-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <Icon name="i-lucide-trending-up" class="size-4 text-amber-400" />
                </div>
                <div>
                  <h3 class="text-sm font-semibold">Production Output</h3>
                  <p class="text-[10px] text-muted-foreground">Square feet completed — last 30 days</p>
                </div>
              </div>
              <NuxtLink to="/daily-production" class="text-[10px] sm:text-xs text-primary hover:underline font-medium">View all →</NuxtLink>
            </div>

            <div class="p-4 sm:p-5">
              <div v-if="stats.production.trend.length === 0" class="flex items-center justify-center py-16 text-sm text-muted-foreground">
                <Icon name="i-lucide-bar-chart-3" class="mr-2 size-5 opacity-40" />
                No production data in last 30 days
              </div>
              <div v-else>
                <!-- Simple SVG area chart -->
                <div class="relative h-48 sm:h-56">
                  <!-- Horizontal grid lines -->
                  <div class="absolute inset-0 flex flex-col justify-between pointer-events-none">
                    <div v-for="i in 5" :key="i" class="border-b border-border/20 w-full" />
                  </div>

                  <!-- Bars -->
                  <div class="relative flex items-end gap-[2px] sm:gap-1 h-full">
                    <div
                      v-for="(d, i) in stats.production.trend"
                      :key="d.date"
                      class="flex-1 group/col flex items-end relative"
                    >
                      <div
                        class="w-full rounded-t-sm transition-all duration-500 bg-gradient-to-t from-amber-500 to-amber-400 group-hover/col:from-amber-400 group-hover/col:to-amber-300 cursor-default relative"
                        :style="{ height: `${Math.max(4, (d.sqft / maxSqft) * 100)}%`, transitionDelay: `${i * 20}ms` }"
                      >
                        <!-- Tooltip -->
                        <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 rounded-lg bg-popover border border-border shadow-xl text-[10px] whitespace-nowrap opacity-0 group-hover/col:opacity-100 transition-opacity pointer-events-none z-20">
                          <p class="font-semibold">{{ fmtDate(d.date) }}</p>
                          <p class="text-amber-400 font-bold">{{ d.sqft.toLocaleString() }} sqft</p>
                          <p class="text-muted-foreground">{{ d.hours }}h · {{ d.entries }} entries</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <!-- X axis labels -->
                <div class="flex justify-between mt-2 text-[9px] text-muted-foreground/50 tabular-nums">
                  <span>{{ fmtDate(stats.production.trend[0]?.date || '') }}</span>
                  <span v-if="stats.production.trend.length > 2">{{ fmtDate(stats.production.trend[Math.floor(stats.production.trend.length / 2)]?.date || '') }}</span>
                  <span>{{ fmtDate(stats.production.trend[stats.production.trend.length - 1]?.date || '') }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Team Health Grid (Signal-style tiles) -->
          <div class="xl:col-span-4 rounded-xl border border-border/50 bg-card shadow-xs overflow-hidden">
            <div class="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-border/50">
              <div class="flex items-center gap-2.5">
                <div class="size-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                  <Icon name="i-lucide-heart-pulse" class="size-4 text-violet-400" />
                </div>
                <div>
                  <h3 class="text-sm font-semibold">Team Health</h3>
                  <p class="text-[10px] text-muted-foreground">{{ stats.employees.total }} team members</p>
                </div>
              </div>
              <NuxtLink to="/hr/employees" class="text-[10px] sm:text-xs text-primary hover:underline font-medium">View all →</NuxtLink>
            </div>

            <div class="p-4 sm:p-5">
              <!-- Signal-style block grid -->
              <div class="grid grid-cols-8 gap-1.5">
                <div
                  v-for="emp in stats.employees.list"
                  :key="emp._id"
                  class="relative group/tile"
                >
                  <div
                    class="h-6 w-full rounded-sm cursor-default transition-transform hover:scale-110"
                    :class="emp.status === 'Active' ? 'bg-emerald-500' : 'bg-zinc-600'"
                  />
                  <!-- Tooltip -->
                  <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-md bg-popover border border-border shadow-lg text-[10px] whitespace-nowrap opacity-0 group-hover/tile:opacity-100 transition-opacity pointer-events-none z-20">
                    <p class="font-semibold">{{ emp.name }}</p>
                    <p class="text-muted-foreground">{{ emp.position || 'No position' }}</p>
                  </div>
                </div>
              </div>
              <!-- Legend -->
              <div class="mt-4 flex items-center gap-4 text-[10px] text-muted-foreground">
                <span class="flex items-center gap-1.5">
                  <span class="size-2.5 rounded-full bg-emerald-500" />
                  {{ stats.employees.active }} Active
                </span>
                <span class="flex items-center gap-1.5">
                  <span class="size-2.5 rounded-full bg-zinc-600" />
                  {{ stats.employees.inactive }} Inactive
                </span>
              </div>
            </div>

            <!-- KPI Gauges -->
            <div class="border-t border-border/50 p-4 sm:p-5 space-y-3.5">
              <div
                v-for="kpi in kpiGauges"
                :key="kpi.label"
                class="space-y-1"
              >
                <div class="flex items-center justify-between">
                  <span class="text-[11px] font-medium text-muted-foreground">{{ kpi.label }}</span>
                  <span class="text-[11px] font-mono font-bold tabular-nums">{{ kpi.value }}</span>
                </div>
                <div class="h-1.5 w-full rounded-full bg-muted/50 overflow-hidden">
                  <div
                    class="h-full rounded-full transition-all duration-1000 ease-out"
                    :class="kpi.color"
                    :style="{ width: `${Math.min(kpi.percent, 100)}%` }"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ══════ ROW 2: Tasks + Task Status + Perf Reviews ══════ -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4">

          <!-- Recent Tasks -->
          <div class="lg:col-span-5 rounded-xl border border-border/50 bg-card shadow-xs overflow-hidden">
            <div class="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-border/50">
              <div class="flex items-center gap-2.5">
                <div class="size-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <Icon name="i-lucide-check-square" class="size-4 text-blue-400" />
                </div>
                <div>
                  <h3 class="text-sm font-semibold">Recent Tasks</h3>
                  <p class="text-[10px] text-muted-foreground">Latest activity</p>
                </div>
              </div>
              <NuxtLink to="/tasks" class="text-[10px] sm:text-xs text-primary hover:underline font-medium">View all →</NuxtLink>
            </div>

            <div v-if="stats.recent.tasks.length === 0" class="flex flex-col items-center justify-center py-12 gap-2">
              <Icon name="i-lucide-inbox" class="size-8 text-muted-foreground/40" />
              <p class="text-xs text-muted-foreground">No tasks yet</p>
            </div>

            <div v-else class="divide-y divide-border/30">
              <div
                v-for="task in stats.recent.tasks"
                :key="task._id"
                class="flex items-center gap-2.5 px-4 sm:px-5 py-2.5 sm:py-3 hover:bg-muted/20 transition-colors"
              >
                <Icon :name="priorityIcon(task.priority)" class="size-3.5 shrink-0" :class="priorityColor(task.priority)" />
                <div class="flex-1 min-w-0">
                  <p class="text-xs sm:text-sm font-medium truncate">{{ task.title }}</p>
                  <p v-if="task.assigneeName" class="text-[9px] text-muted-foreground truncate">{{ task.assigneeName }}</p>
                </div>
                <span
                  class="inline-flex items-center text-[9px] font-semibold px-1.5 py-0.5 rounded-full border shrink-0"
                  :class="statusColor(task.status)"
                >
                  {{ task.status }}
                </span>
                <span class="text-[9px] text-muted-foreground/60 shrink-0 w-12 text-right hidden sm:inline tabular-nums">{{ timeAgo(task.createdAt) }}</span>
              </div>
            </div>
          </div>

          <!-- Tasks by Status — Donut-style -->
          <div class="lg:col-span-3 rounded-xl border border-border/50 bg-card shadow-xs overflow-hidden">
            <div class="flex items-center gap-2 px-4 sm:px-5 py-3 sm:py-4 border-b border-border/50">
              <div class="size-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                <Icon name="i-lucide-pie-chart" class="size-4 text-violet-400" />
              </div>
              <div>
                <h3 class="text-sm font-semibold">Tasks by Status</h3>
                <p class="text-[10px] text-muted-foreground">Distribution</p>
              </div>
            </div>

            <div v-if="taskStatusEntries.length === 0" class="flex flex-col items-center justify-center py-12 gap-2">
              <Icon name="i-lucide-bar-chart-3" class="size-8 text-muted-foreground/40" />
              <p class="text-xs text-muted-foreground">No data</p>
            </div>

            <div v-else class="p-4 sm:p-5 flex flex-col gap-3">
              <div
                v-for="[status, count] in taskStatusEntries"
                :key="status"
                class="flex items-center gap-2.5"
              >
                <span
                  class="inline-flex items-center text-[9px] font-semibold px-1.5 py-0.5 rounded-full border w-[84px] justify-center shrink-0"
                  :class="statusColor(status)"
                >
                  {{ status }}
                </span>
                <div class="flex-1 h-2 rounded-full bg-muted/40 overflow-hidden">
                  <div
                    class="h-full rounded-full transition-all duration-700 ease-out"
                    :class="status.toLowerCase().includes('done') || status.toLowerCase().includes('completed')
                      ? 'bg-emerald-500/60'
                      : status.toLowerCase().includes('progress')
                        ? 'bg-blue-500/60'
                        : status.toLowerCase().includes('review')
                          ? 'bg-violet-500/60'
                          : status.toLowerCase().includes('todo')
                            ? 'bg-amber-500/60'
                            : 'bg-muted-foreground/30'"
                    :style="{ width: `${stats ? Math.max(8, (count / stats.tasks.total) * 100) : 0}%` }"
                  />
                </div>
                <span class="text-xs font-bold tabular-nums w-7 text-right">{{ count }}</span>
              </div>
            </div>
          </div>

          <!-- Skill Reviews Trend -->
          <div class="lg:col-span-4 rounded-xl border border-border/50 bg-card shadow-xs overflow-hidden">
            <div class="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-border/50">
              <div class="flex items-center gap-2.5">
                <div class="size-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <Icon name="i-lucide-star" class="size-4 text-emerald-400" />
                </div>
                <div>
                  <h3 class="text-sm font-semibold">Skill Reviews</h3>
                  <p class="text-[10px] text-muted-foreground">{{ stats.performance.total.toLocaleString() }} total reviews</p>
                </div>
              </div>
              <NuxtLink to="/hr/employees-bonus-report" class="text-[10px] sm:text-xs text-primary hover:underline font-medium">Bonus Report →</NuxtLink>
            </div>

            <div class="p-4 sm:p-5">
              <!-- Skill Level Breakdown -->
              <div class="flex items-center gap-3 mb-4">
                <template v-for="(count, level) in stats.performance.byLevel" :key="level">
                  <div class="flex items-center gap-1.5 text-[10px]">
                    <span class="size-2.5 rounded-full" :class="perfLevelColors[level] || 'bg-muted'" />
                    <span class="font-semibold tabular-nums">{{ count }}</span>
                    <span class="text-muted-foreground hidden sm:inline">{{ level }}</span>
                  </div>
                </template>
              </div>

              <!-- Mini bar chart for reviews per day (last 30 days) -->
              <div v-if="stats.performance.trend.length" class="relative h-24">
                <div class="flex items-end gap-[1px] sm:gap-[2px] h-full">
                  <div
                    v-for="(d, i) in stats.performance.trend"
                    :key="d.date"
                    class="flex-1 group/revbar flex items-end relative"
                  >
                    <div
                      class="w-full rounded-t-sm transition-all duration-500 bg-gradient-to-t from-emerald-500 to-emerald-400 group-hover/revbar:from-emerald-400 group-hover/revbar:to-emerald-300 cursor-default relative"
                      :style="{ height: `${Math.max(4, (d.reviews / maxReviews) * 100)}%`, transitionDelay: `${i * 15}ms` }"
                    >
                      <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-md bg-popover border border-border shadow-lg text-[10px] whitespace-nowrap opacity-0 group-hover/revbar:opacity-100 transition-opacity pointer-events-none z-20">
                        <p class="font-semibold">{{ fmtDate(d.date) }}</p>
                        <p class="text-emerald-400">{{ d.reviews }} reviews</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div v-else class="flex items-center justify-center h-24 text-xs text-muted-foreground/50">
                No review trend data
              </div>
            </div>
          </div>
        </div>

        <!-- ══════ ROW 3: Top Producers + CRM Pipeline + Activity Timeline ══════ -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">

          <!-- Top Producers (Leaderboard) -->
          <div class="rounded-xl border border-border/50 bg-card shadow-xs overflow-hidden">
            <div class="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-border/50">
              <div class="flex items-center gap-2.5">
                <div class="size-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <Icon name="i-lucide-trophy" class="size-4 text-amber-400" />
                </div>
                <div>
                  <h3 class="text-sm font-semibold">Top Producers</h3>
                  <p class="text-[10px] text-muted-foreground">Last 30 days by sqft</p>
                </div>
              </div>
            </div>

            <div v-if="stats.production.topProducers.length === 0" class="flex flex-col items-center justify-center py-12 gap-2">
              <Icon name="i-lucide-award" class="size-8 text-muted-foreground/40" />
              <p class="text-xs text-muted-foreground">No production data</p>
            </div>

            <div v-else class="divide-y divide-border/30">
              <div
                v-for="(p, idx) in stats.production.topProducers"
                :key="p.name"
                class="flex items-center gap-3 px-4 sm:px-5 py-2.5 hover:bg-muted/20 transition-colors"
              >
                <!-- Rank badge -->
                <div
                  class="size-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0"
                  :class="idx === 0 ? 'bg-amber-500/20 text-amber-400' : idx === 1 ? 'bg-zinc-400/20 text-zinc-400' : idx === 2 ? 'bg-orange-600/20 text-orange-500' : 'bg-muted text-muted-foreground'"
                >
                  {{ idx + 1 }}
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-xs font-semibold truncate">{{ p.name }}</p>
                  <p class="text-[9px] text-muted-foreground tabular-nums">{{ p.entries }} entries · {{ p.hours }}h</p>
                </div>
                <div class="text-right shrink-0">
                  <p class="text-xs font-bold text-amber-400 tabular-nums">{{ p.sqft.toLocaleString() }}</p>
                  <p class="text-[9px] text-muted-foreground">sqft</p>
                </div>
                <!-- On-time rate mini gauge -->
                <div class="w-8 h-8 shrink-0 relative flex items-center justify-center">
                  <svg class="size-8 -rotate-90" viewBox="0 0 32 32">
                    <circle cx="16" cy="16" r="12" fill="none" stroke="currentColor" class="text-muted/50" stroke-width="3" />
                    <circle
                      cx="16" cy="16" r="12" fill="none"
                      :stroke="p.onTimeRate >= 80 ? '#10b981' : p.onTimeRate >= 50 ? '#f59e0b' : '#ef4444'"
                      stroke-width="3"
                      stroke-linecap="round"
                      :stroke-dasharray="`${(p.onTimeRate / 100) * 75.4} 75.4`"
                    />
                  </svg>
                  <span class="absolute text-[7px] font-bold tabular-nums">{{ p.onTimeRate }}%</span>
                </div>
              </div>
            </div>
          </div>

          <!-- CRM Pipeline + Contract Status -->
          <div class="rounded-xl border border-border/50 bg-card shadow-xs overflow-hidden">
            <div class="flex items-center gap-2 px-4 sm:px-5 py-3 sm:py-4 border-b border-border/50">
              <div class="size-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                <Icon name="i-lucide-git-branch" class="size-4 text-rose-400" />
              </div>
              <div>
                <h3 class="text-sm font-semibold">Pipeline & Contracts</h3>
                <p class="text-[10px] text-muted-foreground">CRM leads by type · Contract status</p>
              </div>
            </div>

            <div class="p-4 sm:p-5">
              <!-- CRM by Type -->
              <p class="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-2.5">CRM Submissions</p>
              <div class="space-y-2 mb-5">
                <div
                  v-for="[type, count] in crmTypeEntries"
                  :key="type"
                  class="flex items-center gap-3"
                >
                  <span class="text-[10px] font-medium w-28 truncate capitalize">{{ type.replace(/-/g, ' ') }}</span>
                  <div class="flex-1 h-1.5 rounded-full bg-muted/40 overflow-hidden">
                    <div
                      class="h-full rounded-full bg-rose-500/60 transition-all duration-700"
                      :style="{ width: `${Math.max(6, (count / stats.crm.total) * 100)}%` }"
                    />
                  </div>
                  <span class="text-[10px] font-bold tabular-nums w-6 text-right">{{ count }}</span>
                </div>
              </div>

              <!-- Contract Status -->
              <p class="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-2.5">Contracts</p>
              <div class="flex flex-wrap gap-2">
                <div
                  v-for="[status, count] in contractStatusEntries"
                  :key="status"
                  class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs"
                  :class="statusColor(status)"
                >
                  <span class="font-bold tabular-nums">{{ count }}</span>
                  <span class="capitalize text-[10px]">{{ status }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Activity Timeline (Signal Deployment Pipeline style) -->
          <div class="rounded-xl border border-border/50 bg-card shadow-xs overflow-hidden">
            <div class="flex items-center gap-2 px-4 sm:px-5 py-3 sm:py-4 border-b border-border/50">
              <div class="size-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                <Icon name="i-lucide-activity" class="size-4 text-cyan-400" />
              </div>
              <div>
                <h3 class="text-sm font-semibold">Activity Feed</h3>
                <p class="text-[10px] text-muted-foreground">Recent system activity</p>
              </div>
            </div>

            <div v-if="stats.activity.length === 0" class="flex flex-col items-center justify-center py-12 gap-2">
              <Icon name="i-lucide-activity" class="size-8 text-muted-foreground/40" />
              <p class="text-xs text-muted-foreground">No recent activity</p>
            </div>

            <!-- Timeline -->
            <div v-else class="px-4 sm:px-5 py-3">
              <div class="relative border-l-2 border-border/40 ml-3">
                <div
                  v-for="(act, idx) in stats.activity.slice(0, 8)"
                  :key="act._id"
                  class="relative pl-5 pb-4 last:pb-0"
                >
                  <!-- Timeline dot -->
                  <div
                    class="absolute -left-[7px] top-1 size-3 rounded-full border-2 border-background"
                    :class="act.action === 'create' ? 'bg-emerald-500'
                      : act.action === 'update' ? 'bg-blue-500'
                        : act.action === 'delete' ? 'bg-red-500'
                          : act.action === 'login' ? 'bg-violet-500'
                            : 'bg-muted-foreground'"
                  />
                  <!-- Activity card -->
                  <div class="rounded-lg border border-border/30 bg-muted/10 px-3 py-2 hover:bg-muted/20 transition-colors">
                    <div class="flex items-start justify-between gap-2">
                      <div class="flex items-center gap-1.5 min-w-0">
                        <Icon :name="actionIcon(act.action)" class="size-3 text-muted-foreground shrink-0" />
                        <span class="text-[11px] font-medium truncate">{{ act.description }}</span>
                      </div>
                      <span
                        class="inline-flex items-center text-[8px] font-semibold px-1.5 py-0.5 rounded-full border shrink-0"
                        :class="actionColor(act.action)"
                      >
                        {{ act.action }}
                      </span>
                    </div>
                    <div class="flex items-center justify-between mt-1 text-[9px] text-muted-foreground/60">
                      <span class="truncate">{{ act.user }} · {{ act.module }}</span>
                      <span class="shrink-0 tabular-nums">{{ timeAgo(act.createdAt) }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ══════ ROW 4: Production List + Team Members ══════ -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">

          <!-- Recent Production -->
          <div class="rounded-xl border border-border/50 bg-card shadow-xs overflow-hidden">
            <div class="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-border/50">
              <div class="flex items-center gap-2.5">
                <div class="size-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <Icon name="i-lucide-clipboard-list" class="size-4 text-amber-400" />
                </div>
                <div>
                  <h3 class="text-sm font-semibold">Recent Production</h3>
                  <p class="text-[10px] text-muted-foreground">Latest daily reports</p>
                </div>
              </div>
              <NuxtLink to="/daily-production" class="text-[10px] sm:text-xs text-primary hover:underline font-medium">View all →</NuxtLink>
            </div>

            <div v-if="stats.recent.production.length === 0" class="flex flex-col items-center justify-center py-12 gap-2">
              <Icon name="i-lucide-clipboard" class="size-8 text-muted-foreground/40" />
              <p class="text-xs text-muted-foreground">No production reports yet</p>
            </div>

            <div v-else class="divide-y divide-border/30">
              <div
                v-for="prod in stats.recent.production"
                :key="prod._id"
                class="flex items-center gap-3 px-4 sm:px-5 py-2.5 hover:bg-muted/20 transition-colors"
              >
                <div class="size-8 rounded-full bg-muted flex items-center justify-center ring-1 ring-border text-xs font-bold text-muted-foreground shrink-0">
                  {{ prod.employeeName?.charAt(0)?.toUpperCase() || '?' }}
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-xs font-medium truncate">{{ prod.employeeName }}</p>
                  <p class="text-[9px] text-muted-foreground truncate">{{ prod.block1Category || 'No category' }}</p>
                </div>
                <div class="text-right shrink-0">
                  <p v-if="prod.squareFeetCompleted" class="text-[10px] font-bold text-emerald-400 tabular-nums">{{ prod.squareFeetCompleted }} sqft</p>
                  <p v-if="prod.productionHours" class="text-[9px] text-muted-foreground tabular-nums">{{ prod.productionHours }}h</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Recent Team Members -->
          <div class="rounded-xl border border-border/50 bg-card shadow-xs overflow-hidden">
            <div class="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-border/50">
              <div class="flex items-center gap-2.5">
                <div class="size-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <Icon name="i-lucide-user-plus" class="size-4 text-emerald-400" />
                </div>
                <div>
                  <h3 class="text-sm font-semibold">Team Members</h3>
                  <p class="text-[10px] text-muted-foreground">Latest additions</p>
                </div>
              </div>
              <NuxtLink to="/hr/employees" class="text-[10px] sm:text-xs text-primary hover:underline font-medium">View all →</NuxtLink>
            </div>

            <div v-if="stats.recent.employees.length === 0" class="flex flex-col items-center justify-center py-12 gap-2">
              <Icon name="i-lucide-users" class="size-8 text-muted-foreground/40" />
              <p class="text-xs text-muted-foreground">No employees added yet</p>
            </div>

            <div v-else class="divide-y divide-border/30">
              <div
                v-for="emp in stats.recent.employees"
                :key="emp._id"
                class="flex items-center gap-3 px-4 sm:px-5 py-2.5 hover:bg-muted/20 transition-colors"
              >
                <img
                  v-if="emp.profileImage"
                  :src="emp.profileImage"
                  :alt="emp.employee"
                  class="size-8 rounded-full object-cover ring-1 ring-border shrink-0"
                />
                <div
                  v-else
                  class="size-8 rounded-full bg-muted flex items-center justify-center ring-1 ring-border text-xs font-bold text-muted-foreground shrink-0"
                >
                  {{ emp.employee?.charAt(0)?.toUpperCase() || '?' }}
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-xs font-medium truncate">{{ emp.employee }}</p>
                  <p class="text-[9px] text-muted-foreground truncate">{{ emp.position }}</p>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                  <span
                    class="size-2 rounded-full"
                    :class="emp.status === 'Active' ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/40'"
                  />
                  <span
                    class="text-[10px] font-semibold"
                    :class="emp.status === 'Active' ? 'text-emerald-400' : 'text-muted-foreground'"
                  >
                    {{ emp.status }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>

    </div>
  </div>
</template>
