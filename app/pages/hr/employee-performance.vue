<script setup lang="ts">
import { toast } from 'vue-sonner'

const { setHeader } = usePageHeader()
setHeader({ title: 'Employee Performance', icon: 'i-lucide-bar-chart-3', description: 'Track and manage employee skill assessments' })

// ─── Types ───────────────────────────────────────────────
interface Employee { _id: string; employee: string; profileImage: string }
interface SkillNode { _id: string; name: string; isRequired: boolean; category: string; subCategory: string }
interface BonusRule { skillSet: string; reviewedTimes: number; supervisorCheck: string; bonusAmount: number }
interface SubCatNode { _id: string; name: string; category: string; predecessor: string; predecessorName: string; bonusRules: BonusRule[]; skills: SkillNode[] }
interface CatNode { _id: string; name: string; color: string; subCategories: SubCatNode[] }
interface PerfRecord {
  _id: string; employee: string; employeeName: string; employeeImage: string
  category: string; categoryName: string; subCategory: string; subCategoryName: string
  skill: string; skillName: string; currentSkillLevel: string
  createdAt: string; createdBy: string; createdByName: string
}

const LEVEL_STEPS = ['Needs Improvement', 'Proficient', 'Mastered'] as const

// ─── State ───────────────────────────────────────────────
const employees = ref<Employee[]>([])
const tree = ref<CatNode[]>([])
const perfRecords = ref<PerfRecord[]>([])
const loading = ref(true)
const selectedEmployeeId = ref<string | null>(null)
const expandedCats = ref<Set<string>>(new Set())
const expandedSubs = ref<Set<string>>(new Set())
const searchQuery = ref('')
const activeView = ref<'tree' | 'table'>('tree')
const minProgressionLevel = ref('Proficient')
const savingSettings = ref(false)

const userCookie = useCookie<{ _id: string, employee: string, email: string } | null>('hardwood_user')
const currentUserId = computed(() => userCookie.value?._id)

// ─── Fetch all data ──────────────────────────────────────
async function fetchAll() {
  loading.value = true
  try {
    const [empRes, treeRes, perfRes, settingsRes] = await Promise.all([
      $fetch<{ success: boolean, data: Employee[] }>('/api/employees'),
      $fetch<{ success: boolean, data: CatNode[] }>('/api/skills/tree'),
      $fetch<{ success: boolean, data: PerfRecord[] }>('/api/performance'),
      $fetch<{ success: boolean, data: Record<string, any> }>('/api/app-settings'),
    ])
    employees.value = empRes.data
    tree.value = treeRes.data
    perfRecords.value = perfRes.data
    if (settingsRes.data?.minSkillProgressionLevel) {
      minProgressionLevel.value = settingsRes.data.minSkillProgressionLevel
    }
    // Auto-select employee from query param or default to first
    const route = useRoute()
    const queryEmpId = route.query.employee as string | undefined
    if (empRes.data.length && !selectedEmployeeId.value) {
      if (queryEmpId && empRes.data.some(e => e._id === queryEmpId)) {
        selectedEmployeeId.value = queryEmpId
      } else {
        selectedEmployeeId.value = empRes.data[0]!._id
      }
    }
    // Expand first category by default
    if (treeRes.data.length) {
      expandedCats.value.add(treeRes.data[0]!._id)
      const firstSub = treeRes.data[0]!.subCategories[0]
      if (firstSub) expandedSubs.value.add(firstSub._id)
    }
  }
  catch (e: any) {
    toast.error('Failed to load data', { description: e?.message })
  }
  finally { loading.value = false }
}
onMounted(fetchAll)

// ─── Settings: save minimum progression level ────────────
async function saveMinLevel(level: string) {
  minProgressionLevel.value = level
  savingSettings.value = true
  try {
    await $fetch('/api/app-settings', {
      method: 'POST',
      body: { key: 'minSkillProgressionLevel', value: level, description: 'Minimum skill level required to unlock predecessor sub-categories' },
    })
    toast.success('Progression threshold updated', { description: `Set to "${level}"`, duration: 2000 })
  }
  catch (e: any) {
    toast.error('Failed to save setting', { description: e?.message })
  }
  finally { savingSettings.value = false }
}

// ─── Derived ─────────────────────────────────────────────
const selectedEmployee = computed(() =>
  employees.value.find(e => e._id === selectedEmployeeId.value) ?? null,
)

// Highest perf records for locking/progress calculations
const highestPerfMap = computed(() => {
  const map = new Map<string, PerfRecord>()
  for (const r of perfRecords.value) {
    if (r.employee === selectedEmployeeId.value) {
      const existing = map.get(r.skill)
      if (!existing || levelIndex(r.currentSkillLevel) > levelIndex(existing.currentSkillLevel)) {
         map.set(r.skill, r)
      }
    }
  }
  return map
})

// Current user's perf records per skill per level — supports progression timeline
// Key: `${skillId}::${level}`, Value: PerfRecord
const myPerfLevelMap = computed(() => {
  const map = new Map<string, PerfRecord>()
  const myId = currentUserId.value
  for (const r of perfRecords.value) {
    if (r.employee === selectedEmployeeId.value && r.createdBy === myId) {
      const key = `${r.skill}::${r.currentSkillLevel}`
      // Keep the latest record per skill+level
      const existing = map.get(key)
      if (!existing || new Date(r.createdAt) > new Date(existing.createdAt)) {
        map.set(key, r)
      }
    }
  }
  return map
})

// For backward compat: keep a myPerfMap that returns the highest level per skill for this reviewer
const myPerfMap = computed(() => {
  const map = new Map<string, PerfRecord>()
  const myId = currentUserId.value
  for (const r of perfRecords.value) {
    if (r.employee === selectedEmployeeId.value && r.createdBy === myId) {
      const existing = map.get(r.skill)
      if (!existing || levelIndex(r.currentSkillLevel) > levelIndex(existing.currentSkillLevel)) {
        map.set(r.skill, r)
      }
    }
  }
  return map
})

// All records for a given skill for the selected employee from all reviewers, grouped by level
const allRecordsForSkill = computed(() => {
  const map = new Map<string, PerfRecord[]>()
  for (const r of perfRecords.value) {
    if (r.employee === selectedEmployeeId.value) {
      if (!map.has(r.skill)) map.set(r.skill, [])
      map.get(r.skill)!.push(r)
    }
  }
  return map
})

// Helper: check if a specific level was marked by the current user for a skill
function hasMyLevel(skillId: string, level: string): boolean {
  return myPerfLevelMap.value.has(`${skillId}::${level}`)
}

// Helper: get the date when the current user marked a specific level
function getMyLevelDate(skillId: string, level: string): string | null {
  const rec = myPerfLevelMap.value.get(`${skillId}::${level}`)
  return rec ? rec.createdAt : null
}

// Helper: check if the current user's Proficient was on a prior date (enabling Mastered)
function canMarkMastered(skillId: string): boolean {
  const proficientDate = getMyLevelDate(skillId, 'Proficient')
  if (!proficientDate) return false
  // Compare dates (not times)
  const profDateStr = new Date(proficientDate).toISOString().slice(0, 10)
  const todayStr = new Date().toISOString().slice(0, 10)
  return profDateStr < todayStr
}

// Helper: get the reason why Mastered is disabled
function getMasteredDisabledReason(skillId: string): string {
  if (!hasMyLevel(skillId, 'Proficient')) return 'Must be marked as Proficient first'
  if (!canMarkMastered(skillId)) return 'Can mark Mastered starting tomorrow'
  return ''
}

// Count of uniquely assessed skills for an employee
const empAssessedCount = computed(() => {
  const map = new Map<string, Set<string>>()
  for (const r of perfRecords.value) {
    if (!map.has(r.employee)) map.set(r.employee, new Set())
    map.get(r.employee)!.add(r.skill)
  }
  const countMap = new Map<string, number>()
  for (const [emp, skills] of map.entries()) {
    countMap.set(emp, skills.size)
  }
  return countMap
})

// Total skills across tree
const totalSkills = computed(() =>
  tree.value.reduce((sum, cat) =>
    sum + cat.subCategories.reduce((s2, sub) => s2 + sub.skills.length, 0), 0),
)

// ─── Signal-style overview stats ─────────────────────────
const overallStats = computed(() => {
  const c = { mastered: 0, proficient: 0, needs: 0, unreviewed: 0 }
  for (const cat of tree.value) {
    for (const sub of cat.subCategories) {
      for (const sk of sub.skills) {
        const rec = highestPerfMap.value.get(sk._id)
        if (!rec) c.unreviewed++
        else if (rec.currentSkillLevel === 'Mastered') c.mastered++
        else if (rec.currentSkillLevel === 'Proficient') c.proficient++
        else c.needs++
      }
    }
  }
  return c
})
const overallPct = computed(() =>
  totalSkills.value ? Math.round(((overallStats.value.mastered + overallStats.value.proficient) / totalSkills.value) * 100) : 0,
)
function getSkillStatus(skillId: string) {
  const rec = highestPerfMap.value.get(skillId)
  if (!rec) return 'unreviewed'
  if (rec.currentSkillLevel === 'Mastered') return 'mastered'
  if (rec.currentSkillLevel === 'Proficient') return 'proficient'
  return 'needs'
}
const statusBarColors: Record<string, string> = {
  mastered: 'bg-emerald-500', proficient: 'bg-blue-500', needs: 'bg-amber-500', unreviewed: 'bg-zinc-700',
}
function subCatStatsCalc(sub: any) {
  let m = 0, p = 0, n = 0
  for (const sk of sub.skills) {
    const s = getSkillStatus(sk._id)
    if (s === 'mastered') m++; else if (s === 'proficient') p++; else if (s === 'needs') n++
  }
  return { total: sub.skills.length, mastered: m, proficient: p, needs: n, reviewed: m + p + n }
}

// ─── Predecessor / locking logic ─────────────────────────
function levelMeetsThreshold(level: string): boolean {
  const stepIdx = LEVEL_STEPS.indexOf(level as any)
  const threshIdx = LEVEL_STEPS.indexOf(minProgressionLevel.value as any)
  if (stepIdx === -1 || threshIdx === -1) return false
  return stepIdx >= threshIdx
}

function isSubCatLocked(sub: SubCatNode): boolean {
  if (!sub.predecessor) return false // no predecessor = unlocked
  // Find predecessor sub-category
  const predSub = tree.value
    .flatMap(c => c.subCategories)
    .find(s => s._id === sub.predecessor)
  if (!predSub) return false // predecessor not found = unlocked
  // Check all required skills in predecessor
  const requiredSkills = predSub.skills.filter(sk => sk.isRequired)
  if (requiredSkills.length === 0) return false // no required skills = unlocked
  // All required skills must meet the threshold
  return !requiredSkills.every(sk => {
    const rec = highestPerfMap.value.get(sk._id)
    return rec && levelMeetsThreshold(rec.currentSkillLevel)
  })
}

function predecessorProgress(sub: SubCatNode): { met: number; total: number; predName: string } {
  if (!sub.predecessor) return { met: 0, total: 0, predName: '' }
  const predSub = tree.value.flatMap(c => c.subCategories).find(s => s._id === sub.predecessor)
  if (!predSub) return { met: 0, total: 0, predName: '' }
  const required = predSub.skills.filter(sk => sk.isRequired)
  const met = required.filter(sk => {
    const rec = highestPerfMap.value.get(sk._id)
    return rec && levelMeetsThreshold(rec.currentSkillLevel)
  }).length
  return { met, total: required.length, predName: predSub.name }
}

// ─── Search filter ───────────────────────────────────────
const filteredTree = computed(() => {
  const q = searchQuery.value.toLowerCase()
  if (!q) return tree.value
  return tree.value
    .map(cat => ({
      ...cat,
      subCategories: cat.subCategories
        .map(sub => ({
          ...sub,
          skills: sub.skills.filter(sk => sk.name.toLowerCase().includes(q)),
        }))
        .filter(sub => sub.skills.length > 0 || sub.name.toLowerCase().includes(q)),
    }))
    .filter(cat => cat.subCategories.length > 0 || cat.name.toLowerCase().includes(q))
})

// Filtered perf records for table view
const filteredRecords = computed(() => {
  const empRecords = perfRecords.value.filter(r => r.employee === selectedEmployeeId.value)
  const q = searchQuery.value.toLowerCase()
  if (!q) return empRecords
  return empRecords.filter(r =>
    r.categoryName.toLowerCase().includes(q)
    || r.subCategoryName.toLowerCase().includes(q)
    || r.skillName.toLowerCase().includes(q),
  )
})

// ─── Accordion toggles ──────────────────────────────────
function toggleCat(id: string) {
  if (expandedCats.value.has(id)) expandedCats.value.delete(id)
  else expandedCats.value.add(id)
}
function toggleSub(id: string) {
  if (expandedSubs.value.has(id)) expandedSubs.value.delete(id)
  else expandedSubs.value.add(id)
}

// ─── Level helpers ───────────────────────────────────────
function levelIndex(lvl: string) {
  const idx = LEVEL_STEPS.indexOf(lvl as any)
  return idx === -1 ? 0 : idx + 1
}

function levelColor(lvl: string) {
  if (lvl === 'Mastered') return 'bg-emerald-600 text-white border-emerald-700'
  if (lvl === 'Proficient') return 'bg-blue-600 text-white border-blue-700'
  if (lvl === 'Needs Improvement') return 'bg-amber-600 text-white border-amber-700'
  return 'bg-muted/60 text-muted-foreground border-border/40'
}

function levelDot(lvl: string) {
  if (lvl === 'Mastered') return 'bg-emerald-500'
  if (lvl === 'Proficient') return 'bg-blue-500'
  if (lvl === 'Needs Improvement') return 'bg-amber-500'
  return 'bg-muted-foreground/40'
}

function levelBarColor(lvl: string) {
  if (lvl === 'Mastered') return 'bg-emerald-500'
  if (lvl === 'Proficient') return 'bg-blue-500'
  if (lvl === 'Needs Improvement') return 'bg-amber-500'
  return 'bg-muted-foreground'
}

// ─── Dynamic level buttons per sub-category ──────────────
// If a sub-cat has exactly 1 bonus rule override, only show
// "Needs Improvement" + that rule's level (hide the other).
function getVisibleLevels(sub: SubCatNode): readonly string[] {
  const rules = sub.bonusRules || []
  if (rules.length === 0) return LEVEL_STEPS // no override → show all 3

  const uniqueSkillSets = new Set(rules.map(r => r.skillSet))

  // If override covers only one tier (e.g. just Proficient or just Mastered)
  if (uniqueSkillSets.size === 1) {
    const tier = [...uniqueSkillSets][0]!
    return ['Needs Improvement', tier]
  }

  // Multiple tiers in override → show all 3
  return LEVEL_STEPS
}

function formatDate(d: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Palette ─────────────────────────────────────────────
const catPalette = [
  { gradient: 'from-violet-500/20 to-purple-500/10 border-violet-500/30', dot: 'bg-violet-500', text: 'text-violet-400', icon: 'text-violet-400' },
  { gradient: 'from-cyan-500/20 to-sky-500/10 border-cyan-500/30', dot: 'bg-cyan-500', text: 'text-cyan-400', icon: 'text-cyan-400' },
  { gradient: 'from-emerald-500/20 to-green-500/10 border-emerald-500/30', dot: 'bg-emerald-500', text: 'text-emerald-400', icon: 'text-emerald-400' },
  { gradient: 'from-orange-500/20 to-amber-500/10 border-orange-500/30', dot: 'bg-orange-500', text: 'text-orange-400', icon: 'text-orange-400' },
  { gradient: 'from-rose-500/20 to-pink-500/10 border-rose-500/30', dot: 'bg-rose-500', text: 'text-rose-400', icon: 'text-rose-400' },
  { gradient: 'from-blue-500/20 to-indigo-500/10 border-blue-500/30', dot: 'bg-blue-500', text: 'text-blue-400', icon: 'text-blue-400' },
]
function pal(idx: number) { return catPalette[idx % catPalette.length]! }

// ─── Mark skill level (progression-aware optimistic upsert) ────────────────
async function markSkill(skill: SkillNode, level: string, catId: string) {
  if (!selectedEmployeeId.value) return
  if (!currentUserId.value) {
    toast.error('You must be logged in to review')
    return
  }
  const empId = selectedEmployeeId.value
  const myId = currentUserId.value

  // ─── Client-side progression guards ─────────────────────
  if (level === 'Mastered') {
    if (!hasMyLevel(skill._id, 'Proficient')) {
      toast.error('Cannot mark as Mastered', { description: 'Must be marked as Proficient first.' })
      return
    }
    if (!canMarkMastered(skill._id)) {
      toast.error('Cannot mark as Mastered today', { description: 'Proficient was marked today. Mastered can be selected starting tomorrow.' })
      return
    }
  }

  // If this level is already marked, this is a toggle-off (remove it)
  const existingLevelKey = `${skill._id}::${level}`
  const existingLevelRec = myPerfLevelMap.value.get(existingLevelKey)
  if (existingLevelRec) {
    // Don't allow removing a level if a higher level depends on it
    if (level === 'Proficient' && hasMyLevel(skill._id, 'Mastered')) {
      toast.error('Cannot remove Proficient', { description: 'Mastered depends on it. Remove Mastered first.' })
      return
    }
    // Delete this specific record
    await deleteRecord(existingLevelRec._id)
    return
  }

  // Optimistic: find existing record for same employee+skill+createdBy+level
  const existingRecordIndex = perfRecords.value.findIndex(
    r => r.employee === empId && r.skill === skill._id && r.createdBy === myId && r.currentSkillLevel === level
  )
  const existing = existingRecordIndex !== -1 ? perfRecords.value[existingRecordIndex] : null

  if (!existing) {
    // Add a temp record (new level entry)
    const tempRecord: PerfRecord = {
      _id: `temp-${Date.now()}`,
      employee: empId,
      employeeName: selectedEmployee.value?.employee ?? '',
      employeeImage: selectedEmployee.value?.profileImage ?? '',
      category: catId,
      categoryName: tree.value.find(c => c._id === catId)?.name ?? '',
      subCategory: skill.subCategory,
      subCategoryName: tree.value.flatMap(c => c.subCategories).find(s => s._id === skill.subCategory)?.name ?? '',
      skill: skill._id,
      skillName: skill.name,
      currentSkillLevel: level,
      createdAt: new Date().toISOString(),
      createdBy: myId,
      createdByName: userCookie.value?.employee ?? '',
    }
    perfRecords.value.push(tempRecord)
  }

  try {
    const res = await $fetch<{ success: boolean, data: any }>('/api/performance', {
      method: 'POST',
      body: {
        employee: empId,
        category: catId,
        subCategory: skill.subCategory,
        skill: skill._id,
        currentSkillLevel: level,
        createdBy: myId,
      },
    })
    // Replace temp _id with real one
    if (!existing && res.data?._id) {
      const temp = perfRecords.value.find(
        r => r.skill === skill._id && r.employee === empId && r.createdBy === myId
          && r.currentSkillLevel === level && r._id.startsWith('temp-')
      )
      if (temp) temp._id = String(res.data._id)
    }
    toast.success(`Marked as ${level}`, { description: skill.name, duration: 2000 })
  }
  catch (e: any) {
    // Revert: remove the temp record we added
    if (!existing) {
      const idx = perfRecords.value.findIndex(
        r => r.skill === skill._id && r.employee === empId && r.createdBy === myId
          && r.currentSkillLevel === level && r._id.startsWith('temp-')
      )
      if (idx !== -1) perfRecords.value.splice(idx, 1)
    }
    toast.error('Failed to save', { description: e?.data?.message || e?.message })
  }
}

// ─── Delete record ───────────────────────────────────────
async function deleteRecord(id: string) {
  const idx = perfRecords.value.findIndex(r => r._id === id)
  if (idx === -1) return
  const snapshot = perfRecords.value[idx]!
  perfRecords.value.splice(idx, 1)
  try {
    await $fetch(`/api/performance/${id}`, { method: 'DELETE' })
    toast.success('Assessment removed', { duration: 2000 })
  }
  catch (e: any) {
    perfRecords.value.splice(idx, 0, snapshot)
    toast.error('Delete failed', { description: e?.message })
  }
}

// ─── Settings popover state ──────────────────────────────
const showSettings = ref(false)
const showMobileSidebar = ref(false)

// ─── Table selection state ───────────────────────────────
const selectedIds = ref<Set<string>>(new Set())

const allSelected = computed(() =>
  filteredRecords.value.length > 0 && filteredRecords.value.every(r => selectedIds.value.has(r._id)),
)

const someSelected = computed(() =>
  filteredRecords.value.some(r => selectedIds.value.has(r._id)) && !allSelected.value,
)

function toggleSelectAll() {
  if (allSelected.value) {
    selectedIds.value.clear()
  } else {
    for (const r of filteredRecords.value) {
      selectedIds.value.add(r._id)
    }
  }
}

function toggleSelect(id: string) {
  if (selectedIds.value.has(id)) selectedIds.value.delete(id)
  else selectedIds.value.add(id)
}

async function deleteSelected() {
  const ids = [...selectedIds.value]
  if (ids.length === 0) return

  // Snapshot for revert
  const snapshots = ids.map(id => {
    const idx = perfRecords.value.findIndex(r => r._id === id)
    return { idx, record: perfRecords.value[idx]! }
  }).filter(s => s.record)

  // Optimistic: remove all selected
  for (const id of ids) {
    const idx = perfRecords.value.findIndex(r => r._id === id)
    if (idx !== -1) perfRecords.value.splice(idx, 1)
  }
  selectedIds.value.clear()

  // Fire deletes in parallel
  try {
    await Promise.all(ids.map(id => $fetch(`/api/performance/${id}`, { method: 'DELETE' })))
    toast.success(`${ids.length} record${ids.length > 1 ? 's' : ''} deleted`)
  }
  catch (e: any) {
    // Revert all on failure
    for (const s of snapshots.reverse()) {
      perfRecords.value.splice(s.idx, 0, s.record)
    }
    toast.error('Bulk delete failed', { description: e?.message })
  }
}
</script>
<template>
  <div class="flex gap-0 -m-4 lg:-m-6 h-[calc(100vh-theme(spacing.16))] overflow-hidden">

    <!-- Mobile sidebar overlay -->
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="showMobileSidebar"
        class="md:hidden fixed inset-0 bg-black/50 z-40"
        @click="showMobileSidebar = false"
      />
    </Transition>

    <!-- ══════════════════════ LEFT PANEL: Employee sidebar ══════════════════════ -->
    <aside
      class="shrink-0 border-r border-border/60 bg-background flex flex-col h-full transition-transform duration-200 z-50"
      :class="[
        'w-56 md:w-64',
        showMobileSidebar ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        'fixed md:relative inset-y-0 left-0 md:inset-auto'
      ]"
    >
      <!-- Header -->
      <div class="px-4 py-3.5 sm:py-4 border-b border-border/60 flex items-center justify-between">
        <p class="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">Employees</p>
        <button class="md:hidden size-7 rounded-lg flex items-center justify-center hover:bg-muted text-muted-foreground" @click="showMobileSidebar = false">
          <Icon name="i-lucide-x" class="size-4" />
        </button>
      </div>

      <!-- Loading skeleton -->
      <div v-if="loading" class="p-3 flex flex-col gap-2">
        <div v-for="i in 6" :key="i" class="flex items-center gap-3 px-3 py-2.5">
          <div class="size-8 rounded-full bg-muted animate-pulse shrink-0" />
          <div class="flex-1 space-y-1.5">
            <div class="h-3.5 bg-muted animate-pulse rounded w-3/4" />
            <div class="h-2.5 bg-muted animate-pulse rounded w-1/2" />
          </div>
        </div>
      </div>

      <!-- Employee list -->
      <nav v-else class="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
        <button
          v-for="emp in employees"
          :key="emp._id"
          class="group w-full flex items-center gap-2.5 sm:gap-3 px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-lg text-left transition-all duration-150 relative"
          :class="selectedEmployeeId === emp._id
            ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
            : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'"
          @click="selectedEmployeeId = emp._id; showMobileSidebar = false"
        >
          <img
            v-if="emp.profileImage"
            :src="emp.profileImage"
            :alt="emp.employee"
            class="size-7 sm:size-8 rounded-full object-cover ring-1 ring-border shrink-0"
          />
          <div
            v-else
            class="size-7 sm:size-8 rounded-full bg-muted flex items-center justify-center ring-1 ring-border shrink-0 text-[10px] sm:text-xs font-bold"
          >
            {{ emp.employee.charAt(0).toUpperCase() }}
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-xs sm:text-sm font-medium truncate">{{ emp.employee }}</p>
            <p class="text-[9px] sm:text-[10px] text-muted-foreground/70">
              {{ empAssessedCount.get(emp._id) ?? 0 }} / {{ totalSkills }} skills
            </p>
          </div>
          <!-- Progress ring -->
          <span
            class="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 transition-all"
            :class="selectedEmployeeId === emp._id
              ? 'bg-primary/20 text-primary border-primary/30'
              : 'bg-muted text-muted-foreground border-border/40'"
          >
            {{ empAssessedCount.get(emp._id) ?? 0 }}
          </span>
        </button>

        <div v-if="!employees.length" class="flex flex-col items-center justify-center py-12 gap-3 px-4 text-center">
          <div class="size-10 rounded-full bg-muted flex items-center justify-center">
            <Icon name="i-lucide-users" class="size-5 text-muted-foreground" />
          </div>
          <p class="text-xs text-muted-foreground">No employees found</p>
        </div>
      </nav>
    </aside>

    <!-- ══════════════════════ RIGHT PANEL ══════════════════════ -->
    <main class="flex-1 flex flex-col min-h-0 h-full">

      <!-- Top toolbar -->
      <div class="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3 px-3 sm:px-5 py-2 sm:py-1.5 border-b border-border/60 bg-background/80 backdrop-blur-sm shrink-0">

        <!-- Mobile: Employee banner with big avatar -->
        <div class="flex items-center gap-3 sm:hidden">
          <button
            class="size-10 rounded-xl border border-border/50 flex items-center justify-center hover:bg-muted text-muted-foreground shrink-0"
            @click="showMobileSidebar = true"
          >
            <Icon name="i-lucide-panel-left" class="size-5" />
          </button>
          <div v-if="selectedEmployee" class="flex items-center gap-3 flex-1 min-w-0" @click="showMobileSidebar = true">
            <img v-if="selectedEmployee.profileImage" :src="selectedEmployee.profileImage" :alt="selectedEmployee.employee" class="size-10 rounded-full object-cover ring-2 ring-primary/30" />
            <div v-else class="size-10 rounded-full bg-primary/15 flex items-center justify-center ring-2 ring-primary/30 text-base font-bold text-primary">
              {{ selectedEmployee.employee.charAt(0).toUpperCase() }}
            </div>
            <div class="min-w-0">
              <p class="text-sm font-semibold truncate">{{ selectedEmployee.employee }}</p>
              <p class="text-[10px] text-muted-foreground">Tap to switch employee</p>
            </div>
          </div>
        </div>

        <!-- Desktop: Employee pill + search + toggle row -->
        <div class="hidden sm:flex items-center gap-3 flex-1">
          <!-- Desktop sidebar toggle -->
          <button
            class="md:hidden size-9 rounded-lg border border-border/50 flex items-center justify-center hover:bg-muted text-muted-foreground shrink-0"
            @click="showMobileSidebar = true"
          >
            <Icon name="i-lucide-panel-left" class="size-4" />
          </button>

          <!-- Employee pill -->
          <div
            v-if="selectedEmployee"
            class="flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium bg-gradient-to-r from-primary/15 to-primary/5 border-primary/25 shrink-0"
          >
            <img v-if="selectedEmployee.profileImage" :src="selectedEmployee.profileImage" :alt="selectedEmployee.employee" class="size-5 rounded-full object-cover" />
            <div v-else class="size-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
              {{ selectedEmployee.employee.charAt(0).toUpperCase() }}
            </div>
            <span class="text-primary">{{ selectedEmployee.employee }}</span>
          </div>

          <!-- Search -->
          <div class="relative flex-1 max-w-xs">
            <Icon name="i-lucide-search" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
            <Input v-model="searchQuery" placeholder="Search skills…" class="pl-9 h-9 bg-muted/50 border-border/50" />
          </div>

          <div class="flex-1" />

          <!-- View toggle (desktop) -->
          <div class="flex items-center bg-muted/50 rounded-lg p-0.5 border border-border/40">
            <button
              class="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-all"
              :class="activeView === 'tree' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'"
              @click="activeView = 'tree'"
            >
              <Icon name="i-lucide-network" class="size-3.5" />
              Tree
            </button>
            <button
              class="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-all"
              :class="activeView === 'table' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'"
              @click="activeView = 'table'"
            >
              <Icon name="i-lucide-table" class="size-3.5" />
              Table
            </button>
          </div>

          <!-- Settings button -->
          <div class="relative">
            <button
              class="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-border/40 bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all"
              @click="showSettings = !showSettings"
            >
              <Icon name="i-lucide-settings-2" class="size-3.5" />
              Settings
          </button>

          <!-- Settings popover -->
          <Transition
            enter-active-class="transition-all duration-150 ease-out"
            enter-from-class="opacity-0 scale-95 -translate-y-1"
            enter-to-class="opacity-100 scale-100 translate-y-0"
            leave-active-class="transition-all duration-100 ease-in"
            leave-from-class="opacity-100 scale-100 translate-y-0"
            leave-to-class="opacity-0 scale-95 -translate-y-1"
          >
            <div
              v-if="showSettings"
              class="absolute right-0 top-full mt-2 z-50 w-72 sm:w-80 rounded-xl border border-border bg-popover shadow-xl overflow-hidden"
            >
              <div class="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-border/50 bg-muted/20">
                <p class="text-xs sm:text-sm font-semibold">Progression Settings</p>
                <p class="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5">
                  Configure prerequisite requirements
                </p>
              </div>
              <div class="p-3 sm:p-4 space-y-3">
                <div>
                  <p class="text-[10px] sm:text-xs font-medium mb-2">Minimum level to unlock next sub-category</p>
                  <p class="text-[9px] sm:text-[10px] text-muted-foreground mb-3">
                    Employees must achieve at least this level in all <strong>required skills</strong> of a predecessor sub-category before the next one unlocks.
                  </p>
                  <div class="flex flex-col gap-1.5">
                    <button
                      v-for="level in LEVEL_STEPS"
                      :key="level"
                      class="flex items-center gap-2.5 sm:gap-3 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg border text-[10px] sm:text-xs font-medium transition-all"
                      :class="minProgressionLevel === level
                        ? 'border-primary/40 bg-primary/10 text-primary ring-1 ring-primary/20'
                        : 'border-border/40 bg-muted/20 text-muted-foreground hover:bg-muted/50 hover:text-foreground'"
                      @click="saveMinLevel(level)"
                    >
                      <span class="size-2 rounded-full" :class="levelDot(level)" />
                      {{ level }}
                      <Icon
                        v-if="minProgressionLevel === level"
                        name="i-lucide-check"
                        class="size-3 sm:size-3.5 ml-auto text-primary"
                      />
                    </button>
                  </div>
                </div>
              </div>
              <div class="px-3 sm:px-4 py-2 sm:py-2.5 border-t border-border/50 bg-muted/10 flex justify-end">
                <button
                  class="text-[10px] sm:text-xs text-muted-foreground hover:text-foreground transition-colors"
                  @click="showSettings = false"
                >
                  Close
                </button>
              </div>
            </div>
            </Transition>
          </div>
        </div>

        <!-- Mobile: View toggle + search row -->
        <div class="flex items-center gap-2 sm:hidden">
          <!-- Big view toggle -->
          <div class="flex items-center bg-muted/50 rounded-xl p-1 border border-border/40 shrink-0">
            <button
              class="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg transition-all min-h-[38px]"
              :class="activeView === 'tree' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'"
              @click="activeView = 'tree'"
            >
              <Icon name="i-lucide-network" class="size-4" />
              Tree
            </button>
            <button
              class="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg transition-all min-h-[38px]"
              :class="activeView === 'table' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'"
              @click="activeView = 'table'"
            >
              <Icon name="i-lucide-table" class="size-4" />
              Table
            </button>
          </div>
          <!-- Search -->
          <div class="relative flex-1 min-w-0">
            <Icon name="i-lucide-search" class="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground size-3.5" />
            <Input v-model="searchQuery" placeholder="Search…" class="pl-8 h-[38px] bg-muted/50 border-border/50 text-xs rounded-xl" />
          </div>
          <!-- Settings -->
          <button
            class="size-[38px] rounded-xl border border-border/40 bg-muted/40 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all shrink-0"
            @click="showSettings = !showSettings"
          >
            <Icon name="i-lucide-settings-2" class="size-4" />
          </button>
        </div>
      </div>

      <!-- Content area -->
      <div class="flex-1 overflow-y-auto p-3 sm:p-5">

        <!-- Loading state -->
        <div v-if="loading" class="flex flex-col gap-4">
          <div v-for="i in 3" :key="i" class="rounded-xl border border-border/50 overflow-hidden animate-pulse">
            <div class="h-12 bg-muted/60" />
            <div class="p-4 space-y-3">
              <div v-for="j in 3" :key="j" class="h-10 bg-muted/40 rounded-lg" />
            </div>
          </div>
        </div>

        <!-- No employee selected -->
        <div v-else-if="!selectedEmployee" class="flex flex-col items-center justify-center h-full gap-3 sm:gap-4 text-center py-16 sm:py-24 px-4">
          <div class="size-14 sm:size-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
            <Icon name="i-lucide-bar-chart-3" class="size-6 sm:size-8 text-primary" />
          </div>
          <h3 class="text-base sm:text-lg font-semibold">Select an employee</h3>
          <p class="text-xs sm:text-sm text-muted-foreground max-w-xs">Choose an employee from the left panel to manage their skill assessments.</p>
          <Button variant="outline" size="sm" class="md:hidden" @click="showMobileSidebar = true">
            <Icon name="i-lucide-panel-left" class="mr-1.5 size-3.5" />
            Open Employee List
          </Button>
        </div>

        <!-- ═══════ TREE VIEW ═══════ -->
        <template v-else-if="activeView === 'tree'">
          <!-- No search results -->
          <div v-if="filteredTree.length === 0 && searchQuery" class="flex flex-col items-center justify-center py-24 gap-3">
            <Icon name="i-lucide-search-x" class="size-10 text-muted-foreground" />
            <p class="text-sm text-muted-foreground">No skills match "<strong>{{ searchQuery }}</strong>"</p>
            <Button variant="ghost" size="sm" @click="searchQuery = ''">Clear search</Button>
          </div>

          <!-- Signal-style Overall Stats Hero Card -->
          <div v-if="filteredTree.length > 0 && !searchQuery" class="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden relative mb-2">
            <div class="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-blue-500/5 pointer-events-none" />
            <div class="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5 relative z-10">
              <div class="flex items-center gap-3 flex-1">
                <div class="size-12 sm:size-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                  <Icon name="i-lucide-activity" class="size-6 sm:size-7 text-emerald-500" />
                </div>
                <div>
                  <p class="text-[10px] sm:text-xs text-muted-foreground font-medium uppercase tracking-wider">Overall Skill Completion</p>
                  <p class="text-2xl sm:text-3xl font-black leading-none mt-0.5" :class="overallPct >= 80 ? 'text-emerald-500' : overallPct >= 50 ? 'text-blue-500' : 'text-amber-500'">
                    {{ overallPct }}%
                  </p>
                </div>
              </div>
              <div class="flex items-center gap-3 sm:gap-4 text-[10px] sm:text-xs text-muted-foreground flex-wrap">
                <div class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm bg-emerald-500" /> Mastered ({{ overallStats.mastered }})</div>
                <div class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm bg-blue-500" /> Proficient ({{ overallStats.proficient }})</div>
                <div class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm bg-amber-500" /> Needs Imp. ({{ overallStats.needs }})</div>
                <div class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm bg-zinc-700" /> Unreviewed ({{ overallStats.unreviewed }})</div>
              </div>
            </div>
          </div>

          <!-- Category accordion list -->
          <div v-else-if="filteredTree.length === 0" />
          <div class="flex flex-col gap-3 sm:gap-4">
            <div
              v-for="(cat, catIdx) in filteredTree"
              :key="cat._id"
              class="rounded-xl border border-border/50 bg-card shadow-xs overflow-hidden"
            >
              <!-- Category header -->
              <div
                role="button"
                tabindex="0"
                class="w-full flex items-center gap-2.5 sm:gap-3 px-3 sm:px-4 py-3.5 sm:py-3.5 text-left hover:bg-muted/20 transition-colors cursor-pointer select-none group"
                @click="toggleCat(cat._id)"
                @keydown.enter.space.prevent="toggleCat(cat._id)"
              >
                <Icon
                  name="i-lucide-chevron-right"
                  class="size-3.5 sm:size-4 text-muted-foreground transition-transform duration-200 shrink-0"
                  :class="expandedCats.has(cat._id) ? 'rotate-90' : ''"
                />
                <div
                  class="size-8 sm:size-8 rounded-lg flex items-center justify-center shrink-0 bg-gradient-to-br border"
                  :class="pal(catIdx).gradient"
                >
                  <Icon name="i-lucide-layers" class="size-3.5 sm:size-4" :class="pal(catIdx).icon" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-semibold" :class="pal(catIdx).text">{{ cat.name }}</p>
                  <p class="text-[9px] sm:text-[10px] text-muted-foreground mt-0.5">
                    {{ cat.subCategories.length }} sub-cat · {{ cat.subCategories.reduce((s, sub) => s + sub.skills.length, 0) }} skills
                  </p>
                </div>
                <!-- Category progress -->
                <div class="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  <div class="w-14 sm:w-20 h-1.5 sm:h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      class="h-full rounded-full transition-all duration-500"
                      :class="pal(catIdx).dot"
                      :style="{
                        width: `${cat.subCategories.reduce((s, sub) => s + sub.skills.length, 0) === 0
                          ? 0
                          : (cat.subCategories.reduce((s, sub) => s + sub.skills.filter(sk => myPerfMap.get(sk._id)).length, 0)
                            / cat.subCategories.reduce((s, sub) => s + sub.skills.length, 0) * 100)}%`,
                      }"
                    />
                  </div>
                  <span class="text-[10px] font-bold text-muted-foreground min-w-[2.5rem] text-right" :class="pal(catIdx).text">
                    {{ cat.subCategories.reduce((s, sub) => s + sub.skills.length, 0) === 0 ? '0' : Math.round(cat.subCategories.reduce((s, sub) => s + sub.skills.filter(sk => myPerfMap.get(sk._id)).length, 0) / cat.subCategories.reduce((s, sub) => s + sub.skills.length, 0) * 100) }}%
                  </span>
                </div>
              </div>

              <!-- SubCategories -->
              <Transition
                enter-active-class="transition-all duration-200 ease-out"
                enter-from-class="opacity-0 -translate-y-1"
                enter-to-class="opacity-100 translate-y-0"
                leave-active-class="transition-all duration-150 ease-in"
                leave-from-class="opacity-100 translate-y-0"
                leave-to-class="opacity-0 -translate-y-1"
              >
                <div v-if="expandedCats.has(cat._id)" class="border-t border-border/30">
                  <div
                    v-for="sub in cat.subCategories"
                    :key="sub._id"
                    class="border-b border-border/20 last:border-0"
                  >
                    <!-- Sub-category header -->
                    <div
                      role="button"
                      tabindex="0"
                      class="w-full flex items-center gap-2.5 sm:gap-3 pl-6 sm:pl-10 pr-3 sm:pr-4 py-3 sm:py-3 text-left transition-colors cursor-pointer select-none group"
                      :class="isSubCatLocked(sub) ? 'opacity-60' : 'hover:bg-muted/20'"
                      @click="!isSubCatLocked(sub) && toggleSub(sub._id)"
                      @keydown.enter.space.prevent="!isSubCatLocked(sub) && toggleSub(sub._id)"
                    >
                      <!-- Lock or expand icon -->
                      <Icon
                        v-if="isSubCatLocked(sub)"
                        name="i-lucide-lock"
                        class="size-3.5 text-muted-foreground/50 shrink-0"
                      />
                      <Icon
                        v-else
                        name="i-lucide-chevron-right"
                        class="size-3.5 text-muted-foreground transition-transform duration-200 shrink-0"
                        :class="expandedSubs.has(sub._id) ? 'rotate-90' : ''"
                      />

                      <div class="size-6 sm:size-6 rounded-md flex items-center justify-center shrink-0 bg-muted/60 border border-border/30">
                        <Icon name="i-lucide-tag" class="size-3" :class="pal(catIdx).icon" />
                      </div>

                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium">{{ sub.name }}</p>
                        <!-- Predecessor info -->
                        <div v-if="sub.predecessor && isSubCatLocked(sub)" class="flex items-center gap-1.5 mt-1">
                          <Icon name="i-lucide-shield-alert" class="size-3 text-amber-400 shrink-0" />
                          <p class="text-[10px] text-amber-400">
                            Requires {{ minProgressionLevel }} in
                            {{ predecessorProgress(sub).met }}/{{ predecessorProgress(sub).total }}
                            required skills of "{{ predecessorProgress(sub).predName }}"
                          </p>
                        </div>
                        <div v-else-if="sub.predecessorName" class="flex items-center gap-1 mt-0.5">
                          <Icon name="i-lucide-check-circle" class="size-3 text-emerald-500 shrink-0" />
                          <p class="text-[10px] text-emerald-500/80">
                            Prerequisite "{{ sub.predecessorName }}" completed
                          </p>
                        </div>
                      </div>

                      <!-- Sub progress -->
                      <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/40 shrink-0">
                        {{ sub.skills.filter(sk => myPerfMap.get(sk._id)).length }}/{{ sub.skills.length }}
                      </span>
                    </div>

                    <!-- Skills list -->
                    <Transition
                      enter-active-class="transition-all duration-200 ease-out"
                      enter-from-class="opacity-0 -translate-y-1"
                      enter-to-class="opacity-100 translate-y-0"
                      leave-active-class="transition-all duration-150 ease-in"
                      leave-from-class="opacity-100 translate-y-0"
                      leave-to-class="opacity-0 -translate-y-1"
                    >
                      <div v-if="expandedSubs.has(sub._id) && !isSubCatLocked(sub)" class="bg-muted/10 border-t border-border/20">

                        <!-- Empty sub -->
                        <div v-if="sub.skills.length === 0" class="flex items-center justify-center py-6 gap-2">
                          <Icon name="i-lucide-sparkles" class="size-4 text-muted-foreground/50" />
                          <p class="text-xs text-muted-foreground">No skills in this sub-category</p>
                        </div>

                        <!-- Skill rows -->
                        <div
                          v-for="sk in sub.skills"
                          :key="sk._id"
                          class="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 sm:gap-3 pl-10 sm:pl-[4.5rem] pr-3 sm:pr-4 py-3.5 sm:py-3 border-b border-border/10 last:border-0 group/skill hover:bg-muted/20 transition-colors"
                        >
                          <!-- Skill info -->
                          <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-1.5 sm:gap-2">
                              <p class="text-[13px] sm:text-sm leading-snug">{{ sk.name }}</p>
                            </div>
                            <!-- Reviewer chips -->
                            <div v-if="allRecordsForSkill.get(sk._id)?.length" class="flex flex-wrap items-center gap-1 mt-1">
                              <span
                                v-for="rev in allRecordsForSkill.get(sk._id)"
                                :key="rev._id"
                                class="inline-flex items-center gap-0.5 text-[8px] sm:text-[9px] font-medium px-1.5 py-0.5 rounded-full border"
                                :class="rev.currentSkillLevel === 'Mastered'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                  : rev.currentSkillLevel === 'Proficient'
                                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'"
                              >
                                <Icon name="i-lucide-user" class="size-2" />
                                {{ rev.createdByName || 'Unknown' }}
                                <span class="opacity-60">· {{ formatDate(rev.createdAt) }}</span>
                              </span>
                            </div>
                          </div>

                          <!-- Progression level buttons with timeline -->
                          <div class="flex items-stretch gap-0 w-full sm:w-auto sm:shrink-0 self-stretch sm:self-auto">
                            <template v-for="(level, lvlIdx) in getVisibleLevels(sub)" :key="level">
                              <!-- Connector line between buttons -->
                              <div
                                v-if="lvlIdx > 0"
                                class="flex items-center self-center"
                              >
                                <div
                                  class="w-3 sm:w-4 h-[2px] transition-colors duration-300"
                                  :class="hasMyLevel(sk._id, level) ? (level === 'Mastered' ? 'bg-emerald-500' : level === 'Proficient' ? 'bg-blue-500' : 'bg-amber-500') : 'bg-border/40'"
                                />
                              </div>

                              <!-- Level button -->
                              <button
                                class="group/btn relative flex-1 sm:flex-none flex flex-col items-center gap-0.5 px-2.5 sm:px-3 py-2 sm:py-1.5 rounded-xl sm:rounded-lg border transition-all duration-200 min-h-[48px] sm:min-h-[36px] min-w-[90px] sm:min-w-[100px]"
                                :class="[
                                  hasMyLevel(sk._id, level)
                                    ? `${levelColor(level)} ring-2 ring-offset-1 ring-offset-background shadow-md ${level === 'Mastered' ? 'ring-emerald-500/50 shadow-emerald-500/20' : level === 'Proficient' ? 'ring-blue-500/50 shadow-blue-500/20' : 'ring-amber-500/50 shadow-amber-500/20'}`
                                    : level === 'Mastered' && !canMarkMastered(sk._id)
                                      ? 'border-border/30 bg-zinc-800/60 text-zinc-500 cursor-not-allowed'
                                      : 'border-border/50 bg-zinc-800/40 text-zinc-300 hover:bg-zinc-700/60 hover:text-white hover:border-zinc-600 hover:shadow-sm',
                                ]"
                                :title="level === 'Mastered' && !hasMyLevel(sk._id, level) ? getMasteredDisabledReason(sk._id) : hasMyLevel(sk._id, level) ? `Click to remove ${level}` : `Mark as ${level}`"
                                @click.stop="markSkill(sk, level, cat._id)"
                              >
                                <!-- Lock icon for disabled Mastered -->
                                <div v-if="level === 'Mastered' && !hasMyLevel(sk._id, level) && !canMarkMastered(sk._id)" class="absolute -top-1.5 -right-1.5 size-4 rounded-full bg-muted border border-border flex items-center justify-center">
                                  <Icon name="i-lucide-lock" class="size-2.5 text-muted-foreground/60" />
                                </div>

                                <!-- Check icon for completed levels -->
                                <div v-if="hasMyLevel(sk._id, level)" class="absolute -top-1.5 -right-1.5 size-4 rounded-full flex items-center justify-center" :class="level === 'Mastered' ? 'bg-emerald-500' : level === 'Proficient' ? 'bg-blue-500' : 'bg-amber-500'">
                                  <Icon name="i-lucide-check" class="size-2.5 text-white" />
                                </div>

                                <!-- Level name -->
                                <span class="text-[11px] sm:text-[10px] font-bold leading-none">
                                  {{ level === 'Needs Improvement' ? 'Needs Imp.' : level }}
                                </span>

                                <!-- Date indicator (when level was logged) -->
                                <span
                                  v-if="hasMyLevel(sk._id, level)"
                                  class="text-[9px] font-medium leading-none opacity-70"
                                >
                                  {{ formatDate(getMyLevelDate(sk._id, level)!) }}
                                </span>
                                <span
                                  v-else-if="level === 'Mastered' && !canMarkMastered(sk._id) && hasMyLevel(sk._id, 'Proficient')"
                                  class="text-[8px] leading-none opacity-50 flex items-center gap-0.5"
                                >
                                  <Icon name="i-lucide-clock" class="size-2" />
                                  Tomorrow
                                </span>
                              </button>
                            </template>
                          </div>
                        </div>
                      </div>
                    </Transition>
                  </div>
                </div>
              </Transition>
            </div>
          </div>
        </template>

        <!-- ═══════ TABLE VIEW ═══════ -->
        <template v-else>
          <!-- No results -->
          <div v-if="filteredRecords.length === 0" class="flex flex-col items-center justify-center py-24 gap-3 text-center">
            <Icon name="i-lucide-clipboard" class="size-10 text-muted-foreground/50" />
            <p class="text-sm text-muted-foreground">
              {{ searchQuery ? `No records match "${searchQuery}"` : 'No assessments recorded for this employee yet.' }}
            </p>
            <Button v-if="searchQuery" variant="ghost" size="sm" @click="searchQuery = ''">Clear search</Button>
            <Button v-else variant="outline" size="sm" @click="activeView = 'tree'">
              <Icon name="i-lucide-network" class="mr-1.5 size-3.5" />
              Open Skill Tree
            </Button>
          </div>

          <!-- Data table -->
          <div v-else class="rounded-xl border border-border/50 bg-card shadow-xs overflow-hidden">
            <div class="overflow-x-auto">
              <table class="w-full text-sm" style="min-width: 640px">
              <thead>
                <tr class="border-b border-border/50 bg-muted/30">
                  <th class="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Category</th>
                  <th class="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Sub-Category</th>
                  <th class="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Skill</th>
                  <th class="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Level</th>
                  <th class="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Date</th>
                  <th class="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Reviewed By</th>
                  <th class="px-4 py-3 w-12 text-center">
                    <button
                      class="size-4 rounded border-2 transition-all inline-flex items-center justify-center"
                      :class="allSelected
                        ? 'bg-primary border-primary'
                        : someSelected
                          ? 'border-primary bg-primary/30'
                          : 'border-muted-foreground/40 hover:border-muted-foreground'"
                      @click="toggleSelectAll"
                    >
                      <Icon v-if="allSelected" name="i-lucide-check" class="size-3 text-primary-foreground" />
                      <Icon v-else-if="someSelected" name="i-lucide-minus" class="size-3 text-primary-foreground" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="r in filteredRecords"
                  :key="r._id"
                  class="group border-b border-border/30 last:border-0 transition-colors"
                  :class="selectedIds.has(r._id) ? 'bg-primary/5' : 'hover:bg-muted/20'"
                >
                  <td class="px-4 py-3"><span class="font-medium">{{ r.categoryName || '—' }}</span></td>
                  <td class="px-4 py-3 text-muted-foreground">{{ r.subCategoryName || '—' }}</td>
                  <td class="px-4 py-3"><span class="font-medium">{{ r.skillName || '—' }}</span></td>
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-2.5">
                      <div class="flex gap-0.5">
                        <div
                          v-for="i in 3"
                          :key="i"
                          class="w-2.5 h-4 rounded-[2px] transition-colors"
                          :class="i <= levelIndex(r.currentSkillLevel) ? levelBarColor(r.currentSkillLevel) : 'bg-muted'"
                        />
                      </div>
                      <span
                        class="text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap"
                        :class="levelColor(r.currentSkillLevel)"
                      >
                        {{ r.currentSkillLevel || '—' }}
                      </span>
                    </div>
                  </td>
                  <td class="px-4 py-3 text-muted-foreground text-xs">{{ formatDate(r.createdAt) }}</td>
                  <td class="px-4 py-3">
                    <span class="text-xs font-medium text-muted-foreground">{{ r.createdByName || '—' }}</span>
                  </td>
                  <td class="px-4 py-3 text-center">
                    <button
                      class="size-4 rounded border-2 transition-all inline-flex items-center justify-center"
                      :class="selectedIds.has(r._id)
                        ? 'bg-primary border-primary'
                        : 'border-muted-foreground/40 hover:border-muted-foreground'"
                      @click="toggleSelect(r._id)"
                    >
                      <Icon v-if="selectedIds.has(r._id)" name="i-lucide-check" class="size-3 text-primary-foreground" />
                    </button>
                  </td>
                </tr>
              </tbody>
              </table>
            </div>
          </div>

          <!-- Floating bulk action bar -->
          <Transition
            enter-active-class="transition-all duration-200 ease-out"
            enter-from-class="opacity-0 translate-y-4"
            enter-to-class="opacity-100 translate-y-0"
            leave-active-class="transition-all duration-150 ease-in"
            leave-from-class="opacity-100 translate-y-0"
            leave-to-class="opacity-0 translate-y-4"
          >
            <div
              v-if="selectedIds.size > 0"
              class="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 sm:gap-4 px-3 sm:px-5 py-2.5 sm:py-3 rounded-xl border border-border bg-popover shadow-2xl backdrop-blur-sm"
            >
              <span class="text-xs sm:text-sm font-medium">
                {{ selectedIds.size }} selected
              </span>
              <div class="w-px h-4 sm:h-5 bg-border" />
              <Button
                variant="destructive"
                size="sm"
                class="h-7 sm:h-8 text-xs"
                @click="deleteSelected"
              >
                <Icon name="i-lucide-trash-2" class="mr-1 sm:mr-1.5 size-3 sm:size-3.5" />
                Delete
              </Button>
              <button
                class="text-[10px] sm:text-xs text-muted-foreground hover:text-foreground transition-colors"
                @click="selectedIds.clear()"
              >
                Cancel
              </button>
            </div>
          </Transition>
        </template>

      </div>
    </main>

  </div>
</template>
