<script setup lang="ts">
import NumberFlow from '@number-flow/vue'
import { startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, subYears, format } from 'date-fns'
import type { DateRange } from 'reka-ui'
import { CalendarDate } from '@internationalized/date'

const { setHeader } = usePageHeader()
const { user } = useAuth()
const activeTeamId = useCookie<string>('active_workspace_id')
const { data: workspacesRes } = useNuxtData('workspaces-list')

// ─── Workspace Detection ──────────────────────────────────
const activeWorkspace = computed(() => {
  const teams = workspacesRes.value?.data || []
  const userWs = user.value?.workspace
  const filtered = userWs ? teams.filter((t: any) => t._id === userWs) : teams
  return filtered.find((t: any) => t._id === activeTeamId.value) || filtered[0]
})

const viewMode = computed<'admin' | 'supervisor' | 'crew'>(() => {
  const name = (activeWorkspace.value?.name || '').toLowerCase()
  if (name.includes('admin')) return 'admin'
  if (name.includes('supervisor')) return 'supervisor'
  return 'crew'
})

setHeader({
  title: 'Admin Dashboard',
  icon: 'i-lucide-gauge',
  description: 'Your personalized workspace overview',
})

// ─── Date Filter ──────────────────────────────────────────
type PresetKey = 'all' | 'this-month' | 'last-month' | 'this-year' | 'last-year' | 'q1' | 'q2' | 'q3' | 'q4' | 'custom'

const activePreset = ref<PresetKey>('all')
const customFrom = ref<Date | null>(null)
const customTo = ref<Date | null>(null)
const showDatePicker = ref(false)
const isMounted = ref(false)

onMounted(() => { isMounted.value = true })

const now = new Date()
const currentYear = now.getFullYear()

function quarterRange(q: 1 | 2 | 3 | 4): { from: Date, to: Date } {
  const monthStart = (q - 1) * 3
  const start = new Date(currentYear, monthStart, 1)
  const end = endOfMonth(new Date(currentYear, monthStart + 2, 1))
  return { from: start, to: end }
}

const presets: { key: PresetKey, label: string }[] = [
  { key: 'all', label: 'All Time' },
  { key: 'this-month', label: 'This Month' },
  { key: 'last-month', label: 'Last Month' },
  { key: 'this-year', label: 'This Year' },
  { key: 'last-year', label: 'Last Year' },
  { key: 'q1', label: 'Q1' },
  { key: 'q2', label: 'Q2' },
  { key: 'q3', label: 'Q3' },
  { key: 'q4', label: 'Q4' },
]

const dateRange = computed<{ from?: Date, to?: Date }>(() => {
  switch (activePreset.value) {
    case 'this-month': return { from: startOfMonth(now), to: endOfMonth(now) }
    case 'last-month': {
      const last = subMonths(now, 1)
      return { from: startOfMonth(last), to: endOfMonth(last) }
    }
    case 'this-year': return { from: startOfYear(now), to: endOfYear(now) }
    case 'last-year': {
      const prev = subYears(now, 1)
      return { from: startOfYear(prev), to: endOfYear(prev) }
    }
    case 'q1': return quarterRange(1)
    case 'q2': return quarterRange(2)
    case 'q3': return quarterRange(3)
    case 'q4': return quarterRange(4)
    case 'custom': return { from: customFrom.value || undefined, to: customTo.value || undefined }
    default: return {}
  }
})

// Range calendar model
const calendarRange = ref<DateRange>()

function fromCalendarDate(cd: any): Date {
  return new Date(cd.year, cd.month - 1, cd.day)
}

function applyCustomRange() {
  if (calendarRange.value?.start && calendarRange.value?.end) {
    customFrom.value = fromCalendarDate(calendarRange.value.start)
    customTo.value = fromCalendarDate(calendarRange.value.end)
    activePreset.value = 'custom'
    showDatePicker.value = false
  }
}

function selectPreset(key: PresetKey) {
  if (key === 'custom') {
    showDatePicker.value = true
    return
  }
  activePreset.value = key
  showDatePicker.value = false
}

const filterLabel = computed(() => {
  if (activePreset.value === 'all') return ''
  if (activePreset.value === 'custom' && customFrom.value && customTo.value) {
    return `${format(customFrom.value, 'MMM d')} – ${format(customTo.value, 'MMM d, yyyy')}`
  }
  return presets.find(p => p.key === activePreset.value)?.label || ''
})

// ─── Data ─────────────────────────────────────────────────
const stats = ref<any>(null)
const initialLoading = ref(true) // skeleton on first load only
const refreshing = ref(false)     // subtle indicator on filter changes

async function fetchStats() {
  // Only show skeleton if no data exists yet (first load)
  if (!stats.value) initialLoading.value = true
  else refreshing.value = true
  try {
    const params: Record<string, string> = {}
    if (dateRange.value.from) params.from = dateRange.value.from.toISOString()
    if (dateRange.value.to) params.to = dateRange.value.to.toISOString()
    const qs = new URLSearchParams(params).toString()
    const url = `/api/admin-dashboard/stats${qs ? `?${qs}` : ''}`
    const res = await $fetch<{ success: boolean, data: any }>(url)
    stats.value = res.data
  }
  catch { /* handled */ }
  finally {
    initialLoading.value = false
    refreshing.value = false
  }
}

watch(dateRange, () => { fetchStats() }, { deep: true })
onMounted(fetchStats)

// ─── Helpers ──────────────────────────────────────────────
function fmtDate(d: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function timeAgo(d: string) {
  if (!d) return ''
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function levelColor(lvl: string) {
  if (lvl === 'Mastered') return 'text-emerald-400'
  if (lvl === 'Proficient') return 'text-blue-400'
  return 'text-amber-400'
}

function levelBg(lvl: string) {
  if (lvl === 'Mastered') return 'bg-emerald-500'
  if (lvl === 'Proficient') return 'bg-blue-500'
  return 'bg-amber-500'
}

function levelBadge(lvl: string) {
  if (lvl === 'Mastered') return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
  if (lvl === 'Proficient') return 'bg-blue-500/15 text-blue-400 border-blue-500/30'
  return 'bg-amber-500/15 text-amber-400 border-amber-500/30'
}

// ─── Admin Computeds ──────────────────────────────────────
const adminData = computed(() => stats.value?.admin)
const maxMonthlyReviews = computed(() => {
  if (!adminData.value?.monthlyTrend.length) return 1
  return Math.max(...adminData.value.monthlyTrend.map((m: any) => m.reviews), 1)
})

const orgProficiencyRate = computed(() => {
  if (!adminData.value) return 0
  const s = adminData.value.orgStats
  const total = s.orgMastered + s.orgProficient + s.orgNeedsImp
  return total > 0 ? Math.round(((s.orgMastered + s.orgProficient) / total) * 100) : 0
})

// ─── Supervisor Computeds ─────────────────────────────────
const supData = computed(() => stats.value?.supervisor)

const heatmapGrid = computed(() => {
  if (!supData.value?.heatmap) return []
  const map = new Map<string, number>()
  for (const d of supData.value.heatmap) map.set(d.date, d.count)
  const cells: { date: string, count: number }[] = []
  const today = new Date()
  for (let i = 90; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    cells.push({ date: key, count: map.get(key) || 0 })
  }
  return cells
})

const heatmapMax = computed(() => Math.max(...heatmapGrid.value.map(c => c.count), 1))

function heatmapColor(count: number) {
  if (count === 0) return 'bg-muted/40'
  const i = count / heatmapMax.value
  if (i > 0.75) return 'bg-emerald-500'
  if (i > 0.5) return 'bg-emerald-500/70'
  if (i > 0.25) return 'bg-emerald-500/40'
  return 'bg-emerald-500/20'
}

// ─── Crew Computeds ───────────────────────────────────────
const crewData = computed(() => stats.value?.crew)

const crewProgress = computed(() => {
  if (!crewData.value || !crewData.value.totalSkills) return 0
  return Math.round(((crewData.value.summary.mastered + crewData.value.summary.proficient) / crewData.value.totalSkills) * 100)
})

// ─── Employee Skill Detail Sheet ──────────────────────────
const showSkillSheet = ref(false)
const skillSheetLoading = ref(false)
const selectedEmployee = ref<any>(null)
const employeeSkillData = ref<any>(null)
const skillLevelFilter = ref<'all' | 'Mastered' | 'Proficient' | 'Needs Improvement' | 'Unassessed'>('all')
const skillSearch = ref('')
const expandedCategories = ref<Set<string>>(new Set())

async function openEmployeeSkills(emp: any) {
  selectedEmployee.value = emp
  showSkillSheet.value = true
  skillSheetLoading.value = true
  skillLevelFilter.value = 'all'
  skillSearch.value = ''
  expandedCategories.value = new Set()
  try {
    const res = await $fetch<any>(`/api/admin-dashboard/employee-skills?employeeId=${emp._id}`)
    employeeSkillData.value = res.data
    // Auto-expand all categories
    for (const cat of res.data.categories) {
      expandedCategories.value.add(cat._id)
    }
  }
  catch { /* handled */ }
  finally { skillSheetLoading.value = false }
}

function toggleCategory(catId: string) {
  if (expandedCategories.value.has(catId)) expandedCategories.value.delete(catId)
  else expandedCategories.value.add(catId)
}

const filteredSkills = computed(() => {
  if (!employeeSkillData.value?.skills) return []
  let skills = employeeSkillData.value.skills
  if (skillLevelFilter.value !== 'all') {
    skills = skills.filter((s: any) => s.level === skillLevelFilter.value)
  }
  if (skillSearch.value.trim()) {
    const q = skillSearch.value.toLowerCase()
    skills = skills.filter((s: any) =>
      s.name.toLowerCase().includes(q) ||
      s.categoryName.toLowerCase().includes(q) ||
      s.subCategoryName.toLowerCase().includes(q),
    )
  }
  return skills
})

const filteredCategories = computed(() => {
  if (!employeeSkillData.value?.categories) return []
  return employeeSkillData.value.categories.map((cat: any) => ({
    ...cat,
    subCategories: cat.subCategories.map((sub: any) => ({
      ...sub,
      skills: sub.skills.filter((s: any) => {
        const levelMatch = skillLevelFilter.value === 'all' || s.level === skillLevelFilter.value
        const searchMatch = !skillSearch.value.trim() ||
          s.name.toLowerCase().includes(skillSearch.value.toLowerCase()) ||
          sub.name.toLowerCase().includes(skillSearch.value.toLowerCase())
        return levelMatch && searchMatch
      }),
    })).filter((sub: any) => sub.skills.length > 0),
  })).filter((cat: any) => cat.subCategories.length > 0)
})

const skillLevelTabs = computed(() => {
  const s = employeeSkillData.value?.summary || {}
  return [
    { key: 'all', label: 'All Skills', count: s.total || 0, color: '' },
    { key: 'Mastered', label: 'Mastered', count: s.mastered || 0, color: 'text-emerald-500' },
    { key: 'Proficient', label: 'Proficient', count: s.proficient || 0, color: 'text-blue-500' },
    { key: 'Needs Improvement', label: 'Needs Imp.', count: s.needsImp || 0, color: 'text-amber-500' },
    { key: 'Unassessed', label: 'Unassessed', count: s.unassessed || 0, color: 'text-muted-foreground' },
  ]
})

function skillLevelIcon(level: string) {
  if (level === 'Mastered') return 'i-lucide-award'
  if (level === 'Proficient') return 'i-lucide-check-circle-2'
  if (level === 'Needs Improvement') return 'i-lucide-arrow-up-circle'
  return 'i-lucide-minus-circle'
}

function skillLevelStyle(level: string) {
  if (level === 'Mastered') return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
  if (level === 'Proficient') return 'bg-blue-500/10 text-blue-500 border-blue-500/20'
  if (level === 'Needs Improvement') return 'bg-amber-500/10 text-amber-500 border-amber-500/20'
  return 'bg-muted/50 text-muted-foreground border-border/50'
}
</script>

<template>
  <div class="max-w-[100rem] mx-auto space-y-6">
    <!-- Header Toolbar: Quick Date Filters -->
    <ClientOnly>
      <Teleport v-if="isMounted" to="#header-toolbar">
        <div class="flex items-center gap-1.5 w-full overflow-x-auto scrollbar-none pr-2">
          <!-- Preset pills -->
          <button
            v-for="preset in presets"
            :key="preset.key"
            class="shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap border"
            :class="activePreset === preset.key
              ? 'bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/25'
              : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-muted hover:text-foreground'"
            @click="selectPreset(preset.key)"
          >
            {{ preset.label }}
          </button>

          <!-- Custom Date Range Trigger -->
          <Popover v-model:open="showDatePicker">
            <PopoverTrigger as-child>
              <button
                class="shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap border flex items-center gap-1.5"
                :class="activePreset === 'custom'
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/25'
                  : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-muted hover:text-foreground'"
              >
                <Icon name="i-lucide-calendar-range" class="size-3.5" />
                <span v-if="activePreset === 'custom' && filterLabel">{{ filterLabel }}</span>
                <span v-else>Custom</span>
              </button>
            </PopoverTrigger>
            <PopoverContent class="w-auto p-0" align="end" :side-offset="8">
              <div class="p-4 space-y-3">
                <div class="flex items-center gap-2 pb-2 border-b border-border/50">
                  <Icon name="i-lucide-calendar-range" class="size-4 text-primary" />
                  <span class="text-sm font-semibold">Select Date Range</span>
                </div>
                <RangeCalendar
                  v-model="calendarRange"
                  :number-of-months="2"
                  class="rounded-lg"
                />
                <div class="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
                  <button
                    class="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    @click="showDatePicker = false"
                  >
                    Cancel
                  </button>
                  <button
                    class="px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-40"
                    :disabled="!calendarRange?.start || !calendarRange?.end"
                    @click="applyCustomRange"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <!-- Active filter indicator -->
          <button
            v-if="activePreset !== 'all'"
            class="shrink-0 ml-1 size-6 rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20 flex items-center justify-center transition-colors"
            title="Clear filter"
            @click="activePreset = 'all'"
          >
            <Icon name="i-lucide-x" class="size-3" />
          </button>
        </div>
      </Teleport>
    </ClientOnly>

    <!-- Loading Skeleton -->
    <!-- Initial Load Skeleton (first load only) -->
    <template v-if="initialLoading && !stats">
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div v-for="i in 4" :key="i" class="h-32 rounded-2xl bg-card border animate-pulse" />
      </div>
      <div class="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div class="xl:col-span-8 h-96 rounded-2xl bg-card border animate-pulse" />
        <div class="xl:col-span-4 h-96 rounded-2xl bg-card border animate-pulse" />
      </div>
    </template>

    <!-- Dashboard Content (stays mounted across filter changes) -->
    <template v-if="stats">
      <!-- Refresh overlay — subtle top progress bar + content dim -->
      <Transition name="dash-refresh">
        <div v-if="refreshing" class="fixed top-[var(--header-height)] left-0 right-0 z-50 pointer-events-none">
          <div class="h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent animate-[shimmer_1s_ease-in-out_infinite]" />
        </div>
      </Transition>

      <!-- Content wrapper: smooth opacity dim during refresh -->
      <div
        class="space-y-6 transition-opacity duration-300 ease-in-out"
        :class="refreshing ? 'opacity-50 pointer-events-none' : 'opacity-100'"
      >
      <!-- ══════════════════════════════════════════════════════ -->
      <!-- ADMIN VIEW — HR Intelligence & People Analytics      -->
      <!-- ══════════════════════════════════════════════════════ -->
      <template v-if="viewMode === 'admin' && adminData">
        <!-- Welcome Hero -->
        <div class="relative rounded-2xl border border-violet-500/20 bg-gradient-to-r from-violet-500/10 via-fuchsia-500/5 to-transparent p-6 sm:p-8 overflow-hidden">
          <div class="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-violet-500/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
          <div class="absolute bottom-0 left-1/2 w-96 h-32 bg-gradient-to-t from-fuchsia-500/5 to-transparent pointer-events-none" />
          <div class="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
            <div class="size-14 sm:size-16 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/25 shrink-0">
              <Icon name="i-lucide-brain" class="size-7 sm:size-8 text-white" />
            </div>
            <div class="flex-1">
              <h1 class="text-xl sm:text-2xl font-bold">People Analytics</h1>
              <p class="text-sm text-muted-foreground mt-1">HR intelligence across <span class="font-semibold text-foreground">{{ adminData.orgStats.activeEmployees }}</span> active employees and <span class="font-semibold text-foreground">{{ adminData.orgStats.totalSkills }}</span> skills</p>
            </div>
            <div class="flex items-center gap-4 shrink-0">
              <div class="text-center px-4">
                <p class="text-2xl sm:text-3xl font-black tabular-nums text-violet-400">{{ adminData.orgStats.totalReviews.toLocaleString() }}</p>
                <p class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Reviews</p>
              </div>
              <div class="w-px h-10 bg-border/50" />
              <div class="text-center px-4">
                <p class="text-2xl sm:text-3xl font-black tabular-nums" :class="orgProficiencyRate >= 70 ? 'text-emerald-400' : 'text-amber-400'">{{ orgProficiencyRate }}%</p>
                <p class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Proficiency</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Org-Level Mastery Breakdown -->
        <div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div class="rounded-2xl border border-border/50 bg-card p-5 flex items-center gap-4 group hover:shadow-md hover:-translate-y-0.5 transition-all">
            <div class="size-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <Icon name="i-lucide-award" class="size-6 text-emerald-400" />
            </div>
            <div>
              <p class="text-2xl font-black text-emerald-400 tabular-nums"><NumberFlow :value="adminData.orgStats.orgMastered" /></p>
              <p class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Mastered</p>
            </div>
          </div>
          <div class="rounded-2xl border border-border/50 bg-card p-5 flex items-center gap-4 group hover:shadow-md hover:-translate-y-0.5 transition-all">
            <div class="size-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <Icon name="i-lucide-check-circle-2" class="size-6 text-blue-400" />
            </div>
            <div>
              <p class="text-2xl font-black text-blue-400 tabular-nums"><NumberFlow :value="adminData.orgStats.orgProficient" /></p>
              <p class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Proficient</p>
            </div>
          </div>
          <div class="rounded-2xl border border-border/50 bg-card p-5 flex items-center gap-4 group hover:shadow-md hover:-translate-y-0.5 transition-all">
            <div class="size-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <Icon name="i-lucide-arrow-up-circle" class="size-6 text-amber-400" />
            </div>
            <div>
              <p class="text-2xl font-black text-amber-400 tabular-nums"><NumberFlow :value="adminData.orgStats.orgNeedsImp" /></p>
              <p class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Needs Improvement</p>
            </div>
          </div>
          <div class="rounded-2xl border border-border/50 bg-card p-5 flex items-center gap-4 group hover:shadow-md hover:-translate-y-0.5 transition-all">
            <div class="size-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <Icon name="i-lucide-users" class="size-6 text-violet-400" />
            </div>
            <div>
              <p class="text-2xl font-black tabular-nums"><NumberFlow :value="adminData.orgStats.activeEmployees" /></p>
              <p class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Active Employees</p>
            </div>
          </div>
        </div>

        <!-- Employee Performance Matrix + Skill Gap Analysis -->
        <div class="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <!-- Employee Performance Matrix -->
          <div class="xl:col-span-8 rounded-2xl border border-border/50 bg-card shadow-xs overflow-hidden">
            <div class="flex items-center justify-between px-5 py-4 border-b border-border/50">
              <div class="flex items-center gap-3">
                <div class="size-9 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10 border border-violet-500/20 flex items-center justify-center">
                  <Icon name="i-lucide-bar-chart-3" class="size-4.5 text-violet-400" />
                </div>
                <div>
                  <h3 class="text-sm font-bold">Employee Skill Matrix</h3>
                  <p class="text-[10px] text-muted-foreground">Completion & proficiency per employee</p>
                </div>
              </div>
              <NuxtLink to="/hr/employee-performance" class="text-[10px] sm:text-xs text-primary hover:underline font-medium">Full Report →</NuxtLink>
            </div>

            <div class="divide-y divide-border/20">
              <div
                v-for="emp in adminData.employeeProfiles.slice(0, 12)"
                :key="emp._id"
                class="flex items-center gap-3 px-5 py-3 hover:bg-muted/10 transition-colors cursor-pointer group"
                @click="openEmployeeSkills(emp)"
              >
                <!-- Avatar -->
                <div class="size-9 rounded-full bg-muted overflow-hidden border border-border/50 shrink-0">
                  <img v-if="emp.image" :src="emp.image" :alt="emp.name" class="size-full object-cover">
                  <div v-else class="size-full flex items-center justify-center text-xs font-bold text-muted-foreground bg-primary/5">{{ emp.name?.charAt(0) }}</div>
                </div>

                <!-- Name -->
                <div class="w-32 min-w-0 shrink-0">
                  <p class="text-xs font-semibold truncate group-hover:text-primary transition-colors">{{ emp.name }}</p>
                  <p class="text-[9px] text-muted-foreground truncate">{{ emp.position || 'Employee' }}</p>
                </div>

                <!-- Stacked progress bar -->
                <div class="flex-1 space-y-1">
                  <div class="h-2.5 w-full rounded-full bg-muted/30 overflow-hidden flex">
                    <div class="h-full bg-emerald-500 transition-all duration-700" :style="{ width: `${emp.assessed ? (emp.mastered / emp.assessed) * 100 : 0}%` }" />
                    <div class="h-full bg-blue-500 transition-all duration-700" :style="{ width: `${emp.assessed ? (emp.proficient / emp.assessed) * 100 : 0}%` }" />
                    <div class="h-full bg-amber-500 transition-all duration-700" :style="{ width: `${emp.assessed ? (emp.needsImp / emp.assessed) * 100 : 0}%` }" />
                  </div>
                </div>

                <!-- Level counts -->
                <div class="flex items-center gap-2 shrink-0">
                  <span class="text-[10px] font-bold text-emerald-400 tabular-nums w-6 text-center">{{ emp.mastered }}</span>
                  <span class="text-[10px] font-bold text-blue-400 tabular-nums w-6 text-center">{{ emp.proficient }}</span>
                  <span class="text-[10px] font-bold text-amber-400 tabular-nums w-6 text-center">{{ emp.needsImp }}</span>
                </div>

                <!-- Completion -->
                <div class="w-14 text-right shrink-0">
                  <p class="text-xs font-black tabular-nums" :class="emp.completionPercent >= 50 ? 'text-emerald-400' : emp.completionPercent >= 25 ? 'text-amber-400' : 'text-muted-foreground'">{{ emp.completionPercent }}%</p>
                  <p class="text-[8px] text-muted-foreground uppercase">assessed</p>
                </div>
              </div>
            </div>

            <!-- Legend -->
            <div class="px-5 py-3 border-t border-border/50 flex items-center gap-5 text-[10px] text-muted-foreground">
              <span class="flex items-center gap-1.5"><span class="size-2 rounded-full bg-emerald-500" /> Mastered</span>
              <span class="flex items-center gap-1.5"><span class="size-2 rounded-full bg-blue-500" /> Proficient</span>
              <span class="flex items-center gap-1.5"><span class="size-2 rounded-full bg-amber-500" /> Needs Improvement</span>
            </div>
          </div>

          <!-- Right column: Skill Gap + Supervisor Leaderboard -->
          <div class="xl:col-span-4 space-y-4">
            <!-- Skill Gap Analysis -->
            <div class="rounded-2xl border border-border/50 bg-card shadow-xs overflow-hidden">
              <div class="flex items-center gap-2.5 px-5 py-4 border-b border-border/50">
                <div class="size-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                  <Icon name="i-lucide-target" class="size-4.5 text-rose-400" />
                </div>
                <div>
                  <h3 class="text-sm font-bold">Skill Gaps</h3>
                  <p class="text-[10px] text-muted-foreground">Category mastery rates</p>
                </div>
              </div>
              <div class="p-4 space-y-3">
                <div v-for="cat in adminData.skillGapAnalysis" :key="cat.name" class="space-y-1">
                  <div class="flex items-center justify-between">
                    <span class="text-[11px] font-medium truncate max-w-[160px]">{{ cat.name }}</span>
                    <span class="text-[10px] font-bold tabular-nums" :class="cat.masteryRate >= 50 ? 'text-emerald-400' : cat.masteryRate >= 25 ? 'text-amber-400' : 'text-red-400'">{{ cat.masteryRate }}%</span>
                  </div>
                  <div class="h-1.5 w-full rounded-full bg-muted/40 overflow-hidden">
                    <div
                      class="h-full rounded-full transition-all duration-700"
                      :class="cat.masteryRate >= 50 ? 'bg-emerald-500' : cat.masteryRate >= 25 ? 'bg-amber-500' : 'bg-red-500'"
                      :style="{ width: `${Math.max(3, cat.masteryRate)}%` }"
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- Supervisor Leaderboard -->
            <div class="rounded-2xl border border-border/50 bg-card shadow-xs overflow-hidden">
              <div class="flex items-center gap-2.5 px-5 py-4 border-b border-border/50">
                <div class="size-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                  <Icon name="i-lucide-trophy" class="size-4.5 text-cyan-400" />
                </div>
                <div>
                  <h3 class="text-sm font-bold">Top Reviewers</h3>
                  <p class="text-[10px] text-muted-foreground">Supervisor activity ranking</p>
                </div>
              </div>
              <div class="divide-y divide-border/20">
                <div v-for="(sup, idx) in adminData.supervisorLeaderboard" :key="sup._id" class="flex items-center gap-2.5 px-4 py-2.5 hover:bg-muted/10 transition-colors">
                  <div
                    class="size-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0"
                    :class="idx === 0 ? 'bg-amber-500/20 text-amber-400' : idx === 1 ? 'bg-zinc-400/20 text-zinc-400' : idx === 2 ? 'bg-orange-600/20 text-orange-500' : 'bg-muted text-muted-foreground'"
                  >{{ Number(idx) + 1 }}</div>
                  <div class="size-7 rounded-full bg-muted overflow-hidden shrink-0">
                    <img v-if="sup.image" :src="sup.image" :alt="sup.name" class="size-full object-cover">
                    <div v-else class="size-full flex items-center justify-center text-[9px] font-bold">{{ sup.name?.charAt(0) }}</div>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-[11px] font-semibold truncate">{{ sup.name }}</p>
                    <p class="text-[9px] text-muted-foreground">{{ sup.uniqueEmployees }} employees</p>
                  </div>
                  <div class="text-right shrink-0">
                    <p class="text-xs font-bold text-cyan-400 tabular-nums">{{ sup.totalReviews }}</p>
                    <p class="text-[8px] text-muted-foreground">reviews</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Row 3: Monthly Trend + Recent Activity -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <!-- Monthly Review Trend -->
          <div class="rounded-2xl border border-border/50 bg-card shadow-xs overflow-hidden">
            <div class="flex items-center gap-2.5 px-5 py-4 border-b border-border/50">
              <div class="size-9 rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/20 flex items-center justify-center">
                <Icon name="i-lucide-trending-up" class="size-4.5 text-fuchsia-400" />
              </div>
              <div>
                <h3 class="text-sm font-bold">Review Velocity</h3>
                <p class="text-[10px] text-muted-foreground">Monthly skill reviews — last 6 months</p>
              </div>
            </div>
            <div class="p-5">
              <div class="flex items-end gap-3 h-40">
                <div
                  v-for="m in adminData.monthlyTrend"
                  :key="m.month"
                  class="flex-1 flex flex-col items-center gap-2 group/bar"
                >
                  <span class="text-[10px] font-bold tabular-nums text-muted-foreground opacity-0 group-hover/bar:opacity-100 transition-opacity">{{ m.reviews }}</span>
                  <div
                    class="w-full rounded-t-lg bg-gradient-to-t from-fuchsia-500 to-violet-500 group-hover/bar:from-fuchsia-400 group-hover/bar:to-violet-400 transition-all duration-500 cursor-default"
                    :style="{ height: `${Math.max(8, (m.reviews / maxMonthlyReviews) * 100)}%` }"
                  />
                  <span class="text-[9px] font-medium text-muted-foreground/60">{{ m.month }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Recent Review Activity -->
          <div class="rounded-2xl border border-border/50 bg-card shadow-xs overflow-hidden">
            <div class="flex items-center justify-between px-5 py-4 border-b border-border/50">
              <div class="flex items-center gap-2.5">
                <div class="size-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
                  <Icon name="i-lucide-clock" class="size-4.5 text-sky-400" />
                </div>
                <div>
                  <h3 class="text-sm font-bold">Recent Reviews</h3>
                  <p class="text-[10px] text-muted-foreground">Latest skill assessments</p>
                </div>
              </div>
            </div>
            <div class="divide-y divide-border/20 max-h-[340px] overflow-y-auto">
              <div v-for="(a, idx) in adminData.recentActivity" :key="idx" class="flex items-center gap-2.5 px-4 py-2.5 hover:bg-muted/10 transition-colors">
                <div class="size-7 rounded-full bg-muted overflow-hidden shrink-0">
                  <img v-if="a.reviewerImage" :src="a.reviewerImage" :alt="a.reviewerName" class="size-full object-cover">
                  <div v-else class="size-full flex items-center justify-center text-[9px] font-bold">{{ a.reviewerName?.charAt(0) }}</div>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-[11px]"><span class="font-semibold">{{ a.reviewerName }}</span> reviewed <span class="font-semibold">{{ a.employeeName }}</span></p>
                  <p class="text-[9px] text-muted-foreground truncate">{{ a.skillName }} · {{ a.categoryName }}</p>
                </div>
                <span class="inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded-full border shrink-0" :class="levelBadge(a.level)">{{ a.level }}</span>
                <span class="text-[9px] text-muted-foreground/50 shrink-0 tabular-nums hidden sm:inline">{{ timeAgo(a.createdAt) }}</span>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- ══════════════════════════════════════════════════════ -->
      <!-- SUPERVISOR VIEW — Review Tracker                     -->
      <!-- ══════════════════════════════════════════════════════ -->
      <template v-else-if="viewMode === 'supervisor' && supData">
        <!-- Hero Stats -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div class="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 p-6 relative overflow-hidden group hover:shadow-md transition-all">
            <div class="absolute top-0 right-0 p-4 opacity-15"><Icon name="i-lucide-users" class="size-16 text-cyan-500" /></div>
            <p class="text-xs font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">Employees Reviewed</p>
            <p class="text-3xl sm:text-4xl font-black text-foreground mt-2"><NumberFlow :value="supData.totalEmployeesReviewed" /></p>
            <p class="text-[10px] text-muted-foreground mt-1">unique team members</p>
          </div>
          <div class="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/10 to-violet-500/5 p-6 relative overflow-hidden group hover:shadow-md transition-all">
            <div class="absolute top-0 right-0 p-4 opacity-15"><Icon name="i-lucide-clipboard-check" class="size-16 text-violet-500" /></div>
            <p class="text-xs font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider">Total Reviews</p>
            <p class="text-3xl sm:text-4xl font-black text-foreground mt-2"><NumberFlow :value="supData.totalReviews" /></p>
            <p class="text-[10px] text-muted-foreground mt-1">skill assessments given</p>
          </div>
          <div class="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 p-6 relative overflow-hidden group hover:shadow-md transition-all">
            <div class="absolute top-0 right-0 p-4 opacity-15"><Icon name="i-lucide-flame" class="size-16 text-emerald-500" /></div>
            <p class="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">This Week</p>
            <p class="text-3xl sm:text-4xl font-black text-foreground mt-2"><NumberFlow :value="supData.reviewsThisWeek" /></p>
            <p class="text-[10px] text-muted-foreground mt-1">reviews in last 7 days</p>
          </div>
        </div>

        <!-- Employee Review Cards -->
        <div class="rounded-2xl border border-border/50 bg-card shadow-xs overflow-hidden">
          <div class="flex items-center justify-between px-5 py-4 border-b border-border/50">
            <div class="flex items-center gap-2.5">
              <div class="size-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                <Icon name="i-lucide-users" class="size-4.5 text-cyan-400" />
              </div>
              <div>
                <h3 class="text-sm font-bold">Employees You've Reviewed</h3>
                <p class="text-[10px] text-muted-foreground">Skill assessments you've given</p>
              </div>
            </div>
          </div>

          <div v-if="supData.employees.length === 0" class="flex flex-col items-center justify-center py-16 gap-3">
            <div class="size-16 rounded-full bg-muted flex items-center justify-center">
              <Icon name="i-lucide-clipboard-list" class="size-8 text-muted-foreground/40" />
            </div>
            <p class="text-sm text-muted-foreground">You haven't reviewed any employees yet</p>
            <NuxtLink to="/hr/employee-performance" class="text-xs text-primary hover:underline font-medium">Go to Employee Performance →</NuxtLink>
          </div>

          <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-5">
            <div
              v-for="emp in supData.employees"
              :key="emp._id"
              class="rounded-xl border border-border/50 bg-card p-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group cursor-pointer"
              @click="$router.push(`/my-profile?employee=${emp._id}`)"
            >
              <div class="flex items-center gap-3 mb-4">
                <div class="size-10 rounded-full bg-muted overflow-hidden border-2 border-background shadow shrink-0">
                  <img v-if="emp.image" :src="emp.image" :alt="emp.name" class="size-full object-cover">
                  <div v-else class="size-full flex items-center justify-center text-sm font-bold text-muted-foreground bg-primary/10">{{ emp.name?.charAt(0) || '?' }}</div>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-bold truncate group-hover:text-primary transition-colors">{{ emp.name }}</p>
                  <p class="text-[10px] text-muted-foreground">{{ emp.uniqueSkills }} skills · {{ emp.totalReviews }} reviews</p>
                </div>
              </div>
              <div class="flex items-center gap-2 mb-3">
                <div class="flex-1 h-2 rounded-full bg-muted/50 overflow-hidden flex">
                  <div class="h-full bg-emerald-500" :style="{ width: `${emp.totalReviews ? (emp.mastered / emp.totalReviews) * 100 : 0}%` }" />
                  <div class="h-full bg-blue-500" :style="{ width: `${emp.totalReviews ? (emp.proficient / emp.totalReviews) * 100 : 0}%` }" />
                  <div class="h-full bg-amber-500" :style="{ width: `${emp.totalReviews ? (emp.needsImp / emp.totalReviews) * 100 : 0}%` }" />
                </div>
              </div>
              <div class="grid grid-cols-3 gap-1 text-center">
                <div class="rounded-lg bg-emerald-500/10 py-1.5">
                  <p class="text-sm font-black text-emerald-500">{{ emp.mastered }}</p>
                  <p class="text-[8px] font-bold text-emerald-500/70 uppercase tracking-wider">Master</p>
                </div>
                <div class="rounded-lg bg-blue-500/10 py-1.5">
                  <p class="text-sm font-black text-blue-500">{{ emp.proficient }}</p>
                  <p class="text-[8px] font-bold text-blue-500/70 uppercase tracking-wider">Prof.</p>
                </div>
                <div class="rounded-lg bg-amber-500/10 py-1.5">
                  <p class="text-sm font-black text-amber-500">{{ emp.needsImp }}</p>
                  <p class="text-[8px] font-bold text-amber-500/70 uppercase tracking-wider">Needs</p>
                </div>
              </div>
              <p class="text-[9px] text-muted-foreground/60 mt-3 text-right tabular-nums">Last: {{ fmtDate(emp.lastReviewDate) }}</p>
            </div>
          </div>
        </div>

        <!-- Review Heatmap -->
        <div class="rounded-2xl border border-border/50 bg-card shadow-xs overflow-hidden">
          <div class="flex items-center gap-2.5 px-5 py-4 border-b border-border/50">
            <div class="size-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Icon name="i-lucide-calendar-days" class="size-4.5 text-emerald-400" />
            </div>
            <div>
              <h3 class="text-sm font-bold">Review Activity</h3>
              <p class="text-[10px] text-muted-foreground">Last 90 days — contribution grid</p>
            </div>
          </div>
          <div class="p-5">
            <div class="flex flex-wrap gap-[3px]">
              <div
                v-for="cell in heatmapGrid"
                :key="cell.date"
                class="size-3.5 rounded-[3px] transition-colors cursor-default group/hm relative"
                :class="heatmapColor(cell.count)"
              >
                <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-md bg-popover border border-border shadow-lg text-[10px] whitespace-nowrap opacity-0 group-hover/hm:opacity-100 transition-opacity pointer-events-none z-20">
                  <p class="font-semibold">{{ fmtDate(cell.date) }}</p>
                  <p class="text-emerald-400">{{ cell.count }} reviews</p>
                </div>
              </div>
            </div>
            <div class="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground">
              <span>Less</span>
              <div class="size-3 rounded-[3px] bg-muted/40" />
              <div class="size-3 rounded-[3px] bg-emerald-500/20" />
              <div class="size-3 rounded-[3px] bg-emerald-500/40" />
              <div class="size-3 rounded-[3px] bg-emerald-500/70" />
              <div class="size-3 rounded-[3px] bg-emerald-500" />
              <span>More</span>
            </div>
          </div>
        </div>
      </template>

      <!-- ══════════════════════════════════════════════════════ -->
      <!-- CREW MEMBER VIEW — My Progress                       -->
      <!-- ══════════════════════════════════════════════════════ -->
      <template v-else-if="viewMode === 'crew' && crewData">
        <!-- Hero Card -->
        <div class="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden relative">
          <div class="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent pointer-events-none" />
          <div class="px-6 py-6 sm:px-8 sm:py-8 flex flex-col sm:flex-row items-center gap-5 relative z-10">
            <div class="size-20 sm:size-24 rounded-full bg-background border-4 border-background shadow-lg overflow-hidden shrink-0">
              <img v-if="user?.profileImage" :src="user.profileImage" :alt="user.employee" class="size-full object-cover">
              <div v-else class="size-full bg-emerald-500/20 flex items-center justify-center text-2xl font-bold text-emerald-500">{{ user?.employee?.charAt(0).toUpperCase() || 'U' }}</div>
            </div>
            <div class="text-center sm:text-left flex-1">
              <h1 class="text-2xl sm:text-3xl font-bold tracking-tight">{{ user?.employee || 'Unknown' }}</h1>
              <p class="text-sm text-muted-foreground mt-1">{{ user?.email }}</p>
              <div class="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                <Icon name="i-lucide-briefcase" class="size-3.5" />
                {{ user?.position || 'Employee' }}
              </div>
            </div>
            <div class="shrink-0 text-center">
              <div class="relative size-24 sm:size-28">
                <svg class="size-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" class="text-muted/30" stroke-width="8" />
                  <circle cx="50" cy="50" r="42" fill="none" stroke="url(#crewGrad)" stroke-width="8" stroke-linecap="round" :stroke-dasharray="`${crewProgress * 2.64} 264`" class="transition-all duration-1000 ease-out" />
                  <defs>
                    <linearGradient id="crewGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stop-color="#10b981" />
                      <stop offset="100%" stop-color="#3b82f6" />
                    </linearGradient>
                  </defs>
                </svg>
                <div class="absolute inset-0 flex flex-col items-center justify-center">
                  <span class="text-xl sm:text-2xl font-black tabular-nums">{{ crewProgress }}%</span>
                  <span class="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">Complete</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Stat Cards -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="rounded-2xl border border-border/50 bg-card p-5 relative overflow-hidden group hover:shadow-md transition-all">
            <p class="text-xs font-medium text-muted-foreground">Total Skills</p>
            <p class="text-2xl sm:text-4xl font-black mt-1.5"><NumberFlow :value="crewData.totalSkills" /></p>
            <p class="text-[10px] text-muted-foreground mt-1">{{ crewData.summary.totalAssessed }} assessed</p>
          </div>
          <div class="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 relative overflow-hidden">
            <div class="absolute top-0 right-0 p-3 opacity-15"><Icon name="i-lucide-award" class="size-12 text-emerald-500" /></div>
            <p class="text-xs font-medium text-emerald-600 dark:text-emerald-400">Mastered</p>
            <p class="text-2xl sm:text-4xl font-black text-emerald-600 dark:text-emerald-400 mt-1.5"><NumberFlow :value="crewData.summary.mastered" /></p>
          </div>
          <div class="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5 relative overflow-hidden">
            <div class="absolute top-0 right-0 p-3 opacity-15"><Icon name="i-lucide-check-circle-2" class="size-12 text-blue-500" /></div>
            <p class="text-xs font-medium text-blue-600 dark:text-blue-400">Proficient</p>
            <p class="text-2xl sm:text-4xl font-black text-blue-600 dark:text-blue-400 mt-1.5"><NumberFlow :value="crewData.summary.proficient" /></p>
          </div>
          <div class="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 relative overflow-hidden">
            <div class="absolute top-0 right-0 p-3 opacity-15"><Icon name="i-lucide-arrow-up-circle" class="size-12 text-amber-500" /></div>
            <p class="text-xs font-medium text-amber-600 dark:text-amber-400">Needs Improvement</p>
            <p class="text-2xl sm:text-4xl font-black text-amber-600 dark:text-amber-400 mt-1.5"><NumberFlow :value="crewData.summary.needsImprovement" /></p>
          </div>
        </div>

        <!-- Category Breakdown -->
        <div class="rounded-2xl border border-border/50 bg-card shadow-xs overflow-hidden">
          <div class="flex items-center justify-between px-5 py-4 border-b border-border/50">
            <div class="flex items-center gap-2.5">
              <div class="size-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                <Icon name="i-lucide-layers" class="size-4.5 text-violet-400" />
              </div>
              <div>
                <h3 class="text-sm font-bold">Progress by Category</h3>
                <p class="text-[10px] text-muted-foreground">Your skill levels per category</p>
              </div>
            </div>
            <NuxtLink to="/my-profile" class="text-[10px] sm:text-xs text-primary hover:underline font-medium">Full profile →</NuxtLink>
          </div>
          <div class="divide-y divide-border/20">
            <div v-for="cat in crewData.categoryBreakdown" :key="cat.name" class="flex items-center gap-3 px-5 py-3">
              <div class="w-36 min-w-0 shrink-0">
                <p class="text-xs font-semibold truncate">{{ cat.name }}</p>
                <p class="text-[9px] text-muted-foreground">{{ cat.total }} skills</p>
              </div>
              <div class="flex-1 h-2.5 rounded-full bg-muted/30 overflow-hidden flex">
                <div class="h-full bg-emerald-500" :style="{ width: `${cat.total ? (cat.mastered / cat.total) * 100 : 0}%` }" />
                <div class="h-full bg-blue-500" :style="{ width: `${cat.total ? (cat.proficient / cat.total) * 100 : 0}%` }" />
                <div class="h-full bg-amber-500" :style="{ width: `${cat.total ? (cat.needsImp / cat.total) * 100 : 0}%` }" />
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                <span class="text-[10px] font-bold text-emerald-400 tabular-nums">{{ cat.mastered }}</span>
                <span class="text-[10px] text-muted-foreground/30">/</span>
                <span class="text-[10px] font-bold text-blue-400 tabular-nums">{{ cat.proficient }}</span>
                <span class="text-[10px] text-muted-foreground/30">/</span>
                <span class="text-[10px] font-bold text-amber-400 tabular-nums">{{ cat.needsImp }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Growth Timeline -->
        <div class="rounded-2xl border border-border/50 bg-card shadow-xs overflow-hidden">
          <div class="flex items-center gap-2.5 px-5 py-4 border-b border-border/50">
            <div class="size-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Icon name="i-lucide-trending-up" class="size-4.5 text-emerald-400" />
            </div>
            <div>
              <h3 class="text-sm font-bold">Growth Timeline</h3>
              <p class="text-[10px] text-muted-foreground">Your recent achievements</p>
            </div>
          </div>
          <div v-if="crewData.growthEvents.length === 0" class="flex flex-col items-center justify-center py-16 gap-3">
            <div class="size-16 rounded-full bg-muted flex items-center justify-center">
              <Icon name="i-lucide-sprout" class="size-8 text-muted-foreground/40" />
            </div>
            <p class="text-sm text-muted-foreground">No achievements yet</p>
          </div>
          <div v-else class="divide-y divide-border/20">
            <div v-for="(evt, idx) in crewData.growthEvents" :key="idx" class="flex items-center gap-3 px-5 py-3 hover:bg-muted/10 transition-colors">
              <div class="size-8 rounded-lg flex items-center justify-center shrink-0" :class="evt.level === 'Mastered' ? 'bg-emerald-500/15' : 'bg-blue-500/15'">
                <Icon :name="evt.level === 'Mastered' ? 'i-lucide-award' : 'i-lucide-check-circle-2'" class="size-4" :class="evt.level === 'Mastered' ? 'text-emerald-500' : 'text-blue-500'" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-xs font-medium"><span class="font-bold" :class="levelColor(evt.level)">{{ evt.level }}</span> — {{ evt.skillName }}</p>
                <p class="text-[10px] text-muted-foreground">{{ evt.categoryName }} · Reviewed by {{ evt.reviewerName }}</p>
              </div>
              <span class="text-[9px] text-muted-foreground/60 shrink-0 tabular-nums">{{ fmtDate(evt.date) }}</span>
            </div>
          </div>
        </div>
      </template>
      </div><!-- /content wrapper -->
    </template>

    <!-- ═══════════════════════════════════════════════════════ -->
    <!-- Employee Skill Detail Sheet                            -->
    <!-- ═══════════════════════════════════════════════════════ -->
    <Sheet v-model:open="showSkillSheet">
      <SheetContent class="sm:max-w-2xl lg:max-w-3xl w-full p-0 overflow-hidden flex flex-col">
        <!-- Sheet Header: Employee Hero -->
        <div v-if="selectedEmployee" class="relative border-b border-border/50 bg-gradient-to-r from-violet-500/5 via-fuchsia-500/3 to-transparent">
          <div class="absolute inset-0 bg-gradient-to-b from-transparent to-background/80 pointer-events-none" />
          <div class="relative z-10 p-6 flex items-center gap-4">
            <div class="size-14 rounded-2xl bg-muted overflow-hidden border-2 border-background shadow-lg shrink-0">
              <img v-if="selectedEmployee.image" :src="selectedEmployee.image" :alt="selectedEmployee.name" class="size-full object-cover">
              <div v-else class="size-full flex items-center justify-center text-lg font-bold text-muted-foreground bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10">
                {{ selectedEmployee.name?.charAt(0) }}
              </div>
            </div>
            <div class="flex-1 min-w-0">
              <SheetHeader class="p-0 space-y-0">
                <SheetTitle class="text-lg font-bold truncate">{{ selectedEmployee.name }}</SheetTitle>
                <SheetDescription class="text-xs">{{ selectedEmployee.position || 'Employee' }} · Skill Proficiency Report</SheetDescription>
              </SheetHeader>
            </div>
            <NuxtLink
              :to="`/my-profile?employee=${selectedEmployee._id}`"
              class="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              Full Profile →
            </NuxtLink>
          </div>

          <!-- Summary Stats Row -->
          <div v-if="employeeSkillData?.summary" class="relative z-10 px-6 pb-4 flex items-center gap-2">
            <div class="flex-1 grid grid-cols-4 gap-2">
              <button
                class="rounded-xl px-3 py-2 text-center transition-all duration-200 cursor-pointer border"
                :class="skillLevelFilter === 'Mastered'
                  ? 'bg-emerald-500/20 border-emerald-500/50 ring-2 ring-emerald-500/30 scale-[1.03]'
                  : 'bg-emerald-500/10 border-emerald-500/15 hover:bg-emerald-500/15 hover:scale-[1.02]'"
                @click="skillLevelFilter = skillLevelFilter === 'Mastered' ? 'all' : 'Mastered'"
              >
                <p class="text-lg font-black text-emerald-500 tabular-nums">{{ employeeSkillData.summary.mastered }}</p>
                <p class="text-[9px] font-bold text-emerald-500/70 uppercase tracking-wider">Mastered</p>
              </button>
              <button
                class="rounded-xl px-3 py-2 text-center transition-all duration-200 cursor-pointer border"
                :class="skillLevelFilter === 'Proficient'
                  ? 'bg-blue-500/20 border-blue-500/50 ring-2 ring-blue-500/30 scale-[1.03]'
                  : 'bg-blue-500/10 border-blue-500/15 hover:bg-blue-500/15 hover:scale-[1.02]'"
                @click="skillLevelFilter = skillLevelFilter === 'Proficient' ? 'all' : 'Proficient'"
              >
                <p class="text-lg font-black text-blue-500 tabular-nums">{{ employeeSkillData.summary.proficient }}</p>
                <p class="text-[9px] font-bold text-blue-500/70 uppercase tracking-wider">Proficient</p>
              </button>
              <button
                class="rounded-xl px-3 py-2 text-center transition-all duration-200 cursor-pointer border"
                :class="skillLevelFilter === 'Needs Improvement'
                  ? 'bg-amber-500/20 border-amber-500/50 ring-2 ring-amber-500/30 scale-[1.03]'
                  : 'bg-amber-500/10 border-amber-500/15 hover:bg-amber-500/15 hover:scale-[1.02]'"
                @click="skillLevelFilter = skillLevelFilter === 'Needs Improvement' ? 'all' : 'Needs Improvement'"
              >
                <p class="text-lg font-black text-amber-500 tabular-nums">{{ employeeSkillData.summary.needsImp }}</p>
                <p class="text-[9px] font-bold text-amber-500/70 uppercase tracking-wider">Needs Imp.</p>
              </button>
              <button
                class="rounded-xl px-3 py-2 text-center transition-all duration-200 cursor-pointer border"
                :class="skillLevelFilter === 'Unassessed'
                  ? 'bg-muted border-border ring-2 ring-primary/30 scale-[1.03]'
                  : 'bg-muted/60 border-border/30 hover:bg-muted/80 hover:scale-[1.02]'"
                @click="skillLevelFilter = skillLevelFilter === 'Unassessed' ? 'all' : 'Unassessed'"
              >
                <p class="text-lg font-black text-muted-foreground tabular-nums">{{ employeeSkillData.summary.unassessed }}</p>
                <p class="text-[9px] font-bold text-muted-foreground/70 uppercase tracking-wider">Unassessed</p>
              </button>
            </div>
          </div>
        </div>

        <!-- Loading State -->
        <div v-if="skillSheetLoading" class="flex-1 flex items-center justify-center">
          <div class="flex flex-col items-center gap-3">
            <div class="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p class="text-sm text-muted-foreground">Loading skills...</p>
          </div>
        </div>

        <!-- Filter Bar + Content -->
        <template v-else-if="employeeSkillData">
          <!-- Filter Tabs + Search -->
          <div class="border-b border-border/50 px-4 py-3 space-y-3 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
            <!-- Level filter tabs -->
            <div class="flex items-center gap-1 overflow-x-auto scrollbar-none">
              <button
                v-for="tab in skillLevelTabs"
                :key="tab.key"
                class="shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all border flex items-center gap-1.5"
                :class="skillLevelFilter === tab.key
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-muted/40 text-muted-foreground border-transparent hover:bg-muted hover:text-foreground'"
                @click="skillLevelFilter = tab.key as any"
              >
                {{ tab.label }}
                <span
                  class="tabular-nums text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                  :class="skillLevelFilter === tab.key ? 'bg-primary-foreground/20' : 'bg-background/60'"
                >{{ tab.count }}</span>
              </button>
            </div>
            <!-- Search -->
            <div class="relative">
              <Icon name="i-lucide-search" class="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <input
                v-model="skillSearch"
                type="text"
                placeholder="Search skills, categories..."
                class="w-full h-8 pl-9 pr-4 rounded-lg border border-input bg-background/50 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
              >
            </div>
          </div>

          <!-- Grouped Skills List -->
          <div class="flex-1 overflow-y-auto">
            <!-- Empty State -->
            <div v-if="filteredCategories.length === 0" class="flex flex-col items-center justify-center py-20 gap-3">
              <div class="size-16 rounded-full bg-muted flex items-center justify-center">
                <Icon name="i-lucide-search-x" class="size-8 text-muted-foreground/40" />
              </div>
              <p class="text-sm text-muted-foreground">No skills match your filter</p>
              <button class="text-xs text-primary hover:underline font-medium" @click="skillLevelFilter = 'all'; skillSearch = ''">
                Clear filters
              </button>
            </div>

            <!-- Category Groups -->
            <div v-for="cat in filteredCategories" :key="cat._id" class="border-b border-border/30 last:border-b-0">
              <!-- Category Header -->
              <button
                class="w-full flex items-center gap-3 px-5 py-3 hover:bg-muted/10 transition-colors text-left"
                @click="toggleCategory(cat._id)"
              >
                <Icon
                  name="i-lucide-chevron-right"
                  class="size-4 text-muted-foreground transition-transform duration-200 shrink-0"
                  :class="expandedCategories.has(cat._id) ? 'rotate-90' : ''"
                />
                <div class="flex-1 min-w-0">
                  <p class="text-xs font-bold">{{ cat.name }}</p>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                  <span v-if="cat.mastered" class="text-[10px] font-bold text-emerald-500 tabular-nums bg-emerald-500/10 px-1.5 py-0.5 rounded">{{ cat.mastered }}</span>
                  <span v-if="cat.proficient" class="text-[10px] font-bold text-blue-500 tabular-nums bg-blue-500/10 px-1.5 py-0.5 rounded">{{ cat.proficient }}</span>
                  <span v-if="cat.needsImp" class="text-[10px] font-bold text-amber-500 tabular-nums bg-amber-500/10 px-1.5 py-0.5 rounded">{{ cat.needsImp }}</span>
                  <span v-if="cat.unassessed" class="text-[10px] font-bold text-muted-foreground tabular-nums bg-muted/60 px-1.5 py-0.5 rounded">{{ cat.unassessed }}</span>
                </div>
              </button>

              <!-- Expanded Content -->
              <Transition name="expand">
                <div v-if="expandedCategories.has(cat._id)" class="overflow-hidden">
                  <div v-for="sub in cat.subCategories" :key="sub.name" class="pl-8">
                    <!-- Sub-category label -->
                    <div class="px-4 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest bg-muted/20">
                      {{ sub.name }}
                    </div>
                    <!-- Skill rows -->
                    <div class="divide-y divide-border/15">
                      <div
                        v-for="skill in sub.skills"
                        :key="skill._id"
                        class="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/10 transition-colors group/skill"
                      >
                        <!-- Level indicator -->
                        <div
                          class="size-7 rounded-lg flex items-center justify-center shrink-0 border"
                          :class="skillLevelStyle(skill.level)"
                        >
                          <Icon :name="skillLevelIcon(skill.level)" class="size-3.5" />
                        </div>

                        <!-- Skill name -->
                        <div class="flex-1 min-w-0">
                          <p class="text-xs font-medium truncate">
                            {{ skill.name }}
                            <span v-if="skill.isRequired" class="text-[9px] text-red-400 font-bold ml-1">REQUIRED</span>
                          </p>
                        </div>

                        <!-- Level badge -->
                        <span
                          class="shrink-0 inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border"
                          :class="skillLevelStyle(skill.level)"
                        >
                          {{ skill.level }}
                        </span>

                        <!-- Reviewer + Date -->
                        <div v-if="skill.reviewerName" class="hidden sm:flex items-center gap-1.5 shrink-0 text-right">
                          <div class="size-5 rounded-full bg-muted overflow-hidden shrink-0">
                            <img v-if="skill.reviewerImage" :src="skill.reviewerImage" :alt="skill.reviewerName" class="size-full object-cover">
                            <div v-else class="size-full flex items-center justify-center text-[8px] font-bold">{{ skill.reviewerName?.charAt(0) }}</div>
                          </div>
                          <div class="text-[9px] text-muted-foreground">
                            <p class="font-medium">{{ skill.reviewerName }}</p>
                            <p class="tabular-nums">{{ fmtDate(skill.reviewedAt) }}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Transition>
            </div>
          </div>

          <!-- Footer summary -->
          <div class="border-t border-border/50 px-5 py-3 bg-muted/20 flex items-center justify-between text-[10px] text-muted-foreground shrink-0">
            <span>Showing {{ filteredSkills.length }} of {{ employeeSkillData.summary.total }} skills</span>
            <div class="flex items-center gap-3">
              <span class="flex items-center gap-1"><span class="size-2 rounded-full bg-emerald-500" /> Mastered</span>
              <span class="flex items-center gap-1"><span class="size-2 rounded-full bg-blue-500" /> Proficient</span>
              <span class="flex items-center gap-1"><span class="size-2 rounded-full bg-amber-500" /> Needs Imp.</span>
              <span class="flex items-center gap-1"><span class="size-2 rounded-full bg-muted" /> Unassessed</span>
            </div>
          </div>
        </template>
      </SheetContent>
    </Sheet>
  </div>
</template>

<style scoped>
@keyframes shimmer {
  0%, 100% { transform: translateX(-100%); }
  50% { transform: translateX(100%); }
}

.dash-refresh-enter-active,
.dash-refresh-leave-active {
  transition: opacity 0.2s ease;
}
.dash-refresh-enter-from,
.dash-refresh-leave-to {
  opacity: 0;
}

.expand-enter-active,
.expand-leave-active {
  transition: all 0.25s ease;
  max-height: 2000px;
}
.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
}
</style>
