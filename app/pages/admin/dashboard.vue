<script setup lang="ts">
import NumberFlow from '@number-flow/vue'
import { toast } from 'vue-sonner'

const { setHeader } = usePageHeader()
setHeader({ title: 'Dashboard', icon: 'i-lucide-layout-dashboard', description: 'Overview of your workspace' })

// ─── State ───────────────────────────────────────────────
interface DashboardStats {
  employees: { total: number; active: number; inactive: number }
  tasks: { total: number; byStatus: Record<string, number> }
  skills: { total: number; categories: number; subCategories: number }
  production: { total: number }
  communications: { total: number }
  recent: {
    production: { _id: string; employeeName: string; date: string; block1Category: string; squareFeetCompleted: number; productionHours: number }[]
    tasks: { _id: string; title: string; status: string; priority: string; assigneeName: string; assigneeAvatar: string; createdAt: string }[]
    employees: { _id: string; employee: string; position: string; profileImage: string; status: string; createdAt: string }[]
  }
}

const stats = ref<DashboardStats | null>(null)
const loading = ref(true)

// ─── Animated counters (start from 0) ────────────────────
const counters = ref({
  employees: 0,
  activeEmployees: 0,
  tasks: 0,
  skills: 0,
  categories: 0,
  production: 0,
  communications: 0,
})

async function fetchStats() {
  loading.value = true
  try {
    const res = await $fetch<{ success: boolean; data: DashboardStats }>('/api/dashboard/stats')
    stats.value = res.data

    // Animate counters after a frame
    await nextTick()
    counters.value = {
      employees: res.data.employees.total,
      activeEmployees: res.data.employees.active,
      tasks: res.data.tasks.total,
      skills: res.data.skills.total,
      categories: res.data.skills.categories,
      production: res.data.production.total,
      communications: res.data.communications.total,
    }
  } catch (e: any) {
    toast.error('Failed to load dashboard', { description: e?.message })
  } finally {
    loading.value = false
  }
}

onMounted(fetchStats)

// ─── Helpers ──────────────────────────────────────────────
function statusColor(status: string) {
  const s = status.toLowerCase()
  if (s === 'done' || s === 'completed') return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
  if (s === 'in progress' || s === 'in_progress') return 'bg-blue-500/15 text-blue-400 border-blue-500/30'
  if (s === 'todo' || s === 'to do') return 'bg-amber-500/15 text-amber-400 border-amber-500/30'
  if (s === 'backlog') return 'bg-muted text-muted-foreground border-border/40'
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

const taskStatusEntries = computed(() => {
  if (!stats.value) return []
  return Object.entries(stats.value.tasks.byStatus)
    .sort((a, b) => b[1] - a[1])
})

// Metric cards configuration
const metricCards = computed(() => [
  {
    label: 'Total Employees',
    value: counters.value.employees,
    sub: `${counters.value.activeEmployees} active`,
    icon: 'i-lucide-users',
    gradient: 'from-violet-500/20 to-purple-500/5',
    borderColor: 'border-violet-500/20',
    iconColor: 'text-violet-400',
    link: '/hr/employees',
  },
  {
    label: 'Total Tasks',
    value: counters.value.tasks,
    sub: `${stats.value?.tasks.byStatus?.['In Progress'] || 0} in progress`,
    icon: 'i-lucide-check-square',
    gradient: 'from-blue-500/20 to-sky-500/5',
    borderColor: 'border-blue-500/20',
    iconColor: 'text-blue-400',
    link: '/tasks',
  },
  {
    label: 'Skills Tracked',
    value: counters.value.skills,
    sub: `${counters.value.categories} categories`,
    icon: 'i-lucide-graduation-cap',
    gradient: 'from-emerald-500/20 to-green-500/5',
    borderColor: 'border-emerald-500/20',
    iconColor: 'text-emerald-400',
    link: '/admin/skills',
  },
  {
    label: 'Production Reports',
    value: counters.value.production,
    sub: 'daily entries',
    icon: 'i-lucide-clipboard-list',
    gradient: 'from-amber-500/20 to-orange-500/5',
    borderColor: 'border-amber-500/20',
    iconColor: 'text-amber-400',
    link: '/daily-production',
  },
  {
    label: 'Communications',
    value: counters.value.communications,
    sub: 'project updates',
    icon: 'i-lucide-message-square',
    gradient: 'from-cyan-500/20 to-teal-500/5',
    borderColor: 'border-cyan-500/20',
    iconColor: 'text-cyan-400',
    link: '/project-communication',
  },
])
</script>

<template>
  <div class="h-[calc(100vh-theme(spacing.16))] overflow-y-auto">
    <div class="w-full flex flex-col gap-4 sm:gap-6 p-3 sm:p-6">

      <!-- ══════ Loading Skeleton ══════ -->
      <template v-if="loading">
        <div class="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
          <div v-for="i in 5" :key="i" class="h-28 sm:h-32 rounded-xl border bg-card animate-pulse" :class="i === 5 ? 'col-span-2 sm:col-span-1' : ''" />
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
          <div class="lg:col-span-2 h-56 sm:h-72 rounded-xl border bg-card animate-pulse" />
          <div class="h-56 sm:h-72 rounded-xl border bg-card animate-pulse" />
        </div>
      </template>

      <template v-else-if="stats">
        <!-- ══════ METRIC CARDS ══════ -->
        <div class="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
          <NuxtLink
            v-for="(card, idx) in metricCards"
            :key="card.label"
            :to="card.link"
            class="group relative rounded-xl border bg-card p-3.5 sm:p-5 flex flex-col gap-2 sm:gap-3 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer"
            :class="[card.borderColor, idx === metricCards.length - 1 && metricCards.length % 2 !== 0 ? 'col-span-2 sm:col-span-1' : '']"
          >
            <!-- Gradient glow -->
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
              <Icon name="i-lucide-arrow-up-right" class="size-3.5 sm:size-4 text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-all duration-200" />
            </div>

            <div class="relative">
              <p class="text-xl sm:text-2xl font-bold tabular-nums">
                <NumberFlow :value="card.value" />
              </p>
              <p class="text-[10px] sm:text-xs text-muted-foreground font-medium mt-0.5">{{ card.label }}</p>
            </div>

            <div class="relative">
              <span class="text-[9px] sm:text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wider">{{ card.sub }}</span>
            </div>
          </NuxtLink>
        </div>

        <!-- ══════ MIDDLE ROW ══════ -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">

          <!-- ─── Recent Tasks ─── -->
          <div class="lg:col-span-2 rounded-xl border border-border/50 bg-card shadow-xs overflow-hidden">
            <div class="flex items-center justify-between px-3.5 sm:px-5 py-3 sm:py-4 border-b border-border/50">
              <div class="flex items-center gap-2">
                <div class="size-7 sm:size-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <Icon name="i-lucide-check-square" class="size-3.5 sm:size-4 text-blue-400" />
                </div>
                <div>
                  <h3 class="text-xs sm:text-sm font-semibold">Recent Tasks</h3>
                  <p class="text-[9px] sm:text-[10px] text-muted-foreground">Latest activity</p>
                </div>
              </div>
              <NuxtLink to="/tasks" class="text-[10px] sm:text-xs text-primary hover:underline font-medium">
                View all →
              </NuxtLink>
            </div>

            <div v-if="stats.recent.tasks.length === 0" class="flex flex-col items-center justify-center py-10 sm:py-12 gap-2">
              <Icon name="i-lucide-inbox" class="size-7 sm:size-8 text-muted-foreground/40" />
              <p class="text-[10px] sm:text-xs text-muted-foreground">No tasks yet</p>
            </div>

            <div v-else class="divide-y divide-border/30">
              <div
                v-for="task in stats.recent.tasks"
                :key="task._id"
                class="flex items-center gap-2.5 sm:gap-3 px-3.5 sm:px-5 py-2.5 sm:py-3 hover:bg-muted/20 transition-colors"
              >
                <Icon :name="priorityIcon(task.priority)" class="size-3.5 sm:size-4 shrink-0" :class="priorityColor(task.priority)" />
                <div class="flex-1 min-w-0">
                  <p class="text-xs sm:text-sm font-medium truncate">{{ task.title }}</p>
                  <p v-if="task.assigneeName" class="text-[9px] sm:text-[10px] text-muted-foreground truncate">{{ task.assigneeName }}</p>
                </div>
                <span
                  class="inline-flex items-center text-[9px] sm:text-[10px] font-semibold px-1.5 sm:px-2 py-0.5 rounded-full border shrink-0"
                  :class="statusColor(task.status)"
                >
                  {{ task.status }}
                </span>
                <span class="text-[9px] sm:text-[10px] text-muted-foreground/60 shrink-0 w-10 sm:w-14 text-right hidden xs:inline">{{ timeAgo(task.createdAt) }}</span>
              </div>
            </div>
          </div>

          <!-- ─── Task Status Breakdown ─── -->
          <div class="rounded-xl border border-border/50 bg-card shadow-xs overflow-hidden">
            <div class="flex items-center gap-2 px-3.5 sm:px-5 py-3 sm:py-4 border-b border-border/50">
              <div class="size-7 sm:size-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                <Icon name="i-lucide-pie-chart" class="size-3.5 sm:size-4 text-violet-400" />
              </div>
              <div>
                <h3 class="text-xs sm:text-sm font-semibold">Tasks by Status</h3>
                <p class="text-[9px] sm:text-[10px] text-muted-foreground">Distribution</p>
              </div>
            </div>

            <div v-if="taskStatusEntries.length === 0" class="flex flex-col items-center justify-center py-10 sm:py-12 gap-2">
              <Icon name="i-lucide-bar-chart-3" class="size-7 sm:size-8 text-muted-foreground/40" />
              <p class="text-[10px] sm:text-xs text-muted-foreground">No data yet</p>
            </div>

            <div v-else class="p-3.5 sm:p-5 flex flex-col gap-2.5 sm:gap-3">
              <div
                v-for="[status, count] in taskStatusEntries"
                :key="status"
                class="flex items-center gap-2 sm:gap-3"
              >
                <span
                  class="inline-flex items-center text-[9px] sm:text-[10px] font-semibold px-1.5 sm:px-2 py-0.5 rounded-full border w-20 sm:w-24 justify-center shrink-0"
                  :class="statusColor(status)"
                >
                  {{ status }}
                </span>
                <div class="flex-1 h-1.5 sm:h-2 rounded-full bg-muted/40 overflow-hidden">
                  <div
                    class="h-full rounded-full transition-all duration-700 ease-out"
                    :class="status.toLowerCase().includes('done') || status.toLowerCase().includes('completed')
                      ? 'bg-emerald-500/60'
                      : status.toLowerCase().includes('progress')
                        ? 'bg-blue-500/60'
                        : status.toLowerCase().includes('todo')
                          ? 'bg-amber-500/60'
                          : 'bg-muted-foreground/30'"
                    :style="{ width: `${stats ? Math.max(8, (count / stats.tasks.total) * 100) : 0}%` }"
                  />
                </div>
                <span class="text-[10px] sm:text-xs font-bold tabular-nums w-6 sm:w-8 text-right">{{ count }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- ══════ BOTTOM ROW ══════ -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">

          <!-- ─── Recent Production ─── -->
          <div class="rounded-xl border border-border/50 bg-card shadow-xs overflow-hidden">
            <div class="flex items-center justify-between px-3.5 sm:px-5 py-3 sm:py-4 border-b border-border/50">
              <div class="flex items-center gap-2">
                <div class="size-7 sm:size-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <Icon name="i-lucide-clipboard-list" class="size-3.5 sm:size-4 text-amber-400" />
                </div>
                <div>
                  <h3 class="text-xs sm:text-sm font-semibold">Recent Production</h3>
                  <p class="text-[9px] sm:text-[10px] text-muted-foreground">Latest daily reports</p>
                </div>
              </div>
              <NuxtLink to="/daily-production" class="text-[10px] sm:text-xs text-primary hover:underline font-medium">
                View all →
              </NuxtLink>
            </div>

            <div v-if="stats.recent.production.length === 0" class="flex flex-col items-center justify-center py-10 sm:py-12 gap-2">
              <Icon name="i-lucide-clipboard" class="size-7 sm:size-8 text-muted-foreground/40" />
              <p class="text-[10px] sm:text-xs text-muted-foreground">No production reports yet</p>
            </div>

            <div v-else class="divide-y divide-border/30">
              <div
                v-for="prod in stats.recent.production"
                :key="prod._id"
                class="flex items-center gap-2.5 sm:gap-3 px-3.5 sm:px-5 py-2.5 sm:py-3 hover:bg-muted/20 transition-colors"
              >
                <div class="size-7 sm:size-8 rounded-full bg-muted flex items-center justify-center ring-1 ring-border text-[10px] sm:text-xs font-bold text-muted-foreground shrink-0">
                  {{ prod.employeeName?.charAt(0)?.toUpperCase() || '?' }}
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-xs sm:text-sm font-medium truncate">{{ prod.employeeName }}</p>
                  <p class="text-[9px] sm:text-[10px] text-muted-foreground truncate">{{ prod.block1Category || 'No category' }}</p>
                </div>
                <div class="text-right shrink-0">
                  <p v-if="prod.squareFeetCompleted" class="text-[10px] sm:text-xs font-bold text-emerald-400">{{ prod.squareFeetCompleted }} sqft</p>
                  <p v-if="prod.productionHours" class="text-[9px] sm:text-[10px] text-muted-foreground">{{ prod.productionHours }}h</p>
                </div>
              </div>
            </div>
          </div>

          <!-- ─── Recent Team Members ─── -->
          <div class="rounded-xl border border-border/50 bg-card shadow-xs overflow-hidden">
            <div class="flex items-center justify-between px-3.5 sm:px-5 py-3 sm:py-4 border-b border-border/50">
              <div class="flex items-center gap-2">
                <div class="size-7 sm:size-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <Icon name="i-lucide-user-plus" class="size-3.5 sm:size-4 text-emerald-400" />
                </div>
                <div>
                  <h3 class="text-xs sm:text-sm font-semibold">Team Members</h3>
                  <p class="text-[9px] sm:text-[10px] text-muted-foreground">Latest additions</p>
                </div>
              </div>
              <NuxtLink to="/hr/employees" class="text-[10px] sm:text-xs text-primary hover:underline font-medium">
                View all →
              </NuxtLink>
            </div>

            <div v-if="stats.recent.employees.length === 0" class="flex flex-col items-center justify-center py-10 sm:py-12 gap-2">
              <Icon name="i-lucide-users" class="size-7 sm:size-8 text-muted-foreground/40" />
              <p class="text-[10px] sm:text-xs text-muted-foreground">No employees added yet</p>
            </div>

            <div v-else class="divide-y divide-border/30">
              <div
                v-for="emp in stats.recent.employees"
                :key="emp._id"
                class="flex items-center gap-2.5 sm:gap-3 px-3.5 sm:px-5 py-2.5 sm:py-3 hover:bg-muted/20 transition-colors"
              >
                <img
                  v-if="emp.profileImage"
                  :src="emp.profileImage"
                  :alt="emp.employee"
                  class="size-7 sm:size-8 rounded-full object-cover ring-1 ring-border shrink-0"
                />
                <div
                  v-else
                  class="size-7 sm:size-8 rounded-full bg-muted flex items-center justify-center ring-1 ring-border text-[10px] sm:text-xs font-bold text-muted-foreground shrink-0"
                >
                  {{ emp.employee?.charAt(0)?.toUpperCase() || '?' }}
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-xs sm:text-sm font-medium truncate">{{ emp.employee }}</p>
                  <p class="text-[9px] sm:text-[10px] text-muted-foreground truncate">{{ emp.position }}</p>
                </div>
                <div class="flex items-center gap-1 sm:gap-1.5 shrink-0">
                  <span
                    class="size-1.5 sm:size-2 rounded-full"
                    :class="emp.status === 'Active' ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/40'"
                  />
                  <span
                    class="text-[9px] sm:text-[10px] font-semibold"
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
