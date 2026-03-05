<script setup lang="ts">
import { toast } from 'vue-sonner'

const { setHeader } = usePageHeader()
setHeader({ title: 'Daily Production Report', icon: 'i-lucide-clipboard-list', description: 'Track daily crew production, attendance & work blocks' })

// ─── Types ───────────────────────────────────────────────
interface DailyProductionRecord {
  _id: string
  employeeName: string | null
  jobClient: string | null
  wereYouOnTime: string | null
  didYouLeaveTheJobForAnythingOtherThanLunch: string | null
  totalMinutesOffSiteNotIncludingLunch: number | null
  reasonForLeaving: string | null
  totalMinutesLate: number | null
  whatWorkDidYouPerformTodaySelectAllThatApply: string[]
  block1Category: string | null
  productionHours: number | null
  squareFeetCompleted: number | null
  linearFeetCompleted: number | null
  count: number | null
  didYouDoASecondTypeOfWorkToday: string | null
  block2Category: string | null
  productionHoursBlock2: number | null
  squareFeetCompletedBlock2: number | null
  linearFeetCompletedBlock2: number | null
  countBlock2: number | null
  didYouDoAThirdTypeOfWorkToday: string | null
  block3Category: string | null
  productionHoursBlock3: number | null
  squareFeetCompletedBlock3: number | null
  linearFeetCompletedBlock3: number | null
  countBlock3: number | null
  anyBlockersThatSlowedYouDownToday: string | null
  issuesWithTheFormMissingDataThatNeedsToBeCaptured: string | null
  createdBy: string | null
  createdAt: string
}

// ─── State ───────────────────────────────────────────────
const activeTab = ref('list')
const records = ref<DailyProductionRecord[]>([])
const loading = ref(true)
const saving = ref(false)
const editingId = ref<string | null>(null)

const emptyForm = () => ({
  employeeName: '',
  jobClient: '',
  wereYouOnTime: '',
  didYouLeaveTheJobForAnythingOtherThanLunch: '',
  totalMinutesOffSiteNotIncludingLunch: undefined as number | undefined,
  reasonForLeaving: '',
  totalMinutesLate: undefined as number | undefined,
  whatWorkDidYouPerformTodaySelectAllThatApply: [] as string[],
  block1Category: '',
  productionHours: undefined as number | undefined,
  squareFeetCompleted: undefined as number | undefined,
  linearFeetCompleted: undefined as number | undefined,
  count: undefined as number | undefined,
  didYouDoASecondTypeOfWorkToday: 'No',
  block2Category: '',
  productionHoursBlock2: undefined as number | undefined,
  squareFeetCompletedBlock2: undefined as number | undefined,
  linearFeetCompletedBlock2: undefined as number | undefined,
  countBlock2: undefined as number | undefined,
  didYouDoAThirdTypeOfWorkToday: 'No',
  block3Category: '',
  productionHoursBlock3: undefined as number | undefined,
  squareFeetCompletedBlock3: undefined as number | undefined,
  linearFeetCompletedBlock3: undefined as number | undefined,
  countBlock3: undefined as number | undefined,
  anyBlockersThatSlowedYouDownToday: '',
  issuesWithTheFormMissingDataThatNeedsToBeCaptured: '',
  createdBy: '',
})
const form = ref(emptyForm())

// ─── Options ─────────────────────────────────────────────
const WORK_TYPES = [
  'Estimates', 'Installation', 'Finishing', 'Trim', 'Prep work',
  'Installing Steps/Risers', 'Administration', 'Shop work', 'Repairs',
  'Vents', 'Sanding', 'Leveling', 'Other/Support', 'Demolition',
] as const

const BLOCK_CATEGORIES = [
  'Installation', 'Sanding', 'Finishing', 'Trim', 'Prep Work',
  'Steps/Risers', 'Repairs', 'Demolition', 'Leveling', 'Vents',
  'Shop Work', 'Estimates', 'Administration', 'Other',
] as const

const REASON_FOR_LEAVING_OPTIONS = [
  'Personal Errand', 'Supplies Run', 'Equipment Repair',
  'Meeting', 'Medical', 'Other',
] as const


// ─── Sections ────────────────────────────────────────────
const activeSectionIdx = ref(0)

const sections = computed(() => {
  const base = [
    {
      id: 'employee-info',
      title: 'Employee & Job Info',
      icon: 'i-lucide-user-circle',
      description: 'Who are you and what job/client today?',
      color: 'from-blue-500/20 to-blue-500/5 border-blue-500/30',
      iconColor: 'text-blue-400',
    },
    {
      id: 'attendance',
      title: 'Attendance & Punctuality',
      icon: 'i-lucide-clock',
      description: 'Were you on time? Any time off site?',
      color: 'from-amber-500/20 to-amber-500/5 border-amber-500/30',
      iconColor: 'text-amber-400',
    },
    {
      id: 'leaving-site',
      title: 'Leaving Site Details',
      icon: 'i-lucide-map-pin-off',
      description: 'Time off-site not including lunch',
      color: 'from-orange-500/20 to-orange-500/5 border-orange-500/30',
      iconColor: 'text-orange-400',
    },
    {
      id: 'work-performed',
      title: 'Work Performed Today',
      icon: 'i-lucide-hammer',
      description: 'Select all types of work performed',
      color: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/30',
      iconColor: 'text-emerald-400',
    },
    {
      id: 'block-1',
      title: 'Block 1 — Production Details',
      icon: 'i-lucide-box',
      description: 'Primary work block for today',
      color: 'from-violet-500/20 to-violet-500/5 border-violet-500/30',
      iconColor: 'text-violet-400',
    },
    {
      id: 'block-2-toggle',
      title: 'Block 2 — Second Work Type',
      icon: 'i-lucide-boxes',
      description: 'If you did split work, add a second block',
      color: 'from-cyan-500/20 to-cyan-500/5 border-cyan-500/30',
      iconColor: 'text-cyan-400',
    },
  ]

  if (form.value.didYouDoASecondTypeOfWorkToday === 'Yes') {
    base.push({
      id: 'block-2-detail',
      title: 'Block 2 — Production Details',
      icon: 'i-lucide-boxes',
      description: 'Second work block details',
      color: 'from-cyan-500/20 to-cyan-500/5 border-cyan-500/30',
      iconColor: 'text-cyan-400',
    })
    base.push({
      id: 'block-3-toggle',
      title: 'Block 3 — Third Work Type',
      icon: 'i-lucide-layers',
      description: 'If you did a third type of work today',
      color: 'from-pink-500/20 to-pink-500/5 border-pink-500/30',
      iconColor: 'text-pink-400',
    })
  }

  if (form.value.didYouDoAThirdTypeOfWorkToday === 'Yes') {
    base.push({
      id: 'block-3-detail',
      title: 'Block 3 — Production Details',
      icon: 'i-lucide-layers',
      description: 'Third work block details',
      color: 'from-pink-500/20 to-pink-500/5 border-pink-500/30',
      iconColor: 'text-pink-400',
    })
  }

  base.push({
    id: 'blockers',
    title: 'Blockers & Issues',
    icon: 'i-lucide-alert-triangle',
    description: 'Report any blockers or missing data',
    color: 'from-red-500/20 to-red-500/5 border-red-500/30',
    iconColor: 'text-red-400',
  })

  return base
})

// ─── Progress ────────────────────────────────────────────
function isSectionDone(sectionId: string) {
  const f = form.value
  switch (sectionId) {
    case 'employee-info': return !!f.employeeName && !!f.jobClient
    case 'attendance': return !!f.wereYouOnTime
    case 'leaving-site': return !!f.didYouLeaveTheJobForAnythingOtherThanLunch
    case 'work-performed': return f.whatWorkDidYouPerformTodaySelectAllThatApply.length > 0
    case 'block-1': return !!f.block1Category && f.productionHours !== undefined && f.productionHours !== null
    case 'block-2-toggle': return !!f.didYouDoASecondTypeOfWorkToday
    case 'block-2-detail': return !!f.block2Category && f.productionHoursBlock2 !== undefined && f.productionHoursBlock2 !== null
    case 'block-3-toggle': return !!f.didYouDoAThirdTypeOfWorkToday
    case 'block-3-detail': return !!f.block3Category && f.productionHoursBlock3 !== undefined && f.productionHoursBlock3 !== null
    case 'blockers': return true // optional
    default: return false
  }
}

const completedSections = computed(() => sections.value.filter(s => isSectionDone(s.id)).length)
const progressPercent = computed(() => sections.value.length > 0 ? Math.round((completedSections.value / sections.value.length) * 100) : 0)

// ─── Work type toggle ────────────────────────────────────
function toggleWorkType(type: string) {
  const arr = form.value.whatWorkDidYouPerformTodaySelectAllThatApply
  const idx = arr.indexOf(type)
  if (idx >= 0) arr.splice(idx, 1)
  else arr.push(type)
}

// ─── API ─────────────────────────────────────────────────
async function fetchRecords() {
  loading.value = true
  try {
    const res = await $fetch<{ success: boolean, data: DailyProductionRecord[] }>('/api/daily-production')
    records.value = res.data
  } catch (e: any) {
    toast.error('Failed to load records', { description: e?.message })
  } finally {
    loading.value = false
  }
}

onMounted(fetchRecords)

function openCreate() {
  form.value = emptyForm()
  editingId.value = null
  activeSectionIdx.value = 0
  activeTab.value = 'form'
}

function openEdit(rec: DailyProductionRecord) {
  const base = emptyForm()
  // Coerce nulls from API to match form types (empty string for text, undefined for numbers)
  const coerced: Record<string, any> = {}
  for (const [key, val] of Object.entries(rec)) {
    if (key === '_id' || key === 'createdAt') continue
    coerced[key] = val === null ? (typeof (base as any)[key] === 'number' || (base as any)[key] === undefined ? undefined : '') : val
  }
  const merged = { ...base, ...coerced }
  // Ensure multi-select field is always array
  if (!Array.isArray(merged.whatWorkDidYouPerformTodaySelectAllThatApply)) {
    merged.whatWorkDidYouPerformTodaySelectAllThatApply = merged.whatWorkDidYouPerformTodaySelectAllThatApply ? [merged.whatWorkDidYouPerformTodaySelectAllThatApply] : []
  }
  form.value = merged
  editingId.value = rec._id
  activeSectionIdx.value = 0
  activeTab.value = 'form'
}

function cancelEdit() {
  activeTab.value = 'list'
  editingId.value = null
}

async function saveRecord() {
  if (!form.value.employeeName) return toast.error('Employee Name is required')
  saving.value = true
  try {
    if (editingId.value) {
      await $fetch(`/api/daily-production/${editingId.value}`, { method: 'PUT', body: form.value })
      toast.success('Report updated successfully')
    } else {
      await $fetch('/api/daily-production', { method: 'POST', body: form.value })
      toast.success('Report submitted successfully')
    }
    await fetchRecords()
    activeTab.value = 'list'
  } catch (e: any) {
    toast.error('Save failed', { description: e?.message })
  } finally {
    saving.value = false
  }
}

async function deleteRecord(id: string) {
  try {
    const idx = records.value.findIndex(r => r._id === id)
    if (idx !== -1) records.value.splice(idx, 1)
    await $fetch(`/api/daily-production/${id}`, { method: 'DELETE' })
    toast.success('Report deleted')
  } catch (e: any) {
    toast.error('Delete failed', { description: e?.message })
    await fetchRecords()
  }
}

function formatDate(d: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatShortDate(d: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Summary Stats ───────────────────────────────────────
const todayCount = computed(() => {
  const today = new Date().toDateString()
  return records.value.filter(r => new Date(r.createdAt).toDateString() === today).length
})
const totalHoursToday = computed(() => {
  const today = new Date().toDateString()
  return records.value
    .filter(r => new Date(r.createdAt).toDateString() === today)
    .reduce((sum, r) => {
      return sum + (r.productionHours || 0) + (r.productionHoursBlock2 || 0) + (r.productionHoursBlock3 || 0)
    }, 0)
})
const lateCount = computed(() => {
  const today = new Date().toDateString()
  return records.value.filter(r => new Date(r.createdAt).toDateString() === today && r.wereYouOnTime === 'No').length
})
</script>

<template>
  <div class="h-[calc(100vh-theme(spacing.16))] overflow-y-auto">

    <!-- ═════════ LIST VIEW ═════════ -->
    <div v-if="activeTab === 'list'" class="p-6 space-y-6 max-w-7xl mx-auto">

      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tight">Daily Production Reports</h1>
          <p class="text-sm text-muted-foreground mt-1">Track employee attendance, work output, and production metrics</p>
        </div>
        <Button @click="openCreate">
          <Icon name="i-lucide-plus" class="mr-2 size-4" />
          New Report
        </Button>
      </div>

      <!-- Summary Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="rounded-xl border border-border/50 bg-card p-4 flex items-center gap-4">
          <div class="size-11 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5 border border-blue-500/20 flex items-center justify-center">
            <Icon name="i-lucide-file-text" class="size-5 text-blue-400" />
          </div>
          <div>
            <p class="text-xs text-muted-foreground font-medium">Today's Reports</p>
            <p class="text-xl font-bold">{{ todayCount }}</p>
          </div>
        </div>
        <div class="rounded-xl border border-border/50 bg-card p-4 flex items-center gap-4">
          <div class="size-11 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/20 flex items-center justify-center">
            <Icon name="i-lucide-timer" class="size-5 text-emerald-400" />
          </div>
          <div>
            <p class="text-xs text-muted-foreground font-medium">Total Hours Today</p>
            <p class="text-xl font-bold">{{ totalHoursToday.toFixed(1) }}h</p>
          </div>
        </div>
        <div class="rounded-xl border border-border/50 bg-card p-4 flex items-center gap-4">
          <div class="size-11 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 border border-amber-500/20 flex items-center justify-center">
            <Icon name="i-lucide-alarm-clock" class="size-5 text-amber-400" />
          </div>
          <div>
            <p class="text-xs text-muted-foreground font-medium">Late Arrivals Today</p>
            <p class="text-xl font-bold">{{ lateCount }}</p>
          </div>
        </div>
      </div>

      <!-- Records Table -->
      <div class="rounded-xl border border-border/50 bg-card shadow-sm overflow-hidden">
        <div v-if="loading" class="p-12 flex justify-center text-muted-foreground gap-3 items-center">
          <Icon name="i-lucide-loader-2" class="size-6 animate-spin text-primary" /> Loading...
        </div>
        <div v-else-if="records.length === 0" class="p-24 flex flex-col items-center justify-center text-center">
          <div class="size-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center mb-5">
            <Icon name="i-lucide-clipboard-list" class="size-10 text-primary" />
          </div>
          <h3 class="text-xl font-bold mb-2">No production reports yet</h3>
          <p class="text-sm text-muted-foreground max-w-sm mb-6">Submit your first daily production report to start tracking work output and attendance.</p>
          <Button @click="openCreate" size="lg">
            <Icon name="i-lucide-plus" class="mr-2 size-4" />
            Create First Report
          </Button>
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm text-left whitespace-nowrap">
            <thead>
              <tr class="bg-muted/40 border-b border-border/50 text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
                <th class="px-5 py-3">Date</th>
                <th class="px-5 py-3">Employee</th>
                <th class="px-5 py-3">Job / Client</th>
                <th class="px-5 py-3">On Time</th>
                <th class="px-5 py-3">Category</th>
                <th class="px-5 py-3 text-right">Prod. Hours</th>
                <th class="px-5 py-3 text-right">Sq Ft</th>
                <th class="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border/30">
              <tr v-for="r in records" :key="r._id" class="hover:bg-muted/20 transition-colors cursor-pointer group" @click="openEdit(r)">
                <td class="px-5 py-3 text-muted-foreground">{{ formatShortDate(r.createdAt) }}</td>
                <td class="px-5 py-3 font-semibold">{{ r.employeeName || '—' }}</td>
                <td class="px-5 py-3 text-muted-foreground">{{ r.jobClient || '—' }}</td>
                <td class="px-5 py-3">
                  <span class="inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold border"
                    :class="r.wereYouOnTime === 'Yes' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                            r.wereYouOnTime === 'No' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-muted text-muted-foreground border-border'"
                  >
                    {{ r.wereYouOnTime || '—' }}
                  </span>
                </td>
                <td class="px-5 py-3">
                  <span v-if="r.block1Category" class="inline-flex px-2 py-0.5 rounded bg-muted text-[10px] font-semibold">{{ r.block1Category }}</span>
                  <span v-else class="text-muted-foreground/50">—</span>
                </td>
                <td class="px-5 py-3 text-right font-mono font-semibold">
                  {{ ((r.productionHours || 0) + (r.productionHoursBlock2 || 0) + (r.productionHoursBlock3 || 0)).toFixed(1) }}
                </td>
                <td class="px-5 py-3 text-right font-mono">
                  {{ ((r.squareFeetCompleted || 0) + (r.squareFeetCompletedBlock2 || 0) + (r.squareFeetCompletedBlock3 || 0)) || '—' }}
                </td>
                <td class="px-5 py-3 text-right" @click.stop>
                  <Button variant="ghost" size="sm" class="h-8 px-2" @click="openEdit(r)">
                    <Icon name="i-lucide-pencil" class="size-4" />
                  </Button>
                  <Button variant="ghost" size="sm" class="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10" @click="deleteRecord(r._id)">
                    <Icon name="i-lucide-trash-2" class="size-4" />
                  </Button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ═════════ FORM VIEW ═════════ -->
    <div v-else class="max-w-4xl mx-auto pb-12">

      <!-- Sticky Masthead -->
      <div class="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div class="px-6 py-5 flex items-center gap-5">
          <!-- Progress Ring -->
          <div class="relative size-16 shrink-0">
            <svg class="size-16 -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" stroke-width="4" class="text-muted/30" />
              <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" stroke-width="4"
                class="text-primary transition-all duration-500"
                :stroke-dasharray="`${progressPercent * 1.76} 176`"
                stroke-linecap="round"
              />
            </svg>
            <span class="absolute inset-0 flex items-center justify-center text-sm font-bold">{{ progressPercent }}%</span>
          </div>

          <div class="flex-1 min-w-0">
            <h1 class="text-xl font-bold tracking-tight truncate">
              Daily Production Report
              <span class="text-muted-foreground font-normal text-base">{{ editingId ? '(editing)' : '(new)' }}</span>
            </h1>
            <p class="text-sm text-muted-foreground mt-0.5">
              {{ completedSections }}/{{ sections.length }} sections completed
            </p>
          </div>

          <div class="flex items-center gap-2">
            <Button variant="outline" size="sm" @click="cancelEdit">
              <Icon name="i-lucide-arrow-left" class="mr-1.5 size-3.5" />
              Back
            </Button>
            <Button :disabled="saving" size="sm" @click="saveRecord">
              <Icon v-if="saving" name="i-lucide-loader-circle" class="mr-2 size-4 animate-spin" />
              <Icon v-else name="i-lucide-save" class="mr-1.5 size-3.5" />
              {{ editingId ? 'Save' : 'Submit' }}
            </Button>
          </div>
        </div>

        <!-- Section Nav Pills -->
        <div class="px-6 pb-4 flex gap-2 overflow-x-auto scrollbar-none">
          <button
            v-for="(section, idx) in sections"
            :key="section.id"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold whitespace-nowrap transition-all duration-150 shrink-0"
            :class="activeSectionIdx === idx
              ? 'bg-primary/10 text-primary border-primary/40 shadow-sm shadow-primary/5'
              : isSectionDone(section.id)
                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                : 'bg-muted/40 text-muted-foreground border-border/50 hover:bg-muted'"
            @click="activeSectionIdx = idx"
          >
            <Icon :name="isSectionDone(section.id) ? 'i-lucide-check-circle-2' : section.icon" class="size-3" />
            {{ section.title }}
          </button>
        </div>
      </div>

      <!-- Sections -->
      <div class="px-6 pt-6 space-y-5">
        <TransitionGroup name="section-fade" tag="div" class="space-y-5">
          <div
            v-for="(section, idx) in sections"
            v-show="activeSectionIdx === idx"
            :key="section.id"
            class="rounded-xl border bg-card overflow-hidden transition-all duration-300"
            :class="isSectionDone(section.id) ? 'border-emerald-500/30 bg-emerald-500/[0.02]' : 'border-border/50'"
          >
            <!-- Section Header -->
            <div class="px-5 py-4 flex items-start gap-4">
              <div
                class="size-10 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0 border"
                :class="section.color"
              >
                <Icon :name="section.icon" :class="['size-5', section.iconColor]" />
              </div>
              <div class="flex-1 min-w-0">
                <h3 class="font-bold text-base">{{ section.title }}</h3>
                <p class="text-xs text-muted-foreground mt-0.5">{{ section.description }}</p>
              </div>
              <span
                class="text-[10px] font-bold uppercase tracking-widest shrink-0 px-2.5 py-1 rounded-full"
                :class="isSectionDone(section.id) ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted/60 text-muted-foreground'"
              >
                {{ isSectionDone(section.id) ? '✓ Complete' : 'Pending' }}
              </span>
            </div>

            <!-- Section Content -->
            <div class="px-5 pb-6 space-y-5">

              <!-- ── Employee Info ── -->
              <template v-if="section.id === 'employee-info'">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div class="flex flex-col gap-1.5">
                    <Label for="dp-name" class="flex items-center gap-1.5">
                      <Icon name="i-lucide-user" class="size-3.5 text-muted-foreground" />
                      Employee Name <span class="text-destructive">*</span>
                    </Label>
                    <Input id="dp-name" v-model="form.employeeName" placeholder="Enter your full name" />
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <Label for="dp-client" class="flex items-center gap-1.5">
                      <Icon name="i-lucide-building-2" class="size-3.5 text-muted-foreground" />
                      Job / Client <span class="text-destructive">*</span>
                    </Label>
                    <Input id="dp-client" v-model="form.jobClient" placeholder="Client or job name" />
                  </div>
                </div>
              </template>

              <!-- ── Attendance ── -->
              <template v-if="section.id === 'attendance'">
                <div class="space-y-5">
                  <div class="flex flex-col gap-2">
                    <Label class="flex items-center gap-1.5">
                      <Icon name="i-lucide-clock" class="size-3.5 text-muted-foreground" />
                      Were you on time? <span class="text-destructive">*</span>
                    </Label>
                    <p class="text-xs text-muted-foreground -mt-1 ml-5">If you arrived to work late make sure this is filled out — this will be referenced to your time card so make sure missed or late punches are corrected ASAP</p>
                    <div class="flex gap-3">
                      <button
                        v-for="opt in ['Yes', 'No']"
                        :key="opt"
                        class="flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all duration-150 min-w-[100px] justify-center"
                        :class="form.wereYouOnTime === opt
                          ? opt === 'Yes' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/40 shadow-sm' : 'bg-red-500/10 text-red-500 border-red-500/40 shadow-sm'
                          : 'bg-card text-muted-foreground border-border/50 hover:border-primary/30 hover:bg-muted/30'"
                        @click="form.wereYouOnTime = form.wereYouOnTime === opt ? '' : opt"
                      >
                        <span
                          class="size-4 rounded-full border-2 flex items-center justify-center transition-colors"
                          :class="form.wereYouOnTime === opt
                            ? opt === 'Yes' ? 'border-emerald-500 bg-emerald-500' : 'border-red-500 bg-red-500'
                            : 'border-border/60'"
                        >
                          <span v-if="form.wereYouOnTime === opt" class="size-1.5 rounded-full bg-white" />
                        </span>
                        {{ opt }}
                      </button>
                    </div>
                  </div>

                  <!-- If Late -->
                  <div v-if="form.wereYouOnTime === 'No'" class="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-4">
                    <div class="flex items-center gap-2 text-amber-500 text-xs font-bold uppercase tracking-wider">
                      <Icon name="i-lucide-alert-triangle" class="size-3.5" />
                      Lateness Details
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <Label for="dp-minutes-late">Total Minutes Late</Label>
                      <Input id="dp-minutes-late" v-model.number="form.totalMinutesLate" type="number" min="0" step="5" placeholder="e.g. 15" />
                    </div>
                  </div>
                </div>
              </template>

              <!-- ── Leaving Site ── -->
              <template v-if="section.id === 'leaving-site'">
                <div class="space-y-5">
                  <div class="flex flex-col gap-2">
                    <Label class="flex items-center gap-1.5">
                      <Icon name="i-lucide-map-pin-off" class="size-3.5 text-muted-foreground" />
                      Did you leave the job for anything other than lunch? <span class="text-destructive">*</span>
                    </Label>
                    <div class="flex gap-3">
                      <button
                        v-for="opt in ['Yes', 'No']"
                        :key="opt"
                        class="flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all duration-150 min-w-[100px] justify-center"
                        :class="form.didYouLeaveTheJobForAnythingOtherThanLunch === opt
                          ? 'bg-primary/10 text-primary border-primary/40 shadow-sm'
                          : 'bg-card text-muted-foreground border-border/50 hover:border-primary/30 hover:bg-muted/30'"
                        @click="form.didYouLeaveTheJobForAnythingOtherThanLunch = form.didYouLeaveTheJobForAnythingOtherThanLunch === opt ? '' : opt"
                      >
                        <span
                          class="size-4 rounded-full border-2 flex items-center justify-center transition-colors"
                          :class="form.didYouLeaveTheJobForAnythingOtherThanLunch === opt ? 'border-primary bg-primary' : 'border-border/60'"
                        >
                          <span v-if="form.didYouLeaveTheJobForAnythingOtherThanLunch === opt" class="size-1.5 rounded-full bg-white" />
                        </span>
                        {{ opt }}
                      </button>
                    </div>
                  </div>

                  <div v-if="form.didYouLeaveTheJobForAnythingOtherThanLunch === 'Yes'" class="rounded-lg border border-orange-500/30 bg-orange-500/5 p-4 space-y-4">
                    <div class="flex items-center gap-2 text-orange-500 text-xs font-bold uppercase tracking-wider">
                      <Icon name="i-lucide-map-pin-off" class="size-3.5" />
                      Off-site Details
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div class="flex flex-col gap-1.5">
                        <Label for="dp-off-site-min">Total Minutes Off Site (Not Including Lunch)</Label>
                        <Input id="dp-off-site-min" v-model.number="form.totalMinutesOffSiteNotIncludingLunch" type="number" min="0" placeholder="e.g. 30" />
                      </div>
                      <div class="flex flex-col gap-1.5">
                        <Label for="dp-reason">Reason for Leaving</Label>
                        <Select v-model="form.reasonForLeaving">
                          <SelectTrigger id="dp-reason">
                            <SelectValue placeholder="Select reason" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem v-for="r in REASON_FOR_LEAVING_OPTIONS" :key="r" :value="r">{{ r }}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>
              </template>

              <!-- ── Work Performed ── -->
              <template v-if="section.id === 'work-performed'">
                <div class="flex flex-col gap-2">
                  <Label class="flex items-center gap-1.5">
                    <Icon name="i-lucide-hammer" class="size-3.5 text-muted-foreground" />
                    What work did you perform today? (Select all that apply) <span class="text-destructive">*</span>
                  </Label>
                  <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
                    <button
                      v-for="type in WORK_TYPES"
                      :key="type"
                      class="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border text-sm font-medium transition-all duration-150 text-left"
                      :class="form.whatWorkDidYouPerformTodaySelectAllThatApply.includes(type)
                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/40 shadow-sm shadow-emerald-500/5'
                        : 'bg-card text-muted-foreground border-border/50 hover:border-primary/30 hover:bg-muted/30'"
                      @click="toggleWorkType(type)"
                    >
                      <span
                        class="size-4 rounded-[4px] border-2 flex items-center justify-center shrink-0 transition-colors"
                        :class="form.whatWorkDidYouPerformTodaySelectAllThatApply.includes(type) ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-border/60'"
                      >
                        <Icon v-if="form.whatWorkDidYouPerformTodaySelectAllThatApply.includes(type)" name="i-lucide-check" class="size-2.5" />
                      </span>
                      {{ type }}
                    </button>
                  </div>
                </div>
              </template>

              <!-- ── Block 1 ── -->
              <template v-if="section.id === 'block-1'">
                <p class="text-xs text-muted-foreground -mt-1 mb-2">To handle "split days," you'll do <b>up to 3 blocks</b>. Most will use 1–2.</p>
                <div class="space-y-4">
                  <div class="flex flex-col gap-1.5">
                    <Label for="dp-b1-cat" class="flex items-center gap-1.5">Block 1 Category <span class="text-destructive">*</span></Label>
                    <Select v-model="form.block1Category">
                      <SelectTrigger id="dp-b1-cat">
                        <SelectValue placeholder="Choose category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem v-for="c in BLOCK_CATEGORIES" :key="c" :value="c">{{ c }}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div class="flex flex-col gap-1.5">
                      <Label for="dp-b1-hours" class="text-xs">
                        Production Hours <span class="text-destructive">*</span>
                      </Label>
                      <p class="text-[10px] text-muted-foreground -mt-1">Use 1/4 hr increments (e.g. 2.25)</p>
                      <Input id="dp-b1-hours" v-model.number="form.productionHours" type="number" min="0" step="0.25" placeholder="0.00" />
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <Label for="dp-b1-sqft" class="text-xs">Square Feet</Label>
                      <p class="text-[10px] text-muted-foreground -mt-1">Installation, sanding, finishing</p>
                      <Input id="dp-b1-sqft" v-model.number="form.squareFeetCompleted" type="number" min="0" placeholder="0" />
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <Label for="dp-b1-lft" class="text-xs">Linear Feet</Label>
                      <p class="text-[10px] text-muted-foreground -mt-1">Edging, trim, shoe, base</p>
                      <Input id="dp-b1-lft" v-model.number="form.linearFeetCompleted" type="number" min="0" placeholder="0" />
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <Label for="dp-b1-count" class="text-xs">Count</Label>
                      <p class="text-[10px] text-muted-foreground -mt-1">Vents, stairs, boards repaired</p>
                      <Input id="dp-b1-count" v-model.number="form.count" type="number" min="0" placeholder="0" />
                    </div>
                  </div>
                </div>
              </template>

              <!-- ── Block 2 Toggle ── -->
              <template v-if="section.id === 'block-2-toggle'">
                <div class="flex flex-col gap-2">
                  <Label class="flex items-center gap-1.5">
                    Did you do a second type of work today? <span class="text-destructive">*</span>
                  </Label>
                  <p class="text-xs text-muted-foreground -mt-1 ml-0">If you only did one type of work leave block 2–3 blank</p>
                  <div class="flex gap-3 mt-1">
                    <button
                      v-for="opt in ['No', 'Yes']"
                      :key="opt"
                      class="flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all duration-150 min-w-[100px] justify-center"
                      :class="form.didYouDoASecondTypeOfWorkToday === opt
                        ? 'bg-primary/10 text-primary border-primary/40 shadow-sm'
                        : 'bg-card text-muted-foreground border-border/50 hover:border-primary/30 hover:bg-muted/30'"
                      @click="form.didYouDoASecondTypeOfWorkToday = opt"
                    >
                      <span
                        class="size-4 rounded-full border-2 flex items-center justify-center transition-colors"
                        :class="form.didYouDoASecondTypeOfWorkToday === opt ? 'border-primary bg-primary' : 'border-border/60'"
                      >
                        <span v-if="form.didYouDoASecondTypeOfWorkToday === opt" class="size-1.5 rounded-full bg-white" />
                      </span>
                      {{ opt }}
                    </button>
                  </div>
                </div>
              </template>

              <!-- ── Block 2 Details ── -->
              <template v-if="section.id === 'block-2-detail'">
                <div class="space-y-4">
                  <div class="flex flex-col gap-1.5">
                    <Label for="dp-b2-cat" class="flex items-center gap-1.5">Block 2 Category <span class="text-destructive">*</span></Label>
                    <Select v-model="form.block2Category">
                      <SelectTrigger id="dp-b2-cat">
                        <SelectValue placeholder="Choose category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem v-for="c in BLOCK_CATEGORIES" :key="c" :value="c">{{ c }}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div class="flex flex-col gap-1.5">
                      <Label for="dp-b2-hours" class="text-xs">Production Hours <span class="text-destructive">*</span></Label>
                      <p class="text-[10px] text-muted-foreground -mt-1">Use 1/4 hr increments</p>
                      <Input id="dp-b2-hours" v-model.number="form.productionHoursBlock2" type="number" min="0" step="0.25" placeholder="0.00" />
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <Label for="dp-b2-sqft" class="text-xs">Square Feet</Label>
                      <p class="text-[10px] text-muted-foreground -mt-1">Installation, sanding, finishing</p>
                      <Input id="dp-b2-sqft" v-model.number="form.squareFeetCompletedBlock2" type="number" min="0" placeholder="0" />
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <Label for="dp-b2-lft" class="text-xs">Linear Feet</Label>
                      <p class="text-[10px] text-muted-foreground -mt-1">Edging, trim, shoe, base</p>
                      <Input id="dp-b2-lft" v-model.number="form.linearFeetCompletedBlock2" type="number" min="0" placeholder="0" />
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <Label for="dp-b2-count" class="text-xs">Count</Label>
                      <p class="text-[10px] text-muted-foreground -mt-1">Vents, stairs, boards</p>
                      <Input id="dp-b2-count" v-model.number="form.countBlock2" type="number" min="0" placeholder="0" />
                    </div>
                  </div>
                </div>
              </template>

              <!-- ── Block 3 Toggle ── -->
              <template v-if="section.id === 'block-3-toggle'">
                <div class="flex flex-col gap-2">
                  <Label class="flex items-center gap-1.5">
                    Did you do a third type of work today? <span class="text-destructive">*</span>
                  </Label>
                  <div class="flex gap-3 mt-1">
                    <button
                      v-for="opt in ['No', 'Yes']"
                      :key="opt"
                      class="flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all duration-150 min-w-[100px] justify-center"
                      :class="form.didYouDoAThirdTypeOfWorkToday === opt
                        ? 'bg-primary/10 text-primary border-primary/40 shadow-sm'
                        : 'bg-card text-muted-foreground border-border/50 hover:border-primary/30 hover:bg-muted/30'"
                      @click="form.didYouDoAThirdTypeOfWorkToday = opt"
                    >
                      <span
                        class="size-4 rounded-full border-2 flex items-center justify-center transition-colors"
                        :class="form.didYouDoAThirdTypeOfWorkToday === opt ? 'border-primary bg-primary' : 'border-border/60'"
                      >
                        <span v-if="form.didYouDoAThirdTypeOfWorkToday === opt" class="size-1.5 rounded-full bg-white" />
                      </span>
                      {{ opt }}
                    </button>
                  </div>
                </div>
              </template>

              <!-- ── Block 3 Details ── -->
              <template v-if="section.id === 'block-3-detail'">
                <div class="space-y-4">
                  <div class="flex flex-col gap-1.5">
                    <Label for="dp-b3-cat" class="flex items-center gap-1.5">Block 3 Category <span class="text-destructive">*</span></Label>
                    <Select v-model="form.block3Category">
                      <SelectTrigger id="dp-b3-cat">
                        <SelectValue placeholder="Choose category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem v-for="c in BLOCK_CATEGORIES" :key="c" :value="c">{{ c }}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div class="flex flex-col gap-1.5">
                      <Label for="dp-b3-hours" class="text-xs">Production Hours <span class="text-destructive">*</span></Label>
                      <p class="text-[10px] text-muted-foreground -mt-1">Use 1/4 hr increments</p>
                      <Input id="dp-b3-hours" v-model.number="form.productionHoursBlock3" type="number" min="0" step="0.25" placeholder="0.00" />
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <Label for="dp-b3-sqft" class="text-xs">Square Feet</Label>
                      <p class="text-[10px] text-muted-foreground -mt-1">Installation, sanding, finishing</p>
                      <Input id="dp-b3-sqft" v-model.number="form.squareFeetCompletedBlock3" type="number" min="0" placeholder="0" />
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <Label for="dp-b3-lft" class="text-xs">Linear Feet</Label>
                      <p class="text-[10px] text-muted-foreground -mt-1">Edging, trim, shoe, base</p>
                      <Input id="dp-b3-lft" v-model.number="form.linearFeetCompletedBlock3" type="number" min="0" placeholder="0" />
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <Label for="dp-b3-count" class="text-xs">Count</Label>
                      <p class="text-[10px] text-muted-foreground -mt-1">Vents, stairs, boards</p>
                      <Input id="dp-b3-count" v-model.number="form.countBlock3" type="number" min="0" placeholder="0" />
                    </div>
                  </div>
                </div>
              </template>

              <!-- ── Blockers ── -->
              <template v-if="section.id === 'blockers'">
                <div class="space-y-4">
                  <div class="flex flex-col gap-1.5">
                    <Label for="dp-blockers" class="flex items-center gap-1.5">
                      <Icon name="i-lucide-alert-triangle" class="size-3.5 text-muted-foreground" />
                      Any blockers that slowed you down today?
                    </Label>
                    <Textarea
                      id="dp-blockers"
                      v-model="form.anyBlockersThatSlowedYouDownToday"
                      rows="3"
                      placeholder="Describe any issues that impacted productivity..."
                      class="bg-background/50 resize-none"
                    />
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <Label for="dp-issues" class="flex items-center gap-1.5">
                      <Icon name="i-lucide-message-circle-warning" class="size-3.5 text-muted-foreground" />
                      Issues with the form / Missing data that needs to be captured
                    </Label>
                    <Textarea
                      id="dp-issues"
                      v-model="form.issuesWithTheFormMissingDataThatNeedsToBeCaptured"
                      rows="3"
                      placeholder="Any feedback on this form or data we missed..."
                      class="bg-background/50 resize-none"
                    />
                  </div>
                </div>
              </template>

            </div>

            <!-- Section Nav Buttons -->
            <div class="px-5 py-3 bg-muted/20 border-t border-border/40 flex items-center justify-between">
              <Button
                v-if="idx > 0"
                variant="ghost"
                size="sm"
                @click="activeSectionIdx = idx - 1"
              >
                <Icon name="i-lucide-chevron-left" class="mr-1 size-3.5" />
                Previous
              </Button>
              <div v-else />
              <Button
                v-if="idx < sections.length - 1"
                variant="ghost"
                size="sm"
                @click="activeSectionIdx = idx + 1"
              >
                Next
                <Icon name="i-lucide-chevron-right" class="ml-1 size-3.5" />
              </Button>
              <Button
                v-else
                size="sm"
                :disabled="saving"
                @click="saveRecord"
              >
                <Icon v-if="saving" name="i-lucide-loader-circle" class="mr-2 size-4 animate-spin" />
                <Icon v-else name="i-lucide-send" class="mr-1.5 size-3.5" />
                {{ editingId ? 'Save Changes' : 'Submit Report' }}
              </Button>
            </div>
          </div>
        </TransitionGroup>

        <!-- Bottom Summary Bar -->
        <div class="rounded-xl border border-border/50 bg-card p-5 flex items-center justify-between mt-6">
          <div class="flex items-center gap-3">
            <div
              class="size-10 rounded-full flex items-center justify-center"
              :class="progressPercent === 100 ? 'bg-emerald-500/15 text-emerald-500' : 'bg-muted/60 text-muted-foreground'"
            >
              <Icon :name="progressPercent === 100 ? 'i-lucide-check-circle-2' : 'i-lucide-circle-dashed'" class="size-5" />
            </div>
            <div>
              <p class="text-sm font-semibold">
                {{ progressPercent === 100 ? 'All sections completed!' : `${completedSections} of ${sections.length} sections filled` }}
              </p>
              <p class="text-xs text-muted-foreground">
                {{ progressPercent === 100 ? 'Ready to submit this report.' : 'Fill in remaining sections to complete your report.' }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <Button variant="outline" @click="cancelEdit">Cancel</Button>
            <Button :disabled="saving" @click="saveRecord">
              <Icon v-if="saving" name="i-lucide-loader-circle" class="mr-2 size-4 animate-spin" />
              {{ editingId ? 'Save Changes' : 'Submit Report' }}
            </Button>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.section-fade-enter-active,
.section-fade-leave-active {
  transition: all 0.3s ease;
}
.section-fade-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}
.section-fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
.scrollbar-none::-webkit-scrollbar {
  display: none;
}
.scrollbar-none {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
