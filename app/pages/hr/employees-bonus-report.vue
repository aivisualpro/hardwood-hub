<script setup lang="ts">
import { toast } from 'vue-sonner'

const { setHeader } = usePageHeader()
setHeader({ title: 'Employees Bonus Report', icon: 'i-lucide-trophy', description: 'Track employee skill bonuses across all categories' })

// ─── Types ───────────────────────────────────────────────
interface Employee { _id: string; employee: string; profileImage: string; position: string; status: string }
interface SkillNode { _id: string; name: string; isRequired: boolean }
interface SubCatNode { _id: string; name: string; skills: SkillNode[]; bonusRules: any[] }
interface CatNode { _id: string; name: string; color: string; subCategories: SubCatNode[] }
interface PerfRecord { _id: string; employee: string; skill: string; currentSkillLevel: string; createdBy: string }

// ─── State ───────────────────────────────────────────────
const employees = ref<Employee[]>([])
const tree = ref<CatNode[]>([])
const perfRecords = ref<PerfRecord[]>([])
const generalRules = ref<any[]>([])
const loading = ref(true)
const searchQuery = ref('')
const expandedRows = ref<Set<string>>(new Set())
const sortBy = ref<'name' | 'bonus' | 'progress'>('bonus')
const sortDir = ref<'asc' | 'desc'>('desc')

// ─── Fetch ───────────────────────────────────────────────
async function fetchAll() {
  loading.value = true
  try {
    const [empRes, treeRes, perfRes, rulesRes] = await Promise.all([
      $fetch<{ success: boolean, data: Employee[] }>('/api/employees'),
      $fetch<{ success: boolean, data: CatNode[] }>('/api/skills/tree'),
      $fetch<{ success: boolean, data: PerfRecord[] }>('/api/performance'),
      $fetch<{ success: boolean, data: any[] }>('/api/skill-bonus'),
    ])
    employees.value = empRes.data.filter(e => e.status === 'Active')
    tree.value = treeRes.data
    perfRecords.value = perfRes.data
    generalRules.value = rulesRes.data
  } catch (e: any) {
    toast.error('Failed to load data', { description: e?.message })
  } finally {
    loading.value = false
  }
}
onMounted(fetchAll)

// ─── Helpers ─────────────────────────────────────────────
function levelIndex(lvl: string) {
  return ['Needs Improvement', 'Proficient', 'Mastered'].indexOf(lvl)
}

function evaluateRules(rulesToCheck: any[], skillsInSub: any[], skillReviewsMap: Map<string, any[]>): number {
  let maxBonus = 0
  for (const rule of rulesToCheck) {
    const requiredLevelIdx = levelIndex(rule.skillSet)
    const requiredTimes = rule.reviewedTimes || 1
    const isUnique = rule.supervisorCheck === 'Unique'

    let ruleMet = true
    for (const sk of skillsInSub) {
      const reviews = skillReviewsMap.get(sk._id) || []
      const qualifying = reviews.filter(r => levelIndex(r.currentSkillLevel) >= requiredLevelIdx)
      if (qualifying.length < requiredTimes) { ruleMet = false; break }
      if (isUnique) {
        const uniqueReviewers = new Set(qualifying.map(r => r.createdBy))
        if (uniqueReviewers.size < requiredTimes) { ruleMet = false; break }
      }
    }
    if (ruleMet) maxBonus = Math.max(maxBonus, rule.bonusAmount || 0)
  }
  return maxBonus
}

// ─── Per-Employee Bonus Report ───────────────────────────
interface EmpBonusData {
  employee: Employee
  totalBonus: number
  totalAssessed: number
  totalSkills: number
  proficientCount: number
  masteredCount: number
  categories: {
    id: string; name: string; bonus: number; assessed: number; total: number
    subCategories: {
      id: string; name: string; bonus: number; assessed: number; total: number
      hasOverride: boolean; proficient: number; mastered: number
    }[]
  }[]
}

const employeeBonusData = computed<EmpBonusData[]>(() => {
  if (!tree.value.length || !employees.value.length) return []

  const totalSystemSkills = tree.value.reduce((s, c) =>
    s + c.subCategories.reduce((s2, sub) => s2 + sub.skills.length, 0), 0)

  return employees.value.map(emp => {
    const empRecords = perfRecords.value.filter(r => r.employee === emp._id)

    // Build skill reviews map for this employee
    const skillReviewsMap = new Map<string, any[]>()
    for (const r of empRecords) {
      if (!skillReviewsMap.has(r.skill)) skillReviewsMap.set(r.skill, [])
      skillReviewsMap.get(r.skill)!.push(r)
    }

    // Highest perf per skill
    const highestMap = new Map<string, any>()
    for (const r of empRecords) {
      const existing = highestMap.get(r.skill)
      if (!existing || levelIndex(r.currentSkillLevel) > levelIndex(existing.currentSkillLevel)) {
        highestMap.set(r.skill, r)
      }
    }

    let totalBonus = 0
    let totalAssessed = 0
    let proficientCount = 0
    let masteredCount = 0

    const categories = tree.value.map(cat => {
      let catBonus = 0
      let catAssessed = 0
      let catTotal = 0

      const subCategories = cat.subCategories.map(sub => {
        const totalSub = sub.skills.length
        catTotal += totalSub
        let subProficient = 0
        let subMastered = 0
        let subAssessed = 0

        for (const sk of sub.skills) {
          const h = highestMap.get(sk._id)
          if (h) {
            subAssessed++
            if (h.currentSkillLevel === 'Mastered') subMastered++
            else if (h.currentSkillLevel === 'Proficient') subProficient++
          }
        }

        // Calculate bonus
        let subBonus = 0
        if (totalSub > 0) {
          const overrideRules = sub.bonusRules || []
          const rulesToUse = overrideRules.length > 0 ? overrideRules : generalRules.value
          subBonus = evaluateRules(rulesToUse, sub.skills, skillReviewsMap)
        }

        catBonus += subBonus
        catAssessed += subAssessed
        proficientCount += subProficient
        masteredCount += subMastered

        return {
          id: sub._id,
          name: sub.name,
          bonus: subBonus,
          assessed: subAssessed,
          total: totalSub,
          hasOverride: (sub.bonusRules || []).length > 0,
          proficient: subProficient,
          mastered: subMastered,
        }
      })

      totalBonus += catBonus
      totalAssessed += catAssessed

      return { id: cat._id, name: cat.name, bonus: catBonus, assessed: catAssessed, total: catTotal, subCategories }
    })

    return {
      employee: emp,
      totalBonus,
      totalAssessed,
      totalSkills: totalSystemSkills,
      proficientCount,
      masteredCount,
      categories,
    }
  })
})

// ─── Search & Sort ───────────────────────────────────────
const filteredData = computed(() => {
  let data = employeeBonusData.value
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    data = data.filter(d => d.employee.employee.toLowerCase().includes(q))
  }
  data = [...data].sort((a, b) => {
    let cmp = 0
    if (sortBy.value === 'bonus') cmp = a.totalBonus - b.totalBonus
    else if (sortBy.value === 'progress') cmp = a.totalAssessed - b.totalAssessed
    else cmp = a.employee.employee.localeCompare(b.employee.employee)
    return sortDir.value === 'desc' ? -cmp : cmp
  })
  return data
})

// ─── Summary ─────────────────────────────────────────────
const totalBonusAllEmployees = computed(() => employeeBonusData.value.reduce((s, d) => s + d.totalBonus, 0))
const avgBonus = computed(() => employeeBonusData.value.length ? totalBonusAllEmployees.value / employeeBonusData.value.length : 0)
const topEarner = computed(() => {
  if (!employeeBonusData.value.length) return null
  return [...employeeBonusData.value].sort((a, b) => b.totalBonus - a.totalBonus)[0]
})
const totalSystemSkills = computed(() => tree.value.reduce((s, c) =>
  s + c.subCategories.reduce((s2, sub) => s2 + sub.skills.length, 0), 0))

function toggleRow(empId: string) {
  if (expandedRows.value.has(empId)) expandedRows.value.delete(empId)
  else expandedRows.value.add(empId)
}

function toggleSort(col: 'name' | 'bonus' | 'progress') {
  if (sortBy.value === col) sortDir.value = sortDir.value === 'desc' ? 'asc' : 'desc'
  else { sortBy.value = col; sortDir.value = 'desc' }
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n)
}

// Category color palette
const catPalette = [
  { bg: 'bg-violet-500/10', text: 'text-violet-500', border: 'border-violet-500/20', dot: 'bg-violet-500', bar: 'bg-violet-500' },
  { bg: 'bg-cyan-500/10', text: 'text-cyan-500', border: 'border-cyan-500/20', dot: 'bg-cyan-500', bar: 'bg-cyan-500' },
  { bg: 'bg-emerald-500/10', text: 'text-emerald-500', border: 'border-emerald-500/20', dot: 'bg-emerald-500', bar: 'bg-emerald-500' },
  { bg: 'bg-orange-500/10', text: 'text-orange-500', border: 'border-orange-500/20', dot: 'bg-orange-500', bar: 'bg-orange-500' },
  { bg: 'bg-rose-500/10', text: 'text-rose-500', border: 'border-rose-500/20', dot: 'bg-rose-500', bar: 'bg-rose-500' },
  { bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/20', dot: 'bg-blue-500', bar: 'bg-blue-500' },
]
function pal(idx: number) { return catPalette[idx % catPalette.length]! }
</script>

<template>
  <div class="h-[calc(100vh-theme(spacing.16))] overflow-y-auto">
    <div class="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-[90rem] mx-auto">

      <!-- ═══════ SUMMARY CARDS ═══════ -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4">
        <!-- Total Bonus Payout -->
        <div class="rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-amber-500/5 p-3 sm:p-5 relative overflow-hidden group">
          <div class="absolute top-0 right-0 p-2 sm:p-3 opacity-15"><Icon name="i-lucide-trophy" class="size-14 sm:size-20 text-amber-500" /></div>
          <div class="relative z-10">
            <p class="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-amber-600/70 dark:text-amber-400/70">Total Payout</p>
            <p class="text-xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 mt-1 sm:mt-2 tabular-nums">{{ fmt(totalBonusAllEmployees) }}</p>
            <p class="text-[9px] sm:text-[10px] text-amber-600/50 dark:text-amber-400/50 mt-0.5 sm:mt-1">All employees combined</p>
          </div>
        </div>

        <!-- Average Bonus -->
        <div class="rounded-xl border border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-blue-500/5 p-3 sm:p-5 relative overflow-hidden group">
          <div class="absolute top-0 right-0 p-2 sm:p-3 opacity-15"><Icon name="i-lucide-bar-chart-3" class="size-14 sm:size-20 text-blue-500" /></div>
          <div class="relative z-10">
            <p class="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-blue-600/70 dark:text-blue-400/70">Avg / Employee</p>
            <p class="text-xl sm:text-3xl font-black text-blue-600 dark:text-blue-400 mt-1 sm:mt-2 tabular-nums">{{ fmt(avgBonus) }}</p>
            <p class="text-[9px] sm:text-[10px] text-blue-600/50 dark:text-blue-400/50 mt-0.5 sm:mt-1">{{ employees.length }} active</p>
          </div>
        </div>

        <!-- Top Earner -->
        <div class="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 p-3 sm:p-5 relative overflow-hidden group">
          <div class="absolute top-0 right-0 p-2 sm:p-3 opacity-15"><Icon name="i-lucide-crown" class="size-14 sm:size-20 text-emerald-500" /></div>
          <div class="relative z-10">
            <p class="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-emerald-600/70 dark:text-emerald-400/70">Top Earner</p>
            <p class="text-sm sm:text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1 sm:mt-2 truncate">{{ topEarner?.employee.employee || '—' }}</p>
            <p class="text-[9px] sm:text-[10px] text-emerald-600/50 dark:text-emerald-400/50 mt-0.5 sm:mt-1">{{ topEarner ? fmt(topEarner.totalBonus) : '$0.00' }}</p>
          </div>
        </div>

        <!-- Total Skills -->
        <div class="rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-500/10 to-violet-500/5 p-3 sm:p-5 relative overflow-hidden group">
          <div class="absolute top-0 right-0 p-2 sm:p-3 opacity-15"><Icon name="i-lucide-layers" class="size-14 sm:size-20 text-violet-500" /></div>
          <div class="relative z-10">
            <p class="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-violet-600/70 dark:text-violet-400/70">Categories</p>
            <p class="text-xl sm:text-3xl font-black text-violet-600 dark:text-violet-400 mt-1 sm:mt-2 tabular-nums">{{ tree.length }}</p>
            <p class="text-[9px] sm:text-[10px] text-violet-600/50 dark:text-violet-400/50 mt-0.5 sm:mt-1">{{ totalSystemSkills }} skills</p>
          </div>
        </div>
      </div>

      <!-- ═══════ TOOLBAR ═══════ -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
        <div class="relative flex-1 sm:max-w-sm">
          <Icon name="i-lucide-search" class="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-3.5 sm:size-4" />
          <Input v-model="searchQuery" placeholder="Search employees..." class="pl-8 sm:pl-9 h-9 bg-muted/50 text-xs sm:text-sm" />
        </div>
        <div class="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-muted-foreground overflow-x-auto">
          <span class="font-medium shrink-0">Sort:</span>
          <button
            v-for="col in [{ key: 'bonus', label: 'Bonus' }, { key: 'progress', label: 'Progress' }, { key: 'name', label: 'Name' }]"
            :key="col.key"
            class="px-2.5 sm:px-3 py-1.5 rounded-lg border transition-all shrink-0"
            :class="sortBy === col.key
              ? 'bg-primary/10 text-primary border-primary/30 font-semibold'
              : 'border-border/40 hover:bg-muted hover:text-foreground'"
            @click="toggleSort(col.key as any)"
          >
            {{ col.label }}
            <Icon
              v-if="sortBy === col.key"
              :name="sortDir === 'desc' ? 'i-lucide-arrow-down' : 'i-lucide-arrow-up'"
              class="inline-block size-3 ml-0.5"
            />
          </button>
        </div>
      </div>

      <!-- ═══════ LOADING ═══════ -->
      <div v-if="loading" class="space-y-3 sm:space-y-4">
        <div v-for="i in 5" :key="i" class="h-16 sm:h-20 rounded-xl bg-muted/50 animate-pulse border border-border/30" />
      </div>

      <!-- ═══════ MAIN TABLE ═══════ -->
      <div v-else-if="filteredData.length" class="rounded-xl border border-border/50 overflow-hidden shadow-sm bg-card">
        <!-- Table header (desktop only) -->
        <div class="hidden sm:grid grid-cols-[1fr_120px_160px_120px_80px] gap-2 px-5 py-3 bg-muted/30 border-b border-border/30 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span>Employee</span>
          <span class="text-center">Progress</span>
          <span class="text-center">Skill Breakdown</span>
          <span class="text-right">Bonus Earned</span>
          <span class="text-center">Details</span>
        </div>

        <!-- Rows -->
        <div v-for="(row, idx) in filteredData" :key="row.employee._id" class="border-b border-border/20 last:border-0">
          <!-- Desktop row -->
          <div
            class="hidden sm:grid grid-cols-[1fr_120px_160px_120px_80px] gap-2 px-5 py-4 items-center transition-colors hover:bg-muted/10 cursor-pointer group"
            @click="toggleRow(row.employee._id)"
          >
            <!-- Employee info -->
            <div class="flex items-center gap-3 min-w-0">
              <div class="relative shrink-0">
                <img
                  v-if="row.employee.profileImage"
                  :src="row.employee.profileImage"
                  :alt="row.employee.employee"
                  class="size-10 rounded-full object-cover ring-2 ring-background shadow-sm"
                />
                <div
                  v-else
                  class="size-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary ring-2 ring-background shadow-sm"
                >
                  {{ row.employee.employee.charAt(0).toUpperCase() }}
                </div>
                <!-- Rank badge for top 3 -->
                <div
                  v-if="idx < 3 && sortBy === 'bonus' && sortDir === 'desc'"
                  class="absolute -top-1 -right-1 size-5 rounded-full flex items-center justify-center text-[9px] font-black shadow-md ring-1 ring-background"
                  :class="idx === 0 ? 'bg-amber-500 text-white' : idx === 1 ? 'bg-gray-300 text-gray-700' : 'bg-orange-400 text-white'"
                >
                  {{ idx + 1 }}
                </div>
              </div>
              <div class="min-w-0">
                <p class="text-sm font-semibold truncate">{{ row.employee.employee }}</p>
                <p class="text-[10px] text-muted-foreground truncate">{{ row.employee.position || 'Employee' }}</p>
              </div>
            </div>

            <!-- Progress bar -->
            <div class="flex flex-col items-center gap-1.5">
              <div class="w-full h-2 rounded-full bg-muted overflow-hidden flex">
                <div class="h-full bg-emerald-500 transition-all duration-700" :style="{ width: `${row.totalSkills ? (row.masteredCount / row.totalSkills) * 100 : 0}%` }" />
                <div class="h-full bg-blue-500 transition-all duration-700" :style="{ width: `${row.totalSkills ? (row.proficientCount / row.totalSkills) * 100 : 0}%` }" />
              </div>
              <span class="text-[10px] text-muted-foreground font-medium tabular-nums">
                {{ row.totalAssessed }}/{{ row.totalSkills }}
              </span>
            </div>

            <!-- Skill breakdown -->
            <div class="flex items-center justify-center gap-3">
              <div class="flex items-center gap-1">
                <span class="size-2 rounded-full bg-emerald-500" />
                <span class="text-xs font-semibold text-emerald-500 tabular-nums">{{ row.masteredCount }}</span>
              </div>
              <div class="flex items-center gap-1">
                <span class="size-2 rounded-full bg-blue-500" />
                <span class="text-xs font-semibold text-blue-500 tabular-nums">{{ row.proficientCount }}</span>
              </div>
              <div class="flex items-center gap-1">
                <span class="size-2 rounded-full bg-muted-foreground/30" />
                <span class="text-xs font-medium text-muted-foreground tabular-nums">{{ row.totalAssessed - row.masteredCount - row.proficientCount }}</span>
              </div>
            </div>

            <!-- Bonus amount -->
            <div class="text-right">
              <div v-if="row.totalBonus > 0" class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 font-bold border border-amber-500/20 text-sm tabular-nums">
                <Icon name="i-lucide-coins" class="size-3.5" />
                {{ fmt(row.totalBonus) }}
              </div>
              <span v-else class="text-xs text-muted-foreground/40 font-medium">$0.00</span>
            </div>

            <!-- Expand toggle -->
            <div class="flex items-center justify-center">
              <button class="size-7 rounded-lg flex items-center justify-center hover:bg-muted/60 transition-all">
                <Icon
                  name="i-lucide-chevron-right"
                  class="size-4 text-muted-foreground transition-transform duration-200"
                  :class="expandedRows.has(row.employee._id) ? 'rotate-90' : ''"
                />
              </button>
            </div>
          </div>

          <!-- Mobile card row -->
          <div
            class="sm:hidden px-3 py-3 transition-colors hover:bg-muted/10 cursor-pointer"
            @click="toggleRow(row.employee._id)"
          >
            <!-- Top: Avatar + Name + Bonus -->
            <div class="flex items-center gap-2.5">
              <div class="relative shrink-0">
                <img
                  v-if="row.employee.profileImage"
                  :src="row.employee.profileImage"
                  :alt="row.employee.employee"
                  class="size-10 rounded-full object-cover ring-2 ring-background shadow-sm"
                />
                <div
                  v-else
                  class="size-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary ring-2 ring-background shadow-sm"
                >
                  {{ row.employee.employee.charAt(0).toUpperCase() }}
                </div>
                <div
                  v-if="idx < 3 && sortBy === 'bonus' && sortDir === 'desc'"
                  class="absolute -top-1 -right-1 size-4 rounded-full flex items-center justify-center text-[8px] font-black shadow-md ring-1 ring-background"
                  :class="idx === 0 ? 'bg-amber-500 text-white' : idx === 1 ? 'bg-gray-300 text-gray-700' : 'bg-orange-400 text-white'"
                >
                  {{ idx + 1 }}
                </div>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold truncate">{{ row.employee.employee }}</p>
                <p class="text-[10px] text-muted-foreground">{{ row.employee.position || 'Employee' }}</p>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <div v-if="row.totalBonus > 0" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-bold border border-amber-500/20 text-xs tabular-nums">
                  <Icon name="i-lucide-coins" class="size-3" />
                  {{ fmt(row.totalBonus) }}
                </div>
                <span v-else class="text-[10px] text-muted-foreground/40">$0.00</span>
                <Icon
                  name="i-lucide-chevron-right"
                  class="size-4 text-muted-foreground transition-transform duration-200 shrink-0"
                  :class="expandedRows.has(row.employee._id) ? 'rotate-90' : ''"
                />
              </div>
            </div>
            <!-- Bottom: Progress bar + skill dots -->
            <div class="flex items-center gap-2.5 mt-2 pl-[50px]">
              <div class="flex-1 h-1.5 rounded-full bg-muted overflow-hidden flex">
                <div class="h-full bg-emerald-500 transition-all duration-700" :style="{ width: `${row.totalSkills ? (row.masteredCount / row.totalSkills) * 100 : 0}%` }" />
                <div class="h-full bg-blue-500 transition-all duration-700" :style="{ width: `${row.totalSkills ? (row.proficientCount / row.totalSkills) * 100 : 0}%` }" />
              </div>
              <span class="text-[9px] text-muted-foreground tabular-nums shrink-0">{{ row.totalAssessed }}/{{ row.totalSkills }}</span>
              <div class="flex items-center gap-2 shrink-0">
                <div class="flex items-center gap-0.5">
                  <span class="size-1.5 rounded-full bg-emerald-500" />
                  <span class="text-[9px] font-semibold text-emerald-500 tabular-nums">{{ row.masteredCount }}</span>
                </div>
                <div class="flex items-center gap-0.5">
                  <span class="size-1.5 rounded-full bg-blue-500" />
                  <span class="text-[9px] font-semibold text-blue-500 tabular-nums">{{ row.proficientCount }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- ═══════ EXPANDED DETAIL ═══════ -->
          <Transition
            enter-active-class="transition-all duration-300 ease-out"
            enter-from-class="opacity-0 max-h-0"
            enter-to-class="opacity-100 max-h-[2000px]"
            leave-active-class="transition-all duration-200 ease-in"
            leave-from-class="opacity-100 max-h-[2000px]"
            leave-to-class="opacity-0 max-h-0"
          >
            <div v-if="expandedRows.has(row.employee._id)" class="overflow-hidden">
              <div class="px-3 sm:px-5 pb-3 sm:pb-5 pt-0">
                <div class="rounded-xl border border-border/40 bg-muted/10 overflow-hidden">
                  <!-- Category sections -->
                  <div v-for="(cat, catIdx) in row.categories" :key="cat.id" class="border-b border-border/20 last:border-0">
                    <!-- Category header -->
                    <div class="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 bg-muted/20">
                      <div class="flex items-center gap-2 sm:gap-2.5 min-w-0">
                        <div class="size-5 sm:size-6 rounded-md flex items-center justify-center border shrink-0" :class="[pal(catIdx).bg, pal(catIdx).border]">
                          <Icon name="i-lucide-layers" class="size-2.5 sm:size-3" :class="pal(catIdx).text" />
                        </div>
                        <span class="text-xs sm:text-sm font-semibold truncate" :class="pal(catIdx).text">{{ cat.name }}</span>
                        <span class="text-[9px] sm:text-[10px] text-muted-foreground shrink-0">{{ cat.assessed }}/{{ cat.total }}</span>
                      </div>
                      <div v-if="cat.bonus > 0" class="text-[10px] sm:text-xs font-bold text-amber-500 tabular-nums shrink-0">
                        +{{ fmt(cat.bonus) }}
                      </div>
                    </div>

                    <!-- Sub-category rows -->
                    <div class="divide-y divide-border/10">
                      <div
                        v-for="sub in cat.subCategories"
                        :key="sub.id"
                        class="flex flex-col sm:grid sm:grid-cols-[1fr_80px_60px_60px_90px] gap-1 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 sm:items-center text-xs hover:bg-muted/10 transition-colors"
                      >
                        <!-- Sub name -->
                        <div class="flex items-center gap-2 min-w-0">
                          <span class="size-1.5 rounded-full shrink-0" :class="pal(catIdx).dot" />
                          <span class="truncate font-medium text-[11px] sm:text-xs">{{ sub.name }}</span>
                          <span v-if="sub.hasOverride" class="inline-flex items-center gap-0.5 text-[7px] sm:text-[8px] font-semibold px-1 py-0.5 rounded bg-violet-500/10 text-violet-500 border border-violet-500/20 shrink-0">
                            <Icon name="i-lucide-sparkles" class="size-1.5 sm:size-2" />
                            Custom
                          </span>
                        </div>
                        <!-- Mobile: stats inline -->
                        <div class="flex items-center gap-3 sm:contents pl-3.5">
                          <div class="text-[10px] sm:text-xs text-muted-foreground tabular-nums sm:text-center">
                            {{ sub.assessed }}/{{ sub.total }}
                          </div>
                          <div class="sm:text-center">
                            <span v-if="sub.proficient" class="font-semibold text-blue-500 tabular-nums text-[10px] sm:text-xs">P:{{ sub.proficient }}</span>
                            <span v-else class="text-muted-foreground/30 text-[10px] sm:text-xs">-</span>
                          </div>
                          <div class="sm:text-center">
                            <span v-if="sub.mastered" class="font-semibold text-emerald-500 tabular-nums text-[10px] sm:text-xs">M:{{ sub.mastered }}</span>
                            <span v-else class="text-muted-foreground/30 text-[10px] sm:text-xs">-</span>
                          </div>
                          <div class="sm:text-right ml-auto sm:ml-0">
                            <span v-if="sub.bonus > 0" class="inline-flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-bold border border-amber-500/20 tabular-nums text-[10px] sm:text-xs">
                              <Icon name="i-lucide-coins" class="size-2 sm:size-2.5" />
                              {{ fmt(sub.bonus) }}
                            </span>
                            <span v-else class="text-muted-foreground/30 text-[10px]">—</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Expanded footer -->
                  <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-3 sm:px-4 py-2.5 sm:py-3 bg-muted/30 border-t border-border/30">
                    <Button variant="ghost" size="sm" class="text-xs gap-1.5 h-8" @click="navigateTo(`/my-profile?employee=${row.employee._id}`)">
                      <Icon name="i-lucide-eye" class="size-3.5" />
                      View Profile
                    </Button>
                    <div class="flex items-center gap-2 text-xs pl-2 sm:pl-0">
                      <span class="text-muted-foreground">Total:</span>
                      <span class="font-bold text-amber-500 text-sm tabular-nums">{{ fmt(row.totalBonus) }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>

      <!-- ═══════ EMPTY ═══════ -->
      <div v-else-if="!loading" class="flex flex-col items-center justify-center py-16 sm:py-24 text-center px-4">
        <div class="size-16 sm:size-20 rounded-full bg-gradient-to-br from-amber-500/20 to-amber-500/5 border border-amber-500/20 flex items-center justify-center mb-4 sm:mb-5">
          <Icon name="i-lucide-trophy" class="size-7 sm:size-10 text-amber-500" />
        </div>
        <h3 class="text-lg sm:text-xl font-bold mb-2">No bonus data available</h3>
        <p class="text-xs sm:text-sm text-muted-foreground max-w-sm">
          Start assessing employees on the Employee Performance page to see bonus calculations here.
        </p>
      </div>

      <!-- ═══════ LEGEND ═══════ -->
      <div v-if="!loading && filteredData.length" class="flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-[9px] sm:text-[10px] text-muted-foreground py-2">
        <div class="flex items-center gap-1.5">
          <span class="size-2 sm:size-2.5 rounded-full bg-emerald-500" />
          Mastered
        </div>
        <div class="flex items-center gap-1.5">
          <span class="size-2 sm:size-2.5 rounded-full bg-blue-500" />
          Proficient
        </div>
        <div class="flex items-center gap-1.5">
          <span class="size-2 sm:size-2.5 rounded-full bg-muted-foreground/30" />
          Needs Imp.
        </div>
        <div class="flex items-center gap-1.5">
          <span class="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-violet-500/10 text-violet-500 border border-violet-500/20 text-[7px] sm:text-[8px] font-semibold">
            <Icon name="i-lucide-sparkles" class="size-1.5 sm:size-2" />
            Custom
          </span>
          Override rules
        </div>
      </div>
    </div>
  </div>
</template>
