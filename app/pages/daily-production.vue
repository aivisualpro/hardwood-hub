<script setup lang="ts">
import { toast } from 'vue-sonner'
import {
  CheckCircle2, TimerOff, Plus, HardHat, Check, X, Layers, Trash2,
  AlertTriangle, LoaderCircle, Send, Inbox, AlertOctagon, BarChart3, Download, ChevronsUpDown,
  Pencil, XCircle, Save
} from 'lucide-vue-next'

const { setHeader } = usePageHeader()
setHeader({ title: 'Daily Production Log', icon: 'i-lucide-clipboard-list', description: 'Log daily crew production for Ann Arbor Hardwoods' })

// ─── Constants ────────────────────────────────────────────
// Employees loaded from API
const employees = ref<{ _id: string; employee: string }[]>([])

async function loadEmployees() {
  try {
    const res = await $fetch<{ success: boolean; data: any[] }>('/api/employees')
    const allowed = ['crew member', 'supervisor']
    employees.value = (res.data || [])
      .filter((e: any) => allowed.includes(String(e.position || '').toLowerCase()) || String(e.employee || '').toLowerCase() === 'michael cornaire')
      .map((e: any) => ({ _id: String(e._id), employee: e.employee }))
      .sort((a: any, b: any) => a.employee.localeCompare(b.employee))
  } catch (e: any) {
    console.error('[Daily Production] Failed to load employees:', e?.message)
  }
}

// Subtype options loaded from DB dropdown
interface SubtypeOption { _id: string; label: string; value: string; color: string; icon: string; order: number; category: string }
const subtypeOptions = ref<SubtypeOption[]>([])

async function loadSubtypes() {
  try {
    const res = await $fetch<{ success: boolean; data: any }>('/api/dropdowns?name=Daily Production Sub Types')
    if (res.data?.options) {
      subtypeOptions.value = (res.data.options as SubtypeOption[])
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    }
  } catch (e: any) {
    console.error('[Daily Production] Failed to load subtypes:', e?.message)
  }
}

// Resolve ObjectId → display name
function empName(id: string | undefined): string {
  if (!id) return '—'
  return employees.value.find(e => e._id === String(id))?.employee ?? id
}

// CRM clients for job dropdown
const clients = ref<{ _id: string; name: string }[]>([])
const clientSearch = ref('')
const clientOpen = ref(false)

watch(clientOpen, (val) => {
  if (!val) {
    clientSearch.value = ''
  }
})

async function loadClients() {
  try {
    const res = await $fetch<{ success: boolean; data: any[] }>('/api/crm/clients-list')
    clients.value = (res.data || []).map((c: any) => ({ _id: c._id, name: c.name }))
  } catch (e: any) {
    console.error('[Daily Production] Failed to load clients:', e?.message)
  }
}

const filteredClients = computed(() => {
  const q = clientSearch.value.trim().toLowerCase()
  return q ? clients.value.filter(c => c.name.toLowerCase().includes(q)) : clients.value
})

function jobName(id: string | undefined): string {
  if (!id) return '—'
  return clients.value.find(c => c._id === String(id))?.name ?? id
}

const CATEGORY_SUBTYPES: Record<string, string[]> = {
  'Demo': ['Carpet removal', 'Hardwood removal — nailed', 'Hardwood removal — glued', 'Floating floor removal', 'Tile removal', 'Vinyl removal', 'Subfloor removal', 'Stair demo', 'Trim removal', 'Misc demo'],
  'Subfloor — Sheeting': ['1/4 underlayment', '15/32 sheeting', '23/32 sheeting', 'AdvanTech', 'Dricore', 'Plywood'],
  'Subfloor — Leveling': ['Self leveler', 'Grind and screw', 'Moisture barrier 1 coat', 'Moisture barrier 2 coats', 'Concrete prep'],
  'Installation — Staple': ['Unfinished standard', 'Unfinished on angle', 'Prefinished', 'Prefinished on angle', 'Prefinished less than 3/4'],
  'Installation — Cleat': ['Unfinished standard', 'Unfinished on angle', 'Prefinished', 'Hard species'],
  'Installation — Glue Assist': ['Unfinished greater than 4 inch', 'Prefinished greater than 4 inch'],
  'Installation — Full Glue Down': ['Unfinished engineered', 'Prefinished engineered', 'Click and lock glue'],
  'Installation — Floating': ['Click and lock', 'Glue T&G', 'Laminate', 'Vinyl plank'],
  'Installation — Pattern': ['Herringbone', 'Chevron', 'Diagonal / angle'],
  'Sanding': ['Big machine', 'Edger', 'Screen / buff'],
  'Staining': ['Duraseal standard', 'Custom color', 'Water pop prep'],
  'Finishing': ['Pallmann Pal X Gold', 'Loba Duo', 'Loba Supra AT', 'Loba Easy Finish', 'Loba Invisible', 'Emulsion Pro', 'Pall-X Power', 'Masterline', 'Magic oil', 'Rubio Mono Coat', 'Uno Coat', 'Screen and recoat'],
  'Repairs': ['Board replacement', 'Dutchman', 'Stitch in', 'Squeak repair', 'Gap fill'],
  'Stairs / Steps': ['Tread install', 'Riser install', 'Sand tread', 'Finish tread', 'Stain tread', 'Baluster work'],
  'Trim': ['Shoe removal', 'Shoe install — existing (save)', 'Shoe install — new', 'Base removal', 'Base install', 'Transitions', 'Custom milling'],
  'Site Prep': ['Plastic hanging', 'Door removal / reinstall', 'Appliance move — clear area', 'Appliance shuffle', 'Floor protection', 'Dustless setup'],
  'Shop Work': ['Tread finishing', 'Vent milling', 'Custom milling', 'Material prep'],
  'Admin / Other': ['Estimates', 'Material pickup', 'Dump run', 'Jobsite cleaning'],
}

// Categories from DB (falls back to hardcoded keys)
interface CategoryOption { _id: string; label: string; value: string; color: string; icon: string; order: number }
const dbCategoryOptions = ref<CategoryOption[]>([])

async function loadCategories() {
  try {
    const res = await $fetch<{ success: boolean; data: any }>('/api/dropdowns?name=Daily Production Categories')
    if (res.data?.options) {
      dbCategoryOptions.value = (res.data.options as CategoryOption[])
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    }
  } catch (e: any) {
    console.error('[Daily Production] Failed to load categories:', e?.message)
  }
}

const CATEGORIES = computed(() => {
  if (dbCategoryOptions.value.length > 0) {
    return dbCategoryOptions.value.map(o => o.value)
  }
  return Object.keys(CATEGORY_SUBTYPES)
})

const SANDING_EQUIPMENT = ['Big machine', 'Edger', 'Screen / buff'] as const
const GRITS = [36, 60, 80, 100, 120] as const

const BLOCKER_OPTIONS = [
  'Missing material', 'Equipment issue', 'Customer access',
  'Job not ready', 'Scheduling', 'Added work', 'Not feeling well', 'Other',
] as const

// Categories that show count field
const COUNT_CATEGORIES = ['Stairs / Steps', 'Site Prep', 'Repairs', 'Admin / Other']
// Categories that show trim LF field
const TRIM_CATEGORIES = ['Trim']

// ─── NP Item Definitions ─────────────────────────────────
const NP_DEFINITIONS = [
  { type: 'load_unload', label: 'Load / unload', defaults: { startMin: 45, endMin: 45 } },
  { type: 'sanding_setup', label: 'Sanding setup / breakdown', defaults: { setupMin: 45, breakdownMin: 45 } },
  { type: 'task_switch', label: 'Task switch (e.g. install to sand)', defaults: { minutes: 45 } },
  { type: 'appliance_move', label: 'Appliance move — clear area', defaults: { count: 1, minEachWay: 15 }, note: 'Move completely off work zone.' },
  { type: 'appliance_shuffle', label: 'Appliance shuffle', defaults: { count: 1, hoursEach: 2 }, note: 'Stays on work zone, full finish sequence runs underneath. This is the most disruptive event on a job.' },
  { type: 'plastic_protection', label: 'Plastic / surface protection', defaults: { minutes: 30 } },
  { type: 'door_removal', label: 'Door removal / reinstall', defaults: { count: 1 } },
  { type: 'other', label: 'Other', defaults: { description: '', minutes: 0 } },
] as const

// ─── Types ────────────────────────────────────────────────
interface WorkBlock {
  category: string
  subtype: string
  hours: number | undefined
  sqft: number | undefined
  edgeLf: number | undefined
  trimLf: number | undefined
  count: number | undefined
  equipment: string[]
  gritsBig: number[]
  gritsEdger: number[]
  shoeDisposition: string | null
  shoeCount: number | undefined
}

interface NpItem {
  type: string
  minutes: number
  detail: Record<string, any>
}

interface ProductionEntry {
  _id?: string
  date: string
  emp: string   // stored as ObjectId string
  job: string   // stored as ObjectId string (CrmSubmission)
  ontime: boolean | null
  blocks: WorkBlock[]
  np_items: NpItem[]
  np_total_mins: number
  blockers: string[]
  notes: string
  submitted?: string
  createdAt?: string
}

// ─── State ────────────────────────────────────────────────
const activeTab = ref<'log' | 'data' | 'export'>('log')
const records = ref<ProductionEntry[]>([])
const saving = ref(false)
const showResults = ref(false)
const lastSubmitted = ref<ProductionEntry | null>(null)

function switchTab(tab: 'log' | 'data' | 'export') {
  activeTab.value = tab
  if (tab !== 'log') showResults.value = false
}

// ─── Form State ──────────────────────────────────────────
function emptyBlock(): WorkBlock {
  return {
    category: '', subtype: '', hours: undefined, sqft: undefined,
    edgeLf: undefined, trimLf: undefined, count: undefined,
    equipment: [], gritsBig: [], gritsEdger: [],
    shoeDisposition: null, shoeCount: undefined,
  }
}

function emptyForm(): ProductionEntry {
  return {
    date: new Date().toISOString().split('T')[0]!,
    emp: '', job: '', ontime: null,
    blocks: [emptyBlock()],
    np_items: [], np_total_mins: 0,
    blockers: [], notes: '',
  }
}

const form = ref<ProductionEntry>(emptyForm())

// NP selection state — track which items are selected
const npSelected = ref<Record<string, boolean>>({})
const npDetails = ref<Record<string, Record<string, any>>>({})

// Initialize NP details with defaults
function initNpDefaults() {
  NP_DEFINITIONS.forEach(def => {
    npDetails.value[def.type] = { ...def.defaults }
  })
}
initNpDefaults()

// Helper for template v-model — guarantees non-undefined
function npd(type: string): Record<string, any> {
  if (!npDetails.value[type]) npDetails.value[type] = {}
  return npDetails.value[type]!
}

// ─── Computed ─────────────────────────────────────────────
function getSubtypes(category: string): SubtypeOption[] {
  if (!category) return []
  return subtypeOptions.value.filter(o => o.category === category)
}

function isSanding(block: WorkBlock) {
  return block.category === 'Sanding'
}

function isTrim(block: WorkBlock) {
  return TRIM_CATEGORIES.includes(block.category)
}

function showCount(block: WorkBlock) {
  return COUNT_CATEGORIES.includes(block.category)
}

function showTrimLf(block: WorkBlock) {
  return isTrim(block)
}

function isShoeRemoval(block: WorkBlock) {
  return block.category === 'Trim' && block.subtype === 'Shoe removal'
}

function hasBigMachine(block: WorkBlock) {
  return block.equipment.includes('Big machine')
}

function hasEdger(block: WorkBlock) {
  return block.equipment.includes('Edger')
}

// ─── Block Management ────────────────────────────────────
function addBlock() {
  if (form.value.blocks.length < 4) {
    form.value.blocks.push(emptyBlock())
  }
}

function removeBlock(idx: number) {
  if (form.value.blocks.length > 1) {
    form.value.blocks.splice(idx, 1)
  }
}

function onCategoryChange(block: WorkBlock) {
  block.subtype = ''
  block.equipment = []
  block.gritsBig = []
  block.gritsEdger = []
  block.shoeDisposition = null
  block.shoeCount = undefined
  block.edgeLf = undefined
  block.trimLf = undefined
  block.count = undefined
}

function toggleEquipment(block: WorkBlock, eq: string) {
  const idx = block.equipment.indexOf(eq)
  if (idx >= 0) {
    block.equipment.splice(idx, 1)
    if (eq === 'Big machine') block.gritsBig = []
    if (eq === 'Edger') block.gritsEdger = []
  } else {
    block.equipment.push(eq)
  }
}

function toggleGrit(arr: number[], grit: number) {
  const idx = arr.indexOf(grit)
  if (idx >= 0) arr.splice(idx, 1)
  else arr.push(grit)
}

// ─── NP Time ──────────────────────────────────────────────
function toggleNp(type: string) {
  npSelected.value[type] = !npSelected.value[type]
  if (!npSelected.value[type]) {
    // Reset to defaults when deselected
    const def = NP_DEFINITIONS.find(d => d.type === type)
    if (def) npDetails.value[type] = { ...def.defaults }
  }
}

function computeNpMinutes(type: string): number {
  const d = npDetails.value[type]
  if (!d) return 0
  switch (type) {
    case 'load_unload': return (d.startMin || 0) + (d.endMin || 0)
    case 'sanding_setup': return (d.setupMin || 0) + (d.breakdownMin || 0)
    case 'task_switch': return d.minutes || 0
    case 'appliance_move': return (d.count || 0) * (d.minEachWay || 0) * 2
    case 'appliance_shuffle': return (d.count || 0) * (d.hoursEach || 0) * 60
    case 'plastic_protection': return d.minutes || 0
    case 'door_removal': return (d.count || 0) * 15 // ~15 min per door
    case 'other': return d.minutes || 0
    default: return 0
  }
}

const totalNpMinutes = computed(() => {
  return NP_DEFINITIONS.reduce((sum, def) => {
    return sum + (npSelected.value[def.type] ? computeNpMinutes(def.type) : 0)
  }, 0)
})

// ─── Blocker toggle ──────────────────────────────────────
function toggleBlocker(b: string) {
  const idx = form.value.blockers.indexOf(b)
  if (idx >= 0) form.value.blockers.splice(idx, 1)
  else form.value.blockers.push(b)
}

// ─── SF/hr Calculation ───────────────────────────────────
function sfPerHr(block: WorkBlock): number {
  if (!block.hours || block.hours === 0 || !block.sqft) return 0
  return block.sqft / block.hours
}

function crewDaySf(block: WorkBlock): number {
  return sfPerHr(block) * 8 * 2
}

// ─── Data Fetching ───────────────────────────────────────
await useAsyncData('daily-production-v2', async () => {
  const res = await $fetch<{ success: boolean, data: ProductionEntry[] }>('/api/daily-production')
  records.value = res.data || []
  // Also sync to localStorage
  syncToLocalStorage()
  return true
})

async function fetchRecords() {
  try {
    const res = await $fetch<{ success: boolean, data: ProductionEntry[] }>('/api/daily-production')
    records.value = res.data || []
    syncToLocalStorage()
  } catch (e: any) {
    // Fallback to localStorage
    const cached = localStorage.getItem('prod-log-v2')
    if (cached) {
      try { records.value = JSON.parse(cached) } catch { /* silent */ }
    }
  }
}

function syncToLocalStorage() {
  try {
    localStorage.setItem('prod-log-v2', JSON.stringify(records.value))
  } catch { /* quota exceeded — silent */ }
}

// ─── Submit ──────────────────────────────────────────────
async function submitEntry() {
  if (!form.value.emp) return toast.error('Select an employee')
  if (!form.value.job) return toast.error('Select a job / client')
  if (form.value.ontime === null) return toast.error('Select on-time status')
  if (!form.value.blocks[0]?.category) return toast.error('Add at least one work block')

  saving.value = true

  // Build NP items from selection
  const npItems: NpItem[] = []
  NP_DEFINITIONS.forEach(def => {
    if (npSelected.value[def.type]) {
      npItems.push({
        type: def.type,
        minutes: computeNpMinutes(def.type),
        detail: { ...npDetails.value[def.type] },
      })
    }
  })

  const entry: any = {
    ...form.value,
    np_items: npItems,
    np_total_mins: totalNpMinutes.value,
    submitted: new Date().toISOString(),
  }

  try {
    await $fetch('/api/daily-production', { method: 'POST', body: entry })
    toast.success('Production logged!')
    lastSubmitted.value = { ...entry }
    showResults.value = true
    await fetchRecords()
  } catch (e: any) {
    toast.error('Save failed', { description: e?.message })
  } finally {
    saving.value = false
  }
}

function resetForm() {
  form.value = emptyForm()
  npSelected.value = {}
  initNpDefaults()
  showResults.value = false
  lastSubmitted.value = null
}

// ─── Data Tab ─────────────────────────────────────────────
const filterEmp = ref('__all__')
const filterCat = ref('__all__')

const filteredRecords = computed(() => {
  let list = [...records.value]
  if (filterEmp.value && filterEmp.value !== '__all__') list = list.filter(r => r.emp === filterEmp.value)
  if (filterCat.value && filterCat.value !== '__all__') list = list.filter(r => (r.blocks || []).some(b => b.category === filterCat.value))
  return list
})

const statDaysLogged = computed(() => {
  const dates = new Set(records.value.map(r => r.date))
  return dates.size
})

const statProductionHours = computed(() => {
  return records.value.reduce((sum, r) =>
    sum + (r.blocks || []).reduce((s, b) => s + (b.hours || 0), 0), 0)
})

const statTotalSf = computed(() => {
  return records.value.reduce((sum, r) =>
    sum + (r.blocks || []).reduce((s, b) => s + (b.sqft || 0), 0), 0)
})

const statTotalNp = computed(() => {
  return records.value.reduce((sum, r) => sum + (r.np_total_mins || 0), 0)
})

function formatDate(d: string) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Export Tab ───────────────────────────────────────────
const exportDateRange = computed(() => {
  if (!records.value.length) return '—'
  const dates = records.value.map(r => r.date).filter(Boolean).sort()
  return `${formatDate(dates[0]!)} – ${formatDate(dates[dates.length - 1]!)}`
})

const exportTotalBlocks = computed(() => {
  return records.value.reduce((sum, r) => sum + (r.blocks?.length || 0), 0)
})

function getNpLabel(type: string) {
  return NP_DEFINITIONS.find(d => d.type === type)?.label || type
}

function downloadCsv() {
  const headers = [
    'Date', 'Employee', 'Job', 'On time', 'Category', 'Subtype',
    'Shoe disposition', 'Hours', 'Square feet', 'Edge LF', 'Trim LF',
    'Count', 'SF/hr', 'Crew-day SF equivalent', 'Equipment',
    'Grits big machine', 'Grits edger', 'NP time minutes', 'NP detail',
    'Blockers', 'Notes',
  ]

  const rows: string[][] = []

  records.value.forEach(entry => {
    const blocks = entry.blocks || []
    if (blocks.length === 0) {
      // Entry with no blocks — still write a row for NP/blockers
      rows.push([
        entry.date, empName(entry.emp), jobName(entry.job),
        entry.ontime === true ? 'Yes' : entry.ontime === false ? 'No' : '',
        '', '', '', '', '', '', '', '', '', '', '', '', '',
        String(entry.np_total_mins || 0),
        (entry.np_items || []).map(n => `${getNpLabel(n.type)}:${n.minutes}min`).join('; '),
        (entry.blockers || []).join('; '),
        entry.notes || '',
      ])
      return
    }

    blocks.forEach((block, bIdx) => {
      const sfhr = block.hours && block.sqft ? (block.sqft / block.hours).toFixed(1) : ''
      const crewDay = sfhr ? (parseFloat(sfhr) * 8 * 2).toFixed(0) : ''

      const row = [
        entry.date, empName(entry.emp), jobName(entry.job),
        entry.ontime === true ? 'Yes' : entry.ontime === false ? 'No' : '',
        block.category, block.subtype,
        block.shoeDisposition || '',
        String(block.hours || ''), String(block.sqft || ''),
        String(block.edgeLf || ''), String(block.trimLf || ''),
        String(block.count || ''), sfhr, crewDay,
        (block.equipment || []).join('; '),
        (block.gritsBig || []).join('; '),
        (block.gritsEdger || []).join('; '),
        // NP only on first row
        bIdx === 0 ? String(entry.np_total_mins || 0) : '',
        bIdx === 0 ? (entry.np_items || []).map(n => `${getNpLabel(n.type)}:${n.minutes}min`).join('; ') : '',
        bIdx === 0 ? (entry.blockers || []).join('; ') : '',
        bIdx === 0 ? (entry.notes || '') : '',
      ]
      rows.push(row)
    })
  })

  const esc = (s: string) => `"${(s || '').replace(/"/g, '""')}"`
  const csv = [headers.join(','), ...rows.map(r => r.map(esc).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ann-arbor-production-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
  toast.success('CSV downloaded!')
}

// ─── Delete ──────────────────────────────────────────────
async function deleteRecord(id: string) {
  try {
    const idx = records.value.findIndex(r => r._id === id)
    if (idx !== -1) records.value.splice(idx, 1)
    await $fetch(`/api/daily-production/${id}`, { method: 'DELETE' })
    syncToLocalStorage()
    toast.success('Entry deleted')
  } catch (e: any) {
    toast.error('Delete failed', { description: e?.message })
    await fetchRecords()
  }
}

// ─── Edit ─────────────────────────────────────────────────
const editingRecord = ref<ProductionEntry | null>(null)
const editForm = ref<ProductionEntry>(emptyForm())
const editNpSelected = ref<Record<string, boolean>>({})
const editNpDetails = ref<Record<string, Record<string, any>>>({})
const editClientOpen = ref(false)
const editClientSearch = ref('')
const editSaving = ref(false)

watch(editClientOpen, (val) => { if (!val) editClientSearch.value = '' })

const filteredEditClients = computed(() => {
  const q = editClientSearch.value.trim().toLowerCase()
  return q ? clients.value.filter(c => c.name.toLowerCase().includes(q)) : clients.value
})

function npde(type: string): Record<string, any> {
  if (!editNpDetails.value[type]) editNpDetails.value[type] = {}
  return editNpDetails.value[type]!
}

function computeEditNpMinutes(type: string): number {
  return computeNpMinutesFromDetail(type, editNpDetails.value[type] || {})
}

function computeNpMinutesFromDetail(type: string, d: Record<string, any>): number {
  switch (type) {
    case 'load_unload': return (d.startMin || 0) + (d.endMin || 0)
    case 'sanding_setup': return (d.setupMin || 0) + (d.breakdownMin || 0)
    case 'task_switch': return d.minutes || 0
    case 'appliance_move': return (d.count || 0) * (d.minEachWay || 0) * 2
    case 'appliance_shuffle': return (d.count || 0) * (d.hoursEach || 0) * 60
    case 'plastic_protection': return d.minutes || 0
    case 'door_removal': return (d.count || 0) * 15
    case 'other': return d.minutes || 0
    default: return 0
  }
}

const editTotalNpMinutes = computed(() => {
  return NP_DEFINITIONS.reduce((sum, def) => {
    return sum + (editNpSelected.value[def.type] ? computeEditNpMinutes(def.type) : 0)
  }, 0)
})

function openEdit(entry: ProductionEntry) {
  editForm.value = JSON.parse(JSON.stringify(entry)) // deep clone
  // Restore NP selections from stored np_items
  editNpSelected.value = {}
  // Init defaults first
  NP_DEFINITIONS.forEach(def => {
    editNpDetails.value[def.type] = { ...def.defaults }
  })
  // Then overlay stored values
  ;(entry.np_items || []).forEach(np => {
    editNpSelected.value[np.type] = true
    editNpDetails.value[np.type] = { ...np.detail }
  })
  editingRecord.value = entry
  editClientOpen.value = false
  editClientSearch.value = ''
}

function closeEdit() {
  editingRecord.value = null
}

function toggleEditNp(type: string) {
  editNpSelected.value[type] = !editNpSelected.value[type]
  if (!editNpSelected.value[type]) {
    const def = NP_DEFINITIONS.find(d => d.type === type)
    if (def) editNpDetails.value[type] = { ...def.defaults }
  }
}

function toggleEditBlocker(b: string) {
  const idx = editForm.value.blockers.indexOf(b)
  if (idx >= 0) editForm.value.blockers.splice(idx, 1)
  else editForm.value.blockers.push(b)
}

function addEditBlock() {
  if (editForm.value.blocks.length < 4) {
    editForm.value.blocks.push(emptyBlock())
  }
}

function removeEditBlock(idx: number) {
  if (editForm.value.blocks.length > 1) {
    editForm.value.blocks.splice(idx, 1)
  }
}

function onEditCategoryChange(block: WorkBlock) {
  block.subtype = ''
  block.equipment = []
  block.gritsBig = []
  block.gritsEdger = []
  block.shoeDisposition = null
  block.shoeCount = undefined
  block.edgeLf = undefined
  block.trimLf = undefined
  block.count = undefined
}

async function updateRecord() {
  if (!editForm.value._id) return
  if (!editForm.value.emp) return toast.error('Select an employee')
  if (!editForm.value.job) return toast.error('Select a job / client')
  if (editForm.value.ontime === null) return toast.error('Select on-time status')

  editSaving.value = true
  // Build NP items from edit selection
  const npItems: NpItem[] = []
  NP_DEFINITIONS.forEach(def => {
    if (editNpSelected.value[def.type]) {
      npItems.push({
        type: def.type,
        minutes: computeEditNpMinutes(def.type),
        detail: { ...editNpDetails.value[def.type] },
      })
    }
  })

  const payload = {
    ...editForm.value,
    np_items: npItems,
    np_total_mins: editTotalNpMinutes.value,
  }

  try {
    const res = await $fetch<{ success: boolean; data: ProductionEntry }>(
      `/api/daily-production/${editForm.value._id}`,
      { method: 'PUT', body: payload }
    )
    // Update local record
    const idx = records.value.findIndex(r => r._id === editForm.value._id)
    if (idx !== -1) records.value[idx] = res.data
    syncToLocalStorage()
    toast.success('Entry updated!')
    closeEdit()
  } catch (e: any) {
    toast.error('Update failed', { description: e?.message })
  } finally {
    editSaving.value = false
  }
}

// Load dropdown data client-side only (avoids SSR 401 — cookie only available in browser)
onMounted(async () => {
  await Promise.all([loadEmployees(), loadClients(), loadSubtypes(), loadCategories()])
})
</script>

<template>
  <div class="relative">
    <div class="max-w-[420px] mx-auto px-3 pb-20">

      <!-- ═══════ TAB BAR ═══════ -->
      <div class="sticky top-0 z-30 bg-background/90 backdrop-blur-xl pt-3 pb-2 border-b border-border/50 -mx-3 px-3">
        <div class="flex rounded-xl bg-muted/50 p-1 gap-1">
          <button
            class="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200"
            :class="activeTab === 'log' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
            @click="switchTab('log')"
          >
            📋 Log
          </button>
          <button
            class="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200"
            :class="activeTab === 'data' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
            @click="switchTab('data')"
          >
            📊 Data
          </button>
          <button
            class="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200"
            :class="activeTab === 'export' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
            @click="switchTab('export')"
          >
            📤 Export
          </button>
        </div>
      </div>

      <!-- ═══════ TAB 1 — LOG ═══════ -->
      <div v-if="activeTab === 'log'" class="pt-4 space-y-4">

        <!-- Results View (after submit) -->
        <template v-if="showResults && lastSubmitted">
          <div class="space-y-3">
            <!-- Success header -->
            <div class="text-center py-4">
              <div class="size-14 mx-auto mb-3 rounded-full bg-emerald-500/15 flex items-center justify-center">
                <CheckCircle2 class="size-7 text-emerald-500" />
              </div>
              <h2 class="text-lg font-bold">Production Logged!</h2>
              <p class="text-xs text-muted-foreground mt-1">{{ empName(lastSubmitted.emp) }} · {{ formatDate(lastSubmitted.date) }}</p>
            </div>

            <!-- SF/hr results per block -->
            <div
              v-for="(block, idx) in lastSubmitted.blocks"
              :key="idx"
              class="rounded-xl border border-border/50 bg-card p-4"
            >
              <p class="text-xs text-muted-foreground font-medium mb-1">{{ block.category }} — {{ block.subtype }}</p>
              <div class="flex items-end gap-4">
                <div>
                  <p class="text-3xl font-black tabular-nums tracking-tight">
                    {{ block.hours && block.sqft ? (block.sqft / block.hours).toFixed(1) : '—' }}
                  </p>
                  <p class="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest mt-0.5">SF / hr</p>
                </div>
                <div class="border-l border-border/50 pl-4">
                  <p class="text-2xl font-bold tabular-nums text-primary/80">
                    {{ block.hours && block.sqft ? ((block.sqft / block.hours) * 8 * 2).toFixed(0) : '—' }}
                  </p>
                  <p class="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest mt-0.5">Crew-day SF</p>
                </div>
              </div>
              <p class="text-[10px] text-muted-foreground mt-2">{{ block.hours }}h · {{ block.sqft }} SF</p>
            </div>

            <!-- NP time amber card -->
            <div v-if="lastSubmitted.np_total_mins > 0" class="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-4">
              <div class="flex items-center gap-2 mb-2">
                <TimerOff class="size-4 text-amber-500" />
                <span class="text-sm font-bold text-amber-600 dark:text-amber-400">Non-Productive Time</span>
              </div>
              <p class="text-2xl font-black tabular-nums text-amber-600 dark:text-amber-400">
                {{ (lastSubmitted.np_total_mins / 60).toFixed(1) }}h
              </p>
              <p class="text-[10px] text-muted-foreground mt-1">
                {{ lastSubmitted.np_total_mins }} minutes — not counted against your production rate
              </p>
              <div v-if="lastSubmitted.np_items?.length" class="mt-2 space-y-1">
                <p
                  v-for="np in lastSubmitted.np_items"
                  :key="np.type"
                  class="text-[10px] text-amber-600/80 dark:text-amber-400/80"
                >
                  • {{ getNpLabel(np.type) }}: {{ np.minutes }} min
                </p>
              </div>
            </div>

            <!-- Reset button -->
            <Button class="w-full h-12 text-sm font-semibold" @click="resetForm">
              <Plus class="mr-2 size-4" />
              Log Another Day
            </Button>
          </div>
        </template>

        <!-- Form View -->
        <template v-else>
          <!-- ── Header Section ── -->
          <div class="rounded-xl border border-border/50 bg-card p-4 space-y-4">
            <div class="flex items-center gap-2 mb-1">
              <HardHat class="size-4 text-primary" />
              <span class="text-sm font-bold">Shift Info</span>
            </div>
            <!-- Row 1: Employee | Date -->
            <div class="grid grid-cols-2 gap-3">
              <!-- Employee -->
              <div class="flex flex-col gap-1.5">
                <Label for="dp-emp" class="text-xs font-medium text-foreground">Employee <span class="text-destructive">*</span></Label>
                <Select v-model="form.emp">
                  <SelectTrigger id="dp-emp" class="h-11 w-full border-input bg-transparent dark:bg-input/30">
                    <SelectValue placeholder="Select name" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="e in employees" :key="e._id" :value="e._id">{{ e.employee }}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <!-- Date -->
              <div class="flex flex-col gap-1.5">
                <Label for="dp-date" class="text-xs font-medium text-foreground">Date</Label>
                <Input id="dp-date" v-model="form.date" type="date" class="h-11 border-input bg-transparent dark:bg-input/30" />
              </div>
            </div>

            <!-- Row 2: Client | On Time -->
            <div class="grid grid-cols-2 gap-3">
              <!-- Job/Client -->
              <div class="flex flex-col gap-1.5">
                <Label class="text-xs font-medium text-foreground">Client <span class="text-destructive">*</span></Label>
                <Popover v-model:open="clientOpen">
                  <PopoverTrigger as-child>
                    <Button
                      variant="outline"
                      role="combobox"
                      :aria-expanded="clientOpen"
                      class="h-11 w-full flex items-center justify-between gap-2 border border-input bg-transparent dark:bg-input/30 px-3 text-sm rounded-md shadow-xs hover:bg-transparent text-left font-normal text-foreground"
                    >
                      <span :class="form.job ? 'text-foreground' : 'text-muted-foreground'" class="truncate">
                        {{ form.job ? jobName(form.job) : 'Select client' }}
                      </span>
                      <ChevronsUpDown class="size-4 shrink-0 opacity-50 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent class="p-0 z-50 w-[var(--radix-popover-trigger-width)]" align="start">
                    <div class="flex flex-col">
                      <!-- Search input — plain HTML, no Command interference -->
                      <div class="flex items-center gap-2 border-b border-border px-3 py-2">
                        <ChevronsUpDown class="size-3.5 shrink-0 opacity-40" />
                        <input
                          v-model="clientSearch"
                          class="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                          placeholder="Search client..."
                          autocomplete="off"
                        />
                      </div>
                      <!-- Results list -->
                      <ul class="max-h-[220px] overflow-y-auto p-1">
                        <li v-if="filteredClients.length === 0" class="py-4 text-center text-xs text-muted-foreground">No clients found</li>
                        <li
                          v-for="c in filteredClients"
                          :key="c._id"
                          class="flex items-center gap-2 rounded-sm px-3 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground select-none"
                          @click="() => { form.job = c._id; clientOpen = false }"
                        >
                          <Check :class="['size-4 shrink-0', form.job === c._id ? 'opacity-100 text-primary' : 'opacity-0']" />
                          <span class="flex-1 truncate">{{ c.name }}</span>
                        </li>
                      </ul>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <!-- On Time -->
              <div class="flex flex-col gap-1.5">
                <Label class="text-xs font-medium text-foreground">On Time? <span class="text-destructive">*</span></Label>
                <div class="flex gap-2 h-11">
                  <button
                    v-for="opt in [true, false]"
                    :key="String(opt)"
                    class="flex-1 flex items-center justify-center gap-1.5 rounded-md border text-sm transition-all duration-150"
                    :class="form.ontime === opt
                      ? opt ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/40 font-semibold' : 'bg-red-500/10 text-red-500 border-red-500/40 font-semibold'
                      : 'border-input bg-transparent dark:bg-input/30 text-muted-foreground hover:bg-muted/30 hover:text-foreground font-normal'"
                    @click="form.ontime = form.ontime === opt ? null : opt"
                  >
                    <Check v-if="opt" class="size-4" />
                    <X v-else class="size-4" />
                    {{ opt ? 'Yes' : 'No' }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- ── Work Blocks ── -->
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <Layers class="size-4 text-primary" />
                <span class="text-sm font-bold">Work Blocks</span>
              </div>
              <Button
                v-if="form.blocks.length < 4"
                variant="outline"
                size="sm"
                class="h-8 text-xs"
                @click="addBlock"
              >
                <Plus class="mr-1 size-3" />
                Add Block
              </Button>
            </div>

            <div
              v-for="(block, bIdx) in form.blocks"
              :key="bIdx"
              class="rounded-xl border border-border/50 bg-card p-4 space-y-3"
            >
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-muted-foreground uppercase tracking-wider">Block {{ bIdx + 1 }}</span>
                <button
                  v-if="form.blocks.length > 1"
                  class="text-muted-foreground hover:text-destructive transition-colors p-1"
                  @click="removeBlock(bIdx)"
                >
                  <Trash2 class="size-3.5" />
                </button>
              </div>

              <!-- Row 1: Category & Subtype -->
              <div class="grid grid-cols-2 gap-3">
                <!-- Category -->
                <div class="flex flex-col gap-1.5">
                  <Label class="text-xs font-medium">Category <span class="text-destructive">*</span></Label>
                  <Select v-model="block.category" @update:model-value="onCategoryChange(block)">
                    <SelectTrigger class="h-11">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="c in CATEGORIES" :key="c" :value="c">{{ c }}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <!-- Subtype -->
                <div class="flex flex-col gap-1.5">
                  <Label class="text-xs font-medium">Subtype</Label>
                  <Select v-model="block.subtype" :disabled="!block.category">
                    <SelectTrigger class="h-11">
                      <SelectValue :placeholder="block.category ? 'Select subtype' : 'Pick category first'" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="s in getSubtypes(block.category)" :key="s._id" :value="s.value">
                        <span class="flex items-center gap-2">
                          <span v-if="s.color" class="size-2 rounded-full shrink-0" :style="{ backgroundColor: s.color }" />
                          <Icon v-if="s.icon" :name="s.icon" class="size-3.5 shrink-0" />
                          {{ s.label }}
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>


              <!-- Sanding: Equipment checkboxes -->
              <template v-if="isSanding(block)">
                <div class="rounded-lg border border-violet-500/20 bg-violet-500/[0.03] p-3 space-y-3">
                  <span class="text-[10px] font-bold uppercase tracking-widest text-violet-400">Sanding Details</span>

                  <!-- Equipment -->
                  <div class="space-y-2">
                    <Label class="text-xs font-medium">Equipment Used</Label>
                    <div class="flex flex-wrap gap-2">
                      <button
                        v-for="eq in SANDING_EQUIPMENT"
                        :key="eq"
                        class="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all"
                        :class="block.equipment.includes(eq)
                          ? 'bg-violet-500/10 text-violet-500 border-violet-500/40'
                          : 'bg-card text-muted-foreground border-border/50 hover:bg-muted/30'"
                        @click="toggleEquipment(block, eq)"
                      >
                        <span
                          class="size-3.5 rounded-[3px] border-2 flex items-center justify-center transition-colors"
                          :class="block.equipment.includes(eq) ? 'bg-violet-500 border-violet-500 text-white' : 'border-border/60'"
                        >
                          <Check v-if="block.equipment.includes(eq)" class="size-2" />
                        </span>
                        {{ eq }}
                      </button>
                    </div>
                  </div>

                  <!-- Grits — Big machine -->
                  <div v-if="hasBigMachine(block)" class="space-y-2">
                    <Label class="text-xs font-medium">Grits — Big Machine</Label>
                    <div class="flex gap-1.5">
                      <button
                        v-for="g in GRITS"
                        :key="g"
                        class="flex-1 py-2 rounded-lg border text-xs font-bold transition-all text-center"
                        :class="block.gritsBig.includes(g)
                          ? 'bg-violet-500/15 text-violet-500 border-violet-500/40'
                          : 'bg-card text-muted-foreground border-border/50 hover:bg-muted/30'"
                        @click="toggleGrit(block.gritsBig, g)"
                      >
                        {{ g }}
                      </button>
                    </div>
                  </div>

                  <!-- Grits — Edger -->
                  <div v-if="hasEdger(block)" class="space-y-2">
                    <Label class="text-xs font-medium">Grits — Edger</Label>
                    <div class="flex gap-1.5">
                      <button
                        v-for="g in GRITS"
                        :key="g"
                        class="flex-1 py-2 rounded-lg border text-xs font-bold transition-all text-center"
                        :class="block.gritsEdger.includes(g)
                          ? 'bg-violet-500/15 text-violet-500 border-violet-500/40'
                          : 'bg-card text-muted-foreground border-border/50 hover:bg-muted/30'"
                        @click="toggleGrit(block.gritsEdger, g)"
                      >
                        {{ g }}
                      </button>
                    </div>
                  </div>

                  <!-- Edge LF -->
                  <div class="flex flex-col gap-1.5">
                    <Label class="text-xs font-medium">Edge Linear Feet <span class="text-[10px] text-muted-foreground font-normal">(edge LF only)</span></Label>
                    <Input v-model.number="block.edgeLf" type="number" min="0" placeholder="0" class="h-11" />
                  </div>
                </div>
              </template>

              <!-- Shoe disposition (Trim → Shoe removal) -->
              <div v-if="isShoeRemoval(block)" class="rounded-lg border border-amber-500/20 bg-amber-500/[0.03] p-3 space-y-2">
                <span class="text-[10px] font-bold uppercase tracking-widest text-amber-500">Shoe Molding Disposition</span>
                <div class="flex gap-2">
                  <button
                    class="flex-1 py-3 rounded-lg border text-sm font-bold transition-all"
                    :class="block.shoeDisposition === 'save'
                      ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/40'
                      : 'bg-card text-muted-foreground border-border/50 hover:bg-muted/30'"
                    @click="block.shoeDisposition = block.shoeDisposition === 'save' ? null : 'save'"
                  >
                    ✓ Save & Number
                  </button>
                  <button
                    class="flex-1 py-3 rounded-lg border text-sm font-bold transition-all"
                    :class="block.shoeDisposition === 'dispose'
                      ? 'bg-red-500/15 text-red-500 border-red-500/40'
                      : 'bg-card text-muted-foreground border-border/50 hover:bg-muted/30'"
                    @click="block.shoeDisposition = block.shoeDisposition === 'dispose' ? null : 'dispose'"
                  >
                    ✕ Dispose
                  </button>
                </div>
                <div v-if="block.shoeDisposition === 'save'" class="flex flex-col gap-1.5 mt-1">
                  <Label class="text-xs font-medium">Number of pieces saved</Label>
                  <Input v-model.number="block.shoeCount" type="number" min="0" placeholder="0" class="h-11" />
                </div>
              </div>

              <!-- Production hours + SF (always shown) -->
              <div class="grid grid-cols-2 gap-3">
                <div class="flex flex-col gap-1.5">
                  <Label class="text-xs font-medium">Prod. Hours <span class="text-destructive">*</span></Label>
                  <Input v-model.number="block.hours" type="number" min="0" step="0.25" placeholder="0.00" class="h-11" />
                </div>
                <div class="flex flex-col gap-1.5">
                  <Label class="text-xs font-medium">Square Feet</Label>
                  <Input v-model.number="block.sqft" type="number" min="0" placeholder="0" class="h-11" />
                </div>
              </div>

              <!-- Trim LF (Trim category) -->
              <div v-if="showTrimLf(block)" class="flex flex-col gap-1.5">
                <Label class="text-xs font-medium">Trim Linear Feet</Label>
                <Input v-model.number="block.trimLf" type="number" min="0" placeholder="0" class="h-11" />
              </div>

              <!-- Count (Stairs, Site Prep, Repairs, Admin) -->
              <div v-if="showCount(block)" class="flex flex-col gap-1.5">
                <Label class="text-xs font-medium">Count</Label>
                <Input v-model.number="block.count" type="number" min="0" placeholder="0" class="h-11" />
              </div>
            </div>
          </div>

          <!-- ── Non-Productive Time ── -->
          <div class="rounded-xl border border-border/50 bg-card p-4 space-y-3">
            <div class="flex items-center gap-2 mb-1">
              <TimerOff class="size-4 text-amber-500" />
              <span class="text-sm font-bold">Non-Productive Time</span>
            </div>
            <p class="text-[10px] text-muted-foreground -mt-1">Tap items that apply today. Time is tracked separately and never blended into production rates.</p>

            <div class="space-y-2">
              <div v-for="npDef in NP_DEFINITIONS" :key="npDef.type">
                <!-- Toggle Button -->
                <button
                  class="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left text-sm font-medium transition-all"
                  :class="npSelected[npDef.type]
                    ? 'bg-amber-500/[0.08] text-amber-600 dark:text-amber-400 border-amber-500/30'
                    : 'bg-card text-muted-foreground border-border/50 hover:bg-muted/20'"
                  @click="toggleNp(npDef.type)"
                >
                  <span
                    class="size-4 rounded-[3px] border-2 flex items-center justify-center shrink-0 transition-colors"
                    :class="npSelected[npDef.type] ? 'bg-amber-500 border-amber-500 text-white' : 'border-border/60'"
                  >
                    <Check v-if="npSelected[npDef.type]" class="size-2.5" />
                  </span>
                  {{ npDef.label }}
                </button>

                <!-- Expanded Detail -->
                <div v-if="npSelected[npDef.type]" class="ml-6 mt-1.5 mb-2 space-y-2">
                  <!-- Note if exists -->
                  <p v-if="'note' in npDef" class="text-[10px] text-amber-600/70 dark:text-amber-400/70 italic">{{ (npDef as any).note }}</p>

                  <!-- Load/Unload -->
                  <template v-if="npDef.type === 'load_unload'">
                    <div class="grid grid-cols-2 gap-2">
                      <div class="flex flex-col gap-1">
                        <Label class="text-[10px]">Start (min)</Label>
                        <Input v-model.number="npd(npDef.type).startMin" type="number" min="0" class="h-9 text-xs" />
                      </div>
                      <div class="flex flex-col gap-1">
                        <Label class="text-[10px]">End (min)</Label>
                        <Input v-model.number="npd(npDef.type).endMin" type="number" min="0" class="h-9 text-xs" />
                      </div>
                    </div>
                  </template>

                  <!-- Sanding Setup -->
                  <template v-if="npDef.type === 'sanding_setup'">
                    <div class="grid grid-cols-2 gap-2">
                      <div class="flex flex-col gap-1">
                        <Label class="text-[10px]">Setup (min)</Label>
                        <Input v-model.number="npd(npDef.type).setupMin" type="number" min="0" class="h-9 text-xs" />
                      </div>
                      <div class="flex flex-col gap-1">
                        <Label class="text-[10px]">Breakdown (min)</Label>
                        <Input v-model.number="npd(npDef.type).breakdownMin" type="number" min="0" class="h-9 text-xs" />
                      </div>
                    </div>
                  </template>

                  <!-- Task Switch -->
                  <template v-if="npDef.type === 'task_switch'">
                    <div class="flex flex-col gap-1">
                      <Label class="text-[10px]">Time (min)</Label>
                      <Input v-model.number="npd(npDef.type).minutes" type="number" min="0" class="h-9 text-xs" />
                    </div>
                  </template>

                  <!-- Appliance Move -->
                  <template v-if="npDef.type === 'appliance_move'">
                    <div class="grid grid-cols-2 gap-2">
                      <div class="flex flex-col gap-1">
                        <Label class="text-[10px]"># Appliances</Label>
                        <Input v-model.number="npd(npDef.type).count" type="number" min="0" class="h-9 text-xs" />
                      </div>
                      <div class="flex flex-col gap-1">
                        <Label class="text-[10px]">Min each way</Label>
                        <Input v-model.number="npd(npDef.type).minEachWay" type="number" min="0" class="h-9 text-xs" />
                      </div>
                    </div>
                  </template>

                  <!-- Appliance Shuffle -->
                  <template v-if="npDef.type === 'appliance_shuffle'">
                    <div class="grid grid-cols-2 gap-2">
                      <div class="flex flex-col gap-1">
                        <Label class="text-[10px]"># Appliances</Label>
                        <Input v-model.number="npd(npDef.type).count" type="number" min="0" class="h-9 text-xs" />
                      </div>
                      <div class="flex flex-col gap-1">
                        <Label class="text-[10px]">Hours each</Label>
                        <Input v-model.number="npd(npDef.type).hoursEach" type="number" min="0" step="0.5" class="h-9 text-xs" />
                      </div>
                    </div>
                  </template>

                  <!-- Plastic / Protection -->
                  <template v-if="npDef.type === 'plastic_protection'">
                    <div class="flex flex-col gap-1">
                      <Label class="text-[10px]">Time (min)</Label>
                      <Input v-model.number="npd(npDef.type).minutes" type="number" min="0" class="h-9 text-xs" />
                    </div>
                  </template>

                  <!-- Door Removal -->
                  <template v-if="npDef.type === 'door_removal'">
                    <div class="flex flex-col gap-1">
                      <Label class="text-[10px]"># Doors</Label>
                      <Input v-model.number="npd(npDef.type).count" type="number" min="0" class="h-9 text-xs" />
                    </div>
                  </template>

                  <!-- Other -->
                  <template v-if="npDef.type === 'other'">
                    <div class="flex flex-col gap-1">
                      <Label class="text-[10px]">Description</Label>
                      <Input v-model="npd(npDef.type).description" placeholder="Describe..." class="h-9 text-xs" />
                    </div>
                    <div class="flex flex-col gap-1">
                      <Label class="text-[10px]">Time (min)</Label>
                      <Input v-model.number="npd(npDef.type).minutes" type="number" min="0" class="h-9 text-xs" />
                    </div>
                  </template>

                  <!-- Computed time -->
                  <p class="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                    = {{ computeNpMinutes(npDef.type) }} minutes
                  </p>
                </div>
              </div>
            </div>

            <!-- NP Total -->
            <div v-if="totalNpMinutes > 0" class="pt-2 border-t border-amber-500/20">
              <div class="flex items-center justify-between">
                <span class="text-xs font-semibold text-amber-600 dark:text-amber-400">Total NP Time</span>
                <span class="text-sm font-black text-amber-600 dark:text-amber-400 tabular-nums">{{ (totalNpMinutes / 60).toFixed(1) }}h ({{ totalNpMinutes }}min)</span>
              </div>
            </div>
          </div>

          <!-- ── Blockers ── -->
          <div class="rounded-xl border border-border/50 bg-card p-4 space-y-3">
            <div class="flex items-center gap-2 mb-1">
              <AlertTriangle class="size-4 text-destructive" />
              <span class="text-sm font-bold">Blockers</span>
            </div>

            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="b in BLOCKER_OPTIONS"
                :key="b"
                class="flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-medium transition-all"
                :class="form.blockers.includes(b)
                  ? 'bg-destructive/10 text-destructive border-destructive/30'
                  : 'bg-card text-muted-foreground border-border/50 hover:bg-muted/20'"
                @click="toggleBlocker(b)"
              >
                <span
                  class="size-3.5 rounded-[3px] border-2 flex items-center justify-center shrink-0 transition-colors"
                  :class="form.blockers.includes(b) ? 'bg-destructive border-destructive text-white' : 'border-border/60'"
                >
                  <Check v-if="form.blockers.includes(b)" class="size-2" />
                </span>
                {{ b }}
              </button>
            </div>

            <div class="flex flex-col gap-1.5">
              <Label class="text-xs font-medium">Notes</Label>
              <Textarea
                v-model="form.notes"
                rows="2"
                placeholder="Additional notes..."
                class="bg-background/50 resize-none text-sm"
              />
            </div>
          </div>

          <!-- ── Submit ── -->
          <Button
            class="w-full h-12 text-sm font-semibold"
            :disabled="saving"
            @click="submitEntry"
          >
            <LoaderCircle v-if="saving" class="mr-2 size-4 animate-spin" />
            <Send v-else class="mr-2 size-4" />
            Submit Production Log
          </Button>
        </template>
      </div>

      <!-- ═══════ TAB 2 — DATA ═══════ -->
      <div v-if="activeTab === 'data'" class="pt-4 space-y-4">

        <!-- Stat Cards -->
        <div class="grid grid-cols-2 gap-2">
          <div class="rounded-xl border border-border/50 bg-card p-3">
            <p class="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Days Logged</p>
            <p class="text-2xl font-black tabular-nums mt-0.5">{{ statDaysLogged }}</p>
          </div>
          <div class="rounded-xl border border-border/50 bg-card p-3">
            <p class="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Prod. Hours</p>
            <p class="text-2xl font-black tabular-nums mt-0.5">{{ statProductionHours.toFixed(1) }}</p>
          </div>
          <div class="rounded-xl border border-border/50 bg-card p-3">
            <p class="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Total SF</p>
            <p class="text-2xl font-black tabular-nums mt-0.5">{{ statTotalSf.toLocaleString() }}</p>
          </div>
          <div class="rounded-xl border border-amber-500/30 bg-amber-500/[0.04] p-3">
            <p class="text-[10px] text-amber-600 dark:text-amber-400 font-semibold uppercase tracking-wider">NP Hours</p>
            <p class="text-2xl font-black tabular-nums mt-0.5 text-amber-600 dark:text-amber-400">{{ (statTotalNp / 60).toFixed(1) }}</p>
          </div>
        </div>

        <!-- Filters -->
        <div class="grid grid-cols-2 gap-2">
          <Select v-model="filterEmp">
            <SelectTrigger class="h-10 text-xs">
              <SelectValue placeholder="All employees" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All employees</SelectItem>
              <SelectItem v-for="e in employees" :key="e._id" :value="e._id">{{ e.employee }}</SelectItem>
            </SelectContent>
          </Select>
          <Select v-model="filterCat">
            <SelectTrigger class="h-10 text-xs">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All categories</SelectItem>
              <SelectItem v-for="c in CATEGORIES" :key="c" :value="c">{{ c }}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- Entries List -->
        <div v-if="filteredRecords.length === 0" class="py-12 text-center">
          <Inbox class="size-10 text-muted-foreground/30 mx-auto mb-3" />
          <p class="text-sm text-muted-foreground">No entries yet</p>
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="entry in filteredRecords"
            :key="entry._id"
            class="rounded-xl border border-border/50 bg-card p-3 space-y-2"
          >
            <!-- Header row -->
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0 flex-1">
                <p class="text-sm font-bold truncate">{{ empName(entry.emp) }}</p>
                <p class="text-[10px] text-muted-foreground">{{ jobName(entry.job) }}</p>
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                <span class="text-[10px] text-muted-foreground">{{ formatDate(entry.date) }}</span>
                <span
                  class="inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-bold border"
                  :class="entry.ontime === true ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                          entry.ontime === false ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                          'bg-muted text-muted-foreground border-border'"
                >
                  {{ entry.ontime === true ? '✓' : entry.ontime === false ? 'Late' : '—' }}
                </span>
              </div>
            </div>

            <!-- Work blocks -->
            <div v-for="(block, bIdx) in entry.blocks" :key="bIdx" class="flex items-center gap-2 text-xs">
              <span class="inline-flex px-1.5 py-0.5 rounded bg-muted text-[10px] font-semibold shrink-0">
                {{ block.category }}
              </span>
              <span class="text-muted-foreground truncate">{{ block.subtype }}</span>
              <span class="ml-auto font-mono font-semibold tabular-nums shrink-0">
                {{ block.hours }}h · {{ block.sqft || 0 }}sf
              </span>
              <span v-if="block.hours && block.sqft" class="font-mono text-primary font-bold tabular-nums shrink-0">
                {{ (block.sqft / block.hours).toFixed(1) }}/hr
              </span>
            </div>

            <!-- Shoe disposition -->
            <div
              v-for="(block, bIdx) in (entry.blocks || []).filter(b => b.shoeDisposition)"
              :key="'shoe-' + bIdx"
              class="text-[10px] font-semibold"
              :class="block.shoeDisposition === 'save' ? 'text-emerald-500' : 'text-red-500'"
            >
              Shoe: {{ block.shoeDisposition === 'save' ? `Save (${block.shoeCount || 0} pcs)` : 'Dispose' }}
            </div>

            <!-- NP time -->
            <div v-if="entry.np_total_mins" class="flex items-center gap-1.5 text-[10px] text-amber-600 dark:text-amber-400">
              <TimerOff class="size-3" />
              <span class="font-semibold">{{ (entry.np_total_mins / 60).toFixed(1) }}h NP</span>
              <span class="text-amber-500/60">({{ (entry.np_items || []).filter(n => n && n.type).map(n => getNpLabel(n.type)).join(', ') }})</span>
            </div>

            <!-- Blockers -->
            <div v-if="entry.blockers?.length" class="flex flex-wrap gap-1">
              <span
                v-for="b in entry.blockers"
                :key="b"
                class="inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold bg-destructive/10 text-destructive border border-destructive/20"
              >
                {{ b }}
              </span>
            </div>

            <!-- Appliance shuffle flag -->
            <div
              v-if="(entry.np_items || []).some(n => n.type === 'appliance_shuffle')"
              class="flex items-center gap-1.5 rounded-md bg-red-500/10 border border-red-500/20 px-2 py-1.5"
            >
              <AlertOctagon class="size-3 text-red-500" />
              <span class="text-[10px] font-bold text-red-500">APPLIANCE SHUFFLE — most disruptive event</span>
            </div>

            <!-- Actions -->
            <div class="flex items-center justify-between pt-1 border-t border-border/30">
              <button
                class="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
                @click="openEdit(entry)"
              >
                <Pencil class="size-3" />
                Edit
              </button>
              <button
                class="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                @click="deleteRecord(entry._id!)"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══════ EDIT RECORD SHEET (content-area overlay) ═══════ -->
      <div
        v-show="editingRecord"
        class="edit-overlay absolute inset-0 z-50 flex flex-col bg-background"
        :class="editingRecord ? 'edit-overlay--visible' : ''"
      >
            <!-- Header -->
            <div class="flex items-center gap-2 px-4 py-3 border-b border-border/50 bg-background/95 backdrop-blur-xl">
              <div class="flex-1 min-w-0">
                <p class="text-sm font-bold truncate">Edit Entry</p>
                <p class="text-[10px] text-muted-foreground">{{ empName(editForm.emp) }} · {{ formatDate(editForm.date) }}</p>
              </div>
              <Button variant="outline" size="sm" class="h-8 text-xs" :disabled="editSaving" @click="closeEdit">
                <X class="size-3" />
                Cancel
              </Button>
              <Button size="sm" class="h-8 text-xs gap-1.5" :disabled="editSaving" @click="updateRecord">
                <LoaderCircle v-if="editSaving" class="size-3 animate-spin" />
                <Save v-else class="size-3" />
                Save
              </Button>
            </div>

            <!-- Scrollable Body -->
            <div class="flex-1 overflow-y-auto">
              <div class="max-w-[420px] mx-auto px-4 py-4 space-y-4">

                <!-- Shift Info -->
                <div class="rounded-xl border border-border/50 bg-card p-4 space-y-4">
                  <div class="flex items-center gap-2">
                    <HardHat class="size-4 text-primary" />
                    <span class="text-sm font-bold">Shift Info</span>
                  </div>
                  <div class="grid grid-cols-2 gap-3">
                    <!-- Employee -->
                    <div class="flex flex-col gap-1.5">
                      <Label class="text-xs font-medium">Employee <span class="text-destructive">*</span></Label>
                      <Select v-model="editForm.emp">
                        <SelectTrigger class="h-11 border-input bg-transparent dark:bg-input/30">
                          <SelectValue placeholder="Select name" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem v-for="e in employees" :key="e._id" :value="e._id">{{ e.employee }}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <!-- Date -->
                    <div class="flex flex-col gap-1.5">
                      <Label class="text-xs font-medium">Date</Label>
                      <Input v-model="editForm.date" type="date" class="h-11 border-input bg-transparent dark:bg-input/30" />
                    </div>
                  </div>

                  <div class="grid grid-cols-2 gap-3">
                    <!-- Client -->
                    <div class="flex flex-col gap-1.5">
                      <Label class="text-xs font-medium">Client <span class="text-destructive">*</span></Label>
                      <Popover v-model:open="editClientOpen">
                        <PopoverTrigger as-child>
                          <Button
                            variant="outline"
                            role="combobox"
                            class="h-11 w-full flex items-center justify-between gap-2 border border-input bg-transparent dark:bg-input/30 px-3 text-sm rounded-md shadow-xs hover:bg-transparent text-left font-normal text-foreground"
                          >
                            <span :class="editForm.job ? 'text-foreground' : 'text-muted-foreground'" class="truncate">
                              {{ editForm.job ? jobName(editForm.job) : 'Select client' }}
                            </span>
                            <ChevronsUpDown class="size-4 shrink-0 opacity-50 text-muted-foreground" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent class="p-0 z-[60] w-[var(--radix-popover-trigger-width)]" align="start">
                          <div class="flex flex-col">
                            <div class="flex items-center gap-2 border-b border-border px-3 py-2">
                              <ChevronsUpDown class="size-3.5 shrink-0 opacity-40" />
                              <input
                                v-model="editClientSearch"
                                class="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                                placeholder="Search client..."
                                autocomplete="off"
                              />
                            </div>
                            <ul class="max-h-[220px] overflow-y-auto p-1">
                              <li v-if="filteredEditClients.length === 0" class="py-4 text-center text-xs text-muted-foreground">No clients found</li>
                              <li
                                v-for="c in filteredEditClients"
                                :key="c._id"
                                class="flex items-center gap-2 rounded-sm px-3 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground select-none"
                                @click="() => { editForm.job = c._id; editClientOpen = false }"
                              >
                                <Check :class="['size-4 shrink-0', editForm.job === c._id ? 'opacity-100 text-primary' : 'opacity-0']" />
                                <span class="flex-1 truncate">{{ c.name }}</span>
                              </li>
                            </ul>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <!-- On Time -->
                    <div class="flex flex-col gap-1.5">
                      <Label class="text-xs font-medium">On Time? <span class="text-destructive">*</span></Label>
                      <div class="flex gap-2 h-11">
                        <button
                          v-for="opt in [true, false]"
                          :key="String(opt)"
                          class="flex-1 flex items-center justify-center gap-1.5 rounded-md border text-sm transition-all duration-150"
                          :class="editForm.ontime === opt
                            ? opt ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/40 font-semibold' : 'bg-red-500/10 text-red-500 border-red-500/40 font-semibold'
                            : 'border-input bg-transparent dark:bg-input/30 text-muted-foreground hover:bg-muted/30 font-normal'"
                          @click="editForm.ontime = editForm.ontime === opt ? null : opt"
                        >
                          <Check v-if="opt" class="size-4" />
                          <X v-else class="size-4" />
                          {{ opt ? 'Yes' : 'No' }}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Work Blocks -->
                <div class="space-y-3">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <Layers class="size-4 text-primary" />
                      <span class="text-sm font-bold">Work Blocks</span>
                    </div>
                    <Button v-if="editForm.blocks.length < 4" variant="outline" size="sm" class="h-8 text-xs" @click="addEditBlock">
                      <Plus class="mr-1 size-3" /> Add Block
                    </Button>
                  </div>

                  <div v-for="(block, bIdx) in editForm.blocks" :key="bIdx" class="rounded-xl border border-border/50 bg-card p-4 space-y-3">
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-bold text-muted-foreground uppercase tracking-wider">Block {{ bIdx + 1 }}</span>
                      <button v-if="editForm.blocks.length > 1" class="text-muted-foreground hover:text-destructive transition-colors p-1" @click="removeEditBlock(bIdx)">
                        <Trash2 class="size-3.5" />
                      </button>
                    </div>

                    <!-- Row 1: Category & Subtype -->
                    <div class="grid grid-cols-2 gap-3">
                      <!-- Category -->
                      <div class="flex flex-col gap-1.5">
                        <Label class="text-xs font-medium">Category <span class="text-destructive">*</span></Label>
                        <Select v-model="block.category" @update:model-value="onEditCategoryChange(block)">
                          <SelectTrigger class="h-11"><SelectValue placeholder="Select category" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem v-for="c in CATEGORIES" :key="c" :value="c">{{ c }}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <!-- Subtype -->
                      <div class="flex flex-col gap-1.5">
                        <Label class="text-xs font-medium">Subtype</Label>
                        <Select v-model="block.subtype" :disabled="!block.category">
                          <SelectTrigger class="h-11"><SelectValue :placeholder="block.category ? 'Select subtype' : 'Pick category first'" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem v-for="s in getSubtypes(block.category)" :key="s._id" :value="s.value">
                              <span class="flex items-center gap-2">
                                <span v-if="s.color" class="size-2 rounded-full shrink-0" :style="{ backgroundColor: s.color }" />
                                <Icon v-if="s.icon" :name="s.icon" class="size-3.5 shrink-0" />
                                {{ s.label }}
                              </span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>


                    <!-- Sanding Details -->
                    <template v-if="isSanding(block)">
                      <div class="rounded-lg border border-violet-500/20 bg-violet-500/[0.03] p-3 space-y-3">
                        <span class="text-[10px] font-bold uppercase tracking-widest text-violet-400">Sanding Details</span>
                        <div class="space-y-2">
                          <Label class="text-xs font-medium">Equipment Used</Label>
                          <div class="flex flex-wrap gap-2">
                            <button
                              v-for="eq in SANDING_EQUIPMENT" :key="eq"
                              class="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all"
                              :class="block.equipment.includes(eq) ? 'bg-violet-500/10 text-violet-500 border-violet-500/40' : 'bg-card text-muted-foreground border-border/50 hover:bg-muted/30'"
                              @click="toggleEquipment(block, eq)"
                            >
                              <span class="size-3.5 rounded-[3px] border-2 flex items-center justify-center transition-colors" :class="block.equipment.includes(eq) ? 'bg-violet-500 border-violet-500 text-white' : 'border-border/60'">
                                <Check v-if="block.equipment.includes(eq)" class="size-2" />
                              </span>
                              {{ eq }}
                            </button>
                          </div>
                        </div>
                        <div v-if="hasBigMachine(block)" class="space-y-2">
                          <Label class="text-xs font-medium">Grits — Big Machine</Label>
                          <div class="flex gap-1.5">
                            <button v-for="g in GRITS" :key="g" class="flex-1 py-2 rounded-lg border text-xs font-bold transition-all text-center" :class="block.gritsBig.includes(g) ? 'bg-violet-500/15 text-violet-500 border-violet-500/40' : 'bg-card text-muted-foreground border-border/50 hover:bg-muted/30'" @click="toggleGrit(block.gritsBig, g)">{{ g }}</button>
                          </div>
                        </div>
                        <div v-if="hasEdger(block)" class="space-y-2">
                          <Label class="text-xs font-medium">Grits — Edger</Label>
                          <div class="flex gap-1.5">
                            <button v-for="g in GRITS" :key="g" class="flex-1 py-2 rounded-lg border text-xs font-bold transition-all text-center" :class="block.gritsEdger.includes(g) ? 'bg-violet-500/15 text-violet-500 border-violet-500/40' : 'bg-card text-muted-foreground border-border/50 hover:bg-muted/30'" @click="toggleGrit(block.gritsEdger, g)">{{ g }}</button>
                          </div>
                        </div>
                        <div class="flex flex-col gap-1.5">
                          <Label class="text-xs font-medium">Edge Linear Feet</Label>
                          <Input v-model.number="block.edgeLf" type="number" min="0" placeholder="0" class="h-11" />
                        </div>
                      </div>
                    </template>

                    <!-- Shoe disposition -->
                    <div v-if="isShoeRemoval(block)" class="rounded-lg border border-amber-500/20 bg-amber-500/[0.03] p-3 space-y-2">
                      <span class="text-[10px] font-bold uppercase tracking-widest text-amber-500">Shoe Molding Disposition</span>
                      <div class="flex gap-2">
                        <button class="flex-1 py-3 rounded-lg border text-sm font-bold transition-all" :class="block.shoeDisposition === 'save' ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/40' : 'bg-card text-muted-foreground border-border/50 hover:bg-muted/30'" @click="block.shoeDisposition = block.shoeDisposition === 'save' ? null : 'save'">✓ Save & Number</button>
                        <button class="flex-1 py-3 rounded-lg border text-sm font-bold transition-all" :class="block.shoeDisposition === 'dispose' ? 'bg-red-500/15 text-red-500 border-red-500/40' : 'bg-card text-muted-foreground border-border/50 hover:bg-muted/30'" @click="block.shoeDisposition = block.shoeDisposition === 'dispose' ? null : 'dispose'">✕ Dispose</button>
                      </div>
                      <div v-if="block.shoeDisposition === 'save'" class="flex flex-col gap-1.5 mt-1">
                        <Label class="text-xs font-medium">Number of pieces saved</Label>
                        <Input v-model.number="block.shoeCount" type="number" min="0" placeholder="0" class="h-11" />
                      </div>
                    </div>

                    <!-- Hours + SF -->
                    <div class="grid grid-cols-2 gap-3">
                      <div class="flex flex-col gap-1.5">
                        <Label class="text-xs font-medium">Prod. Hours <span class="text-destructive">*</span></Label>
                        <Input v-model.number="block.hours" type="number" min="0" step="0.25" placeholder="0.00" class="h-11" />
                      </div>
                      <div class="flex flex-col gap-1.5">
                        <Label class="text-xs font-medium">Square Feet</Label>
                        <Input v-model.number="block.sqft" type="number" min="0" placeholder="0" class="h-11" />
                      </div>
                    </div>

                    <!-- Trim LF -->
                    <div v-if="showTrimLf(block)" class="flex flex-col gap-1.5">
                      <Label class="text-xs font-medium">Trim Linear Feet</Label>
                      <Input v-model.number="block.trimLf" type="number" min="0" placeholder="0" class="h-11" />
                    </div>

                    <!-- Count -->
                    <div v-if="showCount(block)" class="flex flex-col gap-1.5">
                      <Label class="text-xs font-medium">Count</Label>
                      <Input v-model.number="block.count" type="number" min="0" placeholder="0" class="h-11" />
                    </div>
                  </div>
                </div>

                <!-- Non-Productive Time -->
                <div class="rounded-xl border border-border/50 bg-card p-4 space-y-3">
                  <div class="flex items-center gap-2">
                    <TimerOff class="size-4 text-amber-500" />
                    <span class="text-sm font-bold">Non-Productive Time</span>
                  </div>
                  <div class="space-y-2">
                    <div v-for="npDef in NP_DEFINITIONS" :key="npDef.type">
                      <button
                        class="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left text-sm font-medium transition-all"
                        :class="editNpSelected[npDef.type] ? 'bg-amber-500/[0.08] text-amber-600 dark:text-amber-400 border-amber-500/30' : 'bg-card text-muted-foreground border-border/50 hover:bg-muted/20'"
                        @click="toggleEditNp(npDef.type)"
                      >
                        <span class="size-4 rounded-[3px] border-2 flex items-center justify-center shrink-0 transition-colors" :class="editNpSelected[npDef.type] ? 'bg-amber-500 border-amber-500 text-white' : 'border-border/60'">
                          <Check v-if="editNpSelected[npDef.type]" class="size-2.5" />
                        </span>
                        {{ npDef.label }}
                      </button>
                      <div v-if="editNpSelected[npDef.type]" class="ml-6 mt-1.5 mb-2 space-y-2">
                        <p v-if="'note' in npDef" class="text-[10px] text-amber-600/70 dark:text-amber-400/70 italic">{{ (npDef as any).note }}</p>
                        <template v-if="npDef.type === 'load_unload'">
                          <div class="grid grid-cols-2 gap-2">
                            <div class="flex flex-col gap-1"><Label class="text-[10px]">Start (min)</Label><Input v-model.number="npde(npDef.type).startMin" type="number" min="0" class="h-9 text-xs" /></div>
                            <div class="flex flex-col gap-1"><Label class="text-[10px]">End (min)</Label><Input v-model.number="npde(npDef.type).endMin" type="number" min="0" class="h-9 text-xs" /></div>
                          </div>
                        </template>
                        <template v-if="npDef.type === 'sanding_setup'">
                          <div class="grid grid-cols-2 gap-2">
                            <div class="flex flex-col gap-1"><Label class="text-[10px]">Setup (min)</Label><Input v-model.number="npde(npDef.type).setupMin" type="number" min="0" class="h-9 text-xs" /></div>
                            <div class="flex flex-col gap-1"><Label class="text-[10px]">Breakdown (min)</Label><Input v-model.number="npde(npDef.type).breakdownMin" type="number" min="0" class="h-9 text-xs" /></div>
                          </div>
                        </template>
                        <template v-if="npDef.type === 'task_switch'">
                          <div class="flex flex-col gap-1"><Label class="text-[10px]">Time (min)</Label><Input v-model.number="npde(npDef.type).minutes" type="number" min="0" class="h-9 text-xs" /></div>
                        </template>
                        <template v-if="npDef.type === 'appliance_move'">
                          <div class="grid grid-cols-2 gap-2">
                            <div class="flex flex-col gap-1"><Label class="text-[10px]"># Appliances</Label><Input v-model.number="npde(npDef.type).count" type="number" min="0" class="h-9 text-xs" /></div>
                            <div class="flex flex-col gap-1"><Label class="text-[10px]">Min each way</Label><Input v-model.number="npde(npDef.type).minEachWay" type="number" min="0" class="h-9 text-xs" /></div>
                          </div>
                        </template>
                        <template v-if="npDef.type === 'appliance_shuffle'">
                          <div class="grid grid-cols-2 gap-2">
                            <div class="flex flex-col gap-1"><Label class="text-[10px]"># Appliances</Label><Input v-model.number="npde(npDef.type).count" type="number" min="0" class="h-9 text-xs" /></div>
                            <div class="flex flex-col gap-1"><Label class="text-[10px]">Hours each</Label><Input v-model.number="npde(npDef.type).hoursEach" type="number" min="0" step="0.5" class="h-9 text-xs" /></div>
                          </div>
                        </template>
                        <template v-if="npDef.type === 'plastic_protection'">
                          <div class="flex flex-col gap-1"><Label class="text-[10px]">Time (min)</Label><Input v-model.number="npde(npDef.type).minutes" type="number" min="0" class="h-9 text-xs" /></div>
                        </template>
                        <template v-if="npDef.type === 'door_removal'">
                          <div class="flex flex-col gap-1"><Label class="text-[10px]"># Doors</Label><Input v-model.number="npde(npDef.type).count" type="number" min="0" class="h-9 text-xs" /></div>
                        </template>
                        <template v-if="npDef.type === 'other'">
                          <div class="flex flex-col gap-1"><Label class="text-[10px]">Description</Label><Input v-model="npde(npDef.type).description" placeholder="Describe..." class="h-9 text-xs" /></div>
                          <div class="flex flex-col gap-1"><Label class="text-[10px]">Time (min)</Label><Input v-model.number="npde(npDef.type).minutes" type="number" min="0" class="h-9 text-xs" /></div>
                        </template>
                        <p class="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">= {{ computeEditNpMinutes(npDef.type) }} minutes</p>
                      </div>
                    </div>
                  </div>
                  <div v-if="editTotalNpMinutes > 0" class="pt-2 border-t border-amber-500/20">
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-semibold text-amber-600 dark:text-amber-400">Total NP Time</span>
                      <span class="text-sm font-black text-amber-600 dark:text-amber-400 tabular-nums">{{ (editTotalNpMinutes / 60).toFixed(1) }}h ({{ editTotalNpMinutes }}min)</span>
                    </div>
                  </div>
                </div>

                <!-- Blockers -->
                <div class="rounded-xl border border-border/50 bg-card p-4 space-y-3">
                  <div class="flex items-center gap-2">
                    <AlertTriangle class="size-4 text-destructive" />
                    <span class="text-sm font-bold">Blockers</span>
                  </div>
                  <div class="flex flex-wrap gap-1.5">
                    <button
                      v-for="b in BLOCKER_OPTIONS" :key="b"
                      class="flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-medium transition-all"
                      :class="editForm.blockers.includes(b) ? 'bg-destructive/10 text-destructive border-destructive/30' : 'bg-card text-muted-foreground border-border/50 hover:bg-muted/20'"
                      @click="toggleEditBlocker(b)"
                    >
                      <span class="size-3.5 rounded-[3px] border-2 flex items-center justify-center shrink-0 transition-colors" :class="editForm.blockers.includes(b) ? 'bg-destructive border-destructive text-white' : 'border-border/60'">
                        <Check v-if="editForm.blockers.includes(b)" class="size-2" />
                      </span>
                      {{ b }}
                    </button>
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <Label class="text-xs font-medium">Notes</Label>
                    <Textarea v-model="editForm.notes" rows="2" placeholder="Additional notes..." class="bg-background/50 resize-none text-sm" />
                  </div>
                </div>

                <!-- Save Footer -->
                <Button class="w-full h-12 text-sm font-semibold" :disabled="editSaving" @click="updateRecord">
                  <LoaderCircle v-if="editSaving" class="mr-2 size-4 animate-spin" />
                  <Save v-else class="mr-2 size-4" />
                  Save Changes
                </Button>
              </div>
            </div>
      </div>

      <!-- ═══════ TAB 3 — EXPORT ═══════ -->
      <div v-if="activeTab === 'export'" class="pt-4 space-y-4">

        <!-- Data Summary -->
        <div class="rounded-xl border border-border/50 bg-card p-4 space-y-3">
          <div class="flex items-center gap-2 mb-1">
            <BarChart3 class="size-4 text-primary" />
            <span class="text-sm font-bold">Data Summary</span>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <p class="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Total Days</p>
              <p class="text-lg font-bold">{{ statDaysLogged }}</p>
            </div>
            <div>
              <p class="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Work Blocks</p>
              <p class="text-lg font-bold">{{ exportTotalBlocks }}</p>
            </div>
            <div>
              <p class="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Date Range</p>
              <p class="text-xs font-semibold">{{ exportDateRange }}</p>
            </div>
            <div>
              <p class="text-[10px] text-amber-600 dark:text-amber-400 font-semibold uppercase tracking-wider">NP Hours</p>
              <p class="text-lg font-bold text-amber-600 dark:text-amber-400">{{ (statTotalNp / 60).toFixed(1) }}</p>
            </div>
          </div>
        </div>

        <!-- Download Button -->
        <Button
          class="w-full h-14 text-sm font-semibold"
          :disabled="records.length === 0"
          @click="downloadCsv"
        >
          <Download class="mr-2 size-5" />
          Download CSV
        </Button>

        <p v-if="records.length === 0" class="text-xs text-center text-muted-foreground">
          No data to export yet. Submit production logs first.
        </p>
        <p v-else class="text-xs text-center text-muted-foreground">
          {{ records.length }} entries · Each work block exports as its own row
        </p>
      </div>

    </div>
  </div>
</template>

<style scoped>
.scrollbar-none::-webkit-scrollbar {
  display: none;
}
.scrollbar-none {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

/* Edit overlay — CSS-based transition (v-show safe) */
.edit-overlay {
  transition: opacity 0.22s ease, transform 0.26s cubic-bezier(0.32, 0.72, 0, 1);
  opacity: 0;
  transform: translateY(1.5rem);
  pointer-events: none;
}
.edit-overlay--visible {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}
</style>
