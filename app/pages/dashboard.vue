<script setup lang="ts">
import NumberFlow from '@number-flow/vue'

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

// ─── Data ─────────────────────────────────────────────────
const stats = ref<any>(null)
const loading = ref(true)

async function fetchStats() {
  loading.value = true
  try {
    const res = await $fetch<{ success: boolean, data: any }>('/api/admin-dashboard/stats')
    stats.value = res.data
  }
  catch { /* handled */ }
  finally { loading.value = false }
}

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
</script>

<template>
  <div class="max-w-[100rem] mx-auto space-y-6">
    <!-- Loading Skeleton -->
    <template v-if="loading">
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div v-for="i in 4" :key="i" class="h-32 rounded-2xl bg-card border animate-pulse" />
      </div>
    </template>

    <template v-if="stats && !loading">
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
                @click="$router.push(`/my-profile?employee=${emp._id}`)"
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
    </template>
  </div>
</template>
