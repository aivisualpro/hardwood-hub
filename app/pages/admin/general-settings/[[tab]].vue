<script setup lang="ts">
import { toast } from 'vue-sonner'
import draggable from 'vuedraggable'

const { setHeader } = usePageHeader()
setHeader({ title: 'General Settings', icon: 'i-lucide-settings', description: 'Configure system-wide preferences' })

// ─── Types ───────────────────────────────────────────────
interface SkillBonusRecord {
  _id: string
  skillSet: string
  reviewedTimes: number
  supervisorCheck: string
  bonusAmount: number
}

interface WorkspaceRecord {
  _id: string
  name: string
  logo: string
  plan: string
  allowedMenus: string[]
  menuPermissions: Record<string, string[]>
  isLocked: boolean
}

// ─── Route-based tab ─────────────────────────────────────
const route = useRoute()
const activeTab = computed(() => {
  const slug = route.params.tab as string | undefined
  return slug || 'skill-bonus'
})

// Redirect /admin/general-settings → /admin/general-settings/skill-bonus
if (!route.params.tab) {
  navigateTo('/admin/general-settings/skill-bonus', { replace: true })
}
const records = ref<SkillBonusRecord[]>([])
const loading = ref(true)
const showCreateModal = ref(false)
const saving = ref(false)
const editingId = ref<string | null>(null)
const showMobileSidebar = ref(false)

const SKILL_LEVELS = ['Needs Improvement', 'Proficient', 'Mastered'] as const
const SUPERVISOR_OPTIONS = ['Any', 'Unique'] as const

const emptyForm = () => ({
  skillSet: '',
  reviewedTimes: 1,
  supervisorCheck: 'Any',
  bonusAmount: 0,
})
const form = ref(emptyForm())

// ─── Workspace State ─────────────────────────────────────
const workspaces = ref<WorkspaceRecord[]>([])
const loadingWp = ref(true)
const showWpModal = ref(false)
const savingWp = ref(false)
const editingWpId = ref<string | null>(null)

const emptyWpForm = () => ({
  name: '',
  logo: 'i-lucide-building',
  plan: '',
  allowedMenus: [] as string[],
  menuPermissions: {} as Record<string, string[]>
})
const wpForm = ref(emptyWpForm())

// ─── Company Profile State ───────────────────────────────
interface CompanyProfile {
  name: string
  address: string
  city: string
  state: string
  zip: string
  phone1: string
  phone2: string
  website: string
  email: string
  licenseNumber: string
  logo: string
  signature: string
}

const companyProfile = ref<CompanyProfile>({
  name: 'Ann Arbor Hardwoods LLC',
  address: '2232 South Main Street',
  city: 'Ann Arbor',
  state: 'MI',
  zip: '48104',
  phone1: '(734) 604-3786',
  phone2: '(734) 709-1023',
  website: 'www.a2hardwood.com',
  email: 'quote@a2hardwood.com',
  licenseNumber: '242600350',
  logo: '',
  signature: '',
})
const loadingCompany = ref(true)
const savingCompany = ref(false)
const uploadingLogo = ref(false)
const uploadingSignature = ref(false)
// Debounce timer for auto-save
let _autoSaveTimer: ReturnType<typeof setTimeout> | null = null
const autoSaving = ref(false)

async function fetchCompanyProfile() {
  try {
    const res = await $fetch<{ success: boolean, data: Record<string, any> }>('/api/app-settings')
    if (res.data?.companyProfile) {
      companyProfile.value = { ...companyProfile.value, ...res.data.companyProfile }
    }
  } catch (e: any) {
    toast.error('Failed to load company profile', { description: e?.message })
  }
}

async function uploadBase64ToCloudinary(base64: string): Promise<string> {
  const res = await $fetch<{ success: boolean, url: string }>('/api/upload/company-logo', {
    method: 'POST',
    body: { file: base64 },
  })
  return res.url
}

async function saveCompanyProfile(silent = false) {
  savingCompany.value = true
  try {
    await $fetch('/api/app-settings', {
      method: 'POST',
      body: { key: 'companyProfile', value: companyProfile.value, description: 'Company profile information' },
    })
    if (!silent) toast.success('Company profile saved')
  } catch (e: any) {
    toast.error('Save failed', { description: e?.message })
  } finally { savingCompany.value = false }
}

// Auto-save on any field change (debounced 1.5s, silent)
watch(companyProfile, () => {
  if (loadingCompany.value) return
  autoSaving.value = true
  if (_autoSaveTimer) clearTimeout(_autoSaveTimer)
  _autoSaveTimer = setTimeout(async () => {
    await saveCompanyProfile(true)
    autoSaving.value = false
  }, 1500)
}, { deep: true })

async function handleLogoUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  if (!file.type.startsWith('image/')) {
    toast.error('Please select an image file')
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    toast.error('Image must be under 5MB')
    return
  }

  uploadingLogo.value = true
  try {
    const reader = new FileReader()
    const dataUrl = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

    const res = await $fetch<{ success: boolean, url: string }>('/api/upload/company-logo', {
      method: 'POST',
      body: { file: dataUrl },
    })
    companyProfile.value.logo = res.url
    await saveCompanyProfile(true)
    toast.success('Logo uploaded & saved')
  } catch (e: any) {
    toast.error('Upload failed', { description: e?.message })
  } finally {
    uploadingLogo.value = false
    input.value = ''
  }
}

async function handleSignatureUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    toast.error('Please select a PNG, JPEG, or WebP image')
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    toast.error('Image must be under 5MB')
    return
  }

  uploadingSignature.value = true
  try {
    const reader = new FileReader()
    const dataUrl = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

    const url = await uploadBase64ToCloudinary(dataUrl)
    // Set directly without triggering the debounce watcher
    companyProfile.value.signature = url
    await saveCompanyProfile(true)
    toast.success('Signature uploaded & saved')
  } catch (e: any) {
    toast.error('Upload failed', { description: e?.message })
  } finally {
    uploadingSignature.value = false
    input.value = ''
  }
}

async function clearSignature() {
  companyProfile.value.signature = ''
  await saveCompanyProfile(true)
  toast.success('Signature cleared')
}

const tabs = [
  { id: 'skill-bonus', label: 'Skill Bonus', icon: 'i-lucide-trophy' },
  { id: 'workspaces', label: 'Workspaces', icon: 'i-lucide-network' },
  { id: 'company', label: 'Company', icon: 'i-lucide-building-2' },
  { id: 'dropdowns', label: 'Dropdowns', icon: 'i-lucide-list' },
]

// ─── Fetch ───────────────────────────────────────────────
async function fetchRecords() {
  try {
    const res = await $fetch<{ success: boolean, data: SkillBonusRecord[] }>('/api/skill-bonus')
    records.value = res.data
  }
  catch (e: any) {
    toast.error('Failed to load skill bonus records', { description: e?.message })
  }
}

async function fetchWorkspaces() {
  try {
    const res = await $fetch<{ success: boolean, data: WorkspaceRecord[] }>('/api/workspaces')
    workspaces.value = res.data
  }
  catch (e: any) {
    toast.error('Failed to load workspaces', { description: e?.message })
  }
}

// ─── Dropdowns State ─────────────────────────────────────
interface DropdownOption { _id: string; label: string; value: string; color: string; icon: string; order: number }
interface DropdownRecord { _id: string; name: string; options: DropdownOption[] }
const dropdowns = ref<DropdownRecord[]>([])
const loadingDropdowns = ref(true)
const activeDropdownId = ref<string | null>(null)
const editingCell = ref<{ optId: string; field: string } | null>(null)
const editingValue = ref('')
const addingOption = ref(false)
const newOptionLabel = ref('')

const COLOR_PALETTE = [
  '#ef4444','#f97316','#f59e0b','#eab308','#84cc16','#22c55e','#10b981','#14b8a6','#06b6d4','#0ea5e9',
  '#3b82f6','#6366f1','#8b5cf6','#a855f7','#d946ef','#ec4899','#f43f5e','#be123c','#9f1239','#881337',
  '#dc2626','#ea580c','#d97706','#ca8a04','#65a30d','#16a34a','#059669','#0d9488','#0891b2','#0284c7',
  '#2563eb','#4f46e5','#7c3aed','#9333ea','#c026d3','#db2777','#e11d48','#78716c','#737373','#71717a',
  '#64748b','#475569','#334155','#1e293b','#0f172a','#fbbf24','#a3e635','#34d399','#22d3ee','#818cf8',
]

const ICON_LIST = [
  'i-lucide-star','i-lucide-heart','i-lucide-home','i-lucide-user','i-lucide-users','i-lucide-settings',
  'i-lucide-mail','i-lucide-phone','i-lucide-calendar','i-lucide-clock','i-lucide-check','i-lucide-x',
  'i-lucide-plus','i-lucide-minus','i-lucide-search','i-lucide-filter','i-lucide-edit','i-lucide-trash-2',
  'i-lucide-eye','i-lucide-eye-off','i-lucide-lock','i-lucide-unlock','i-lucide-key','i-lucide-shield',
  'i-lucide-flag','i-lucide-bookmark','i-lucide-tag','i-lucide-hash','i-lucide-at-sign','i-lucide-link',
  'i-lucide-paperclip','i-lucide-image','i-lucide-camera','i-lucide-video','i-lucide-mic','i-lucide-headphones',
  'i-lucide-music','i-lucide-play','i-lucide-pause','i-lucide-square','i-lucide-circle','i-lucide-triangle',
  'i-lucide-diamond','i-lucide-hexagon','i-lucide-octagon','i-lucide-pentagon','i-lucide-zap','i-lucide-bolt',
  'i-lucide-flame','i-lucide-sun','i-lucide-moon','i-lucide-cloud','i-lucide-umbrella','i-lucide-wind',
  'i-lucide-snowflake','i-lucide-thermometer','i-lucide-droplet','i-lucide-waves','i-lucide-mountain',
  'i-lucide-tree-pine','i-lucide-flower','i-lucide-leaf','i-lucide-sprout','i-lucide-apple','i-lucide-grape',
  'i-lucide-cherry','i-lucide-banana','i-lucide-carrot','i-lucide-cookie','i-lucide-cake','i-lucide-coffee',
  'i-lucide-beer','i-lucide-wine','i-lucide-cup-soda','i-lucide-utensils','i-lucide-pizza','i-lucide-soup',
  'i-lucide-egg','i-lucide-fish','i-lucide-beef','i-lucide-bone','i-lucide-dog','i-lucide-cat',
  'i-lucide-bird','i-lucide-bug','i-lucide-turtle','i-lucide-rabbit','i-lucide-snail','i-lucide-squirrel',
  'i-lucide-car','i-lucide-bus','i-lucide-truck','i-lucide-bike','i-lucide-train-front','i-lucide-plane',
  'i-lucide-ship','i-lucide-rocket','i-lucide-satellite','i-lucide-globe','i-lucide-map','i-lucide-compass',
  'i-lucide-navigation','i-lucide-map-pin','i-lucide-signpost','i-lucide-milestone','i-lucide-building',
  'i-lucide-building-2','i-lucide-warehouse','i-lucide-factory','i-lucide-hospital','i-lucide-school',
  'i-lucide-church','i-lucide-castle','i-lucide-tent','i-lucide-store','i-lucide-landmark',
  'i-lucide-briefcase','i-lucide-wallet','i-lucide-credit-card','i-lucide-banknote','i-lucide-coins',
  'i-lucide-piggy-bank','i-lucide-receipt','i-lucide-shopping-cart','i-lucide-shopping-bag','i-lucide-gift',
  'i-lucide-package','i-lucide-box','i-lucide-archive','i-lucide-folder','i-lucide-file','i-lucide-file-text',
  'i-lucide-clipboard','i-lucide-notebook','i-lucide-book','i-lucide-book-open','i-lucide-library',
  'i-lucide-graduation-cap','i-lucide-brain','i-lucide-lightbulb','i-lucide-puzzle','i-lucide-target',
  'i-lucide-trophy','i-lucide-medal','i-lucide-award','i-lucide-crown','i-lucide-gem','i-lucide-sparkles',
  'i-lucide-wand','i-lucide-palette','i-lucide-brush','i-lucide-paintbrush','i-lucide-pen','i-lucide-pencil',
  'i-lucide-eraser','i-lucide-ruler','i-lucide-scissors','i-lucide-wrench','i-lucide-hammer','i-lucide-axe',
  'i-lucide-pickaxe','i-lucide-shovel','i-lucide-drill','i-lucide-nut','i-lucide-cog','i-lucide-gauge',
  'i-lucide-thermometer','i-lucide-magnet','i-lucide-battery','i-lucide-plug','i-lucide-cable',
  'i-lucide-wifi','i-lucide-bluetooth','i-lucide-radio','i-lucide-tv','i-lucide-monitor','i-lucide-laptop',
  'i-lucide-tablet','i-lucide-smartphone','i-lucide-watch','i-lucide-printer','i-lucide-scanner',
  'i-lucide-keyboard','i-lucide-mouse','i-lucide-gamepad-2','i-lucide-joystick','i-lucide-speaker',
  'i-lucide-cpu','i-lucide-hard-drive','i-lucide-server','i-lucide-database','i-lucide-cloud-upload',
  'i-lucide-cloud-download','i-lucide-download','i-lucide-upload','i-lucide-share','i-lucide-share-2',
  'i-lucide-send','i-lucide-inbox','i-lucide-archive','i-lucide-trash','i-lucide-refresh-cw',
  'i-lucide-rotate-cw','i-lucide-repeat','i-lucide-shuffle','i-lucide-rewind','i-lucide-fast-forward',
  'i-lucide-skip-back','i-lucide-skip-forward','i-lucide-volume','i-lucide-volume-1','i-lucide-volume-2',
  'i-lucide-bell','i-lucide-alarm-clock','i-lucide-timer','i-lucide-hourglass','i-lucide-stopwatch',
  'i-lucide-calendar-days','i-lucide-calendar-check','i-lucide-calendar-plus','i-lucide-calendar-x',
  'i-lucide-chart-bar','i-lucide-chart-line','i-lucide-chart-pie','i-lucide-chart-area',
  'i-lucide-trending-up','i-lucide-trending-down','i-lucide-activity','i-lucide-bar-chart',
  'i-lucide-pie-chart','i-lucide-signal','i-lucide-percent','i-lucide-calculator',
  'i-lucide-sigma','i-lucide-infinity','i-lucide-hash','i-lucide-code','i-lucide-terminal',
  'i-lucide-braces','i-lucide-brackets','i-lucide-regex','i-lucide-git-branch','i-lucide-git-merge',
  'i-lucide-git-pull-request','i-lucide-git-commit','i-lucide-github','i-lucide-gitlab',
  'i-lucide-chrome','i-lucide-figma','i-lucide-framer','i-lucide-slack','i-lucide-trello',
  'i-lucide-message-square','i-lucide-message-circle','i-lucide-messages-square','i-lucide-megaphone',
  'i-lucide-siren','i-lucide-alert-triangle','i-lucide-alert-circle','i-lucide-alert-octagon',
  'i-lucide-info','i-lucide-help-circle','i-lucide-badge','i-lucide-badge-check','i-lucide-badge-x',
  'i-lucide-shield-check','i-lucide-shield-alert','i-lucide-shield-off','i-lucide-scan',
  'i-lucide-qr-code','i-lucide-barcode','i-lucide-fingerprint','i-lucide-hand','i-lucide-thumbs-up',
  'i-lucide-thumbs-down','i-lucide-handshake','i-lucide-heart-handshake','i-lucide-smile','i-lucide-frown',
  'i-lucide-meh','i-lucide-angry','i-lucide-laugh','i-lucide-party-popper','i-lucide-confetti',
  'i-lucide-candy','i-lucide-ice-cream','i-lucide-popcorn','i-lucide-donut',
  'i-lucide-lamp','i-lucide-armchair','i-lucide-bed','i-lucide-bath','i-lucide-shower-head',
  'i-lucide-washing-machine','i-lucide-microwave','i-lucide-refrigerator','i-lucide-air-vent',
  'i-lucide-heater','i-lucide-fan','i-lucide-lamp-desk','i-lucide-sofa',
  'i-lucide-door-open','i-lucide-door-closed','i-lucide-window','i-lucide-fence','i-lucide-construction',
  'i-lucide-hard-hat','i-lucide-cone','i-lucide-traffic-cone','i-lucide-blocks',
  'i-lucide-component','i-lucide-layers','i-lucide-layout','i-lucide-panel-left','i-lucide-panel-right',
  'i-lucide-panel-top','i-lucide-panel-bottom','i-lucide-grid','i-lucide-list',
  'i-lucide-table','i-lucide-kanban','i-lucide-columns','i-lucide-rows','i-lucide-align-left',
  'i-lucide-align-center','i-lucide-align-right','i-lucide-align-justify',
  'i-lucide-bold','i-lucide-italic','i-lucide-underline','i-lucide-strikethrough','i-lucide-type',
  'i-lucide-heading','i-lucide-quote','i-lucide-list-ordered','i-lucide-list-checks',
  'i-lucide-text','i-lucide-pilcrow','i-lucide-subscript','i-lucide-superscript',
  'i-lucide-move','i-lucide-move-horizontal','i-lucide-move-vertical','i-lucide-grip',
  'i-lucide-maximize','i-lucide-minimize','i-lucide-expand','i-lucide-shrink',
  'i-lucide-zoom-in','i-lucide-zoom-out','i-lucide-fullscreen','i-lucide-pip',
  'i-lucide-crop','i-lucide-slice','i-lucide-copy','i-lucide-clipboard-copy',
  'i-lucide-save','i-lucide-undo','i-lucide-redo','i-lucide-history',
  'i-lucide-log-in','i-lucide-log-out','i-lucide-user-plus','i-lucide-user-minus','i-lucide-user-check',
  'i-lucide-user-x','i-lucide-user-cog','i-lucide-users-round','i-lucide-contact',
  'i-lucide-id-card','i-lucide-scan-face','i-lucide-person-standing','i-lucide-accessibility',
  'i-lucide-baby','i-lucide-footprints',
  'i-lucide-anchor','i-lucide-compass','i-lucide-life-buoy','i-lucide-sailboat',
  'i-lucide-fish','i-lucide-shell','i-lucide-palm-tree',
  'i-lucide-sunrise','i-lucide-sunset','i-lucide-rainbow','i-lucide-cloudy','i-lucide-cloud-rain',
  'i-lucide-cloud-snow','i-lucide-cloud-lightning','i-lucide-tornado','i-lucide-haze',
  'i-lucide-asterisk','i-lucide-at-sign','i-lucide-ampersand','i-lucide-euro','i-lucide-pound-sterling',
  'i-lucide-japanese-yen','i-lucide-russian-ruble','i-lucide-swiss-franc','i-lucide-indian-rupee',
  'i-lucide-dollar-sign','i-lucide-bitcoin','i-lucide-ethereum',
]

const iconSearchQuery = ref('')
const filteredIcons = computed(() => {
  const q = iconSearchQuery.value.toLowerCase()
  if (!q) return ICON_LIST.slice(0, 100)
  return ICON_LIST.filter(i => i.toLowerCase().includes(q)).slice(0, 100)
})

const activeDropdown = computed(() => {
  return dropdowns.value.find(d => d._id === activeDropdownId.value) ?? null
})

// Sorted copy for display & drag — kept in sync but won't cause infinite loops
const sortedOptions = ref<DropdownOption[]>([])
watch(() => activeDropdown.value?.options, (opts) => {
  if (opts) {
    sortedOptions.value = [...opts].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  } else {
    sortedOptions.value = []
  }
}, { immediate: true, deep: true })

async function fetchDropdowns() {
  try {
    const res = await $fetch<{ success: boolean, data: DropdownRecord[] }>('/api/dropdowns')
    dropdowns.value = res.data || []
  } catch (e: any) {
    toast.error('Failed to load dropdowns', { description: e?.message })
  }
}

async function updateOption(dropdownId: string, optionId: string, patch: Record<string, any>) {
  try {
    const res = await $fetch<{ success: boolean, data: DropdownRecord }>('/api/dropdowns', {
      method: 'PUT',
      body: { dropdownId, optionId, patch },
    })
    if (res.data) {
      const idx = dropdowns.value.findIndex(d => d._id === dropdownId)
      if (idx !== -1) dropdowns.value[idx] = res.data
    }
    editingCell.value = null
  } catch (e: any) {
    toast.error('Update failed', { description: e?.message })
  }
}

async function addOption(dropdownId: string) {
  if (!newOptionLabel.value.trim()) return
  const dd = dropdowns.value.find(d => d._id === dropdownId)
  if (!dd) return
  const newOpt = { label: newOptionLabel.value.trim(), value: newOptionLabel.value.trim(), color: '', icon: '', order: dd.options.length }
  try {
    const res = await $fetch<{ success: boolean, data: DropdownRecord }>('/api/dropdowns', {
      method: 'POST',
      body: { name: dd.name, options: [...dd.options, newOpt] },
    })
    if (res.data) {
      const idx = dropdowns.value.findIndex(d => d._id === dropdownId)
      if (idx !== -1) dropdowns.value[idx] = res.data
    }
    newOptionLabel.value = ''
    addingOption.value = false
    toast.success('Option added')
  } catch (e: any) {
    toast.error('Failed to add option', { description: e?.message })
  }
}

async function removeOption(dropdownId: string, optionId: string) {
  try {
    const res = await $fetch<{ success: boolean, data: DropdownRecord }>('/api/dropdowns', {
      method: 'DELETE',
      body: { dropdownId, optionId },
    })
    if (res.data) {
      const idx = dropdowns.value.findIndex(d => d._id === dropdownId)
      if (idx !== -1) dropdowns.value[idx] = res.data
    }
    toast.success('Option removed')
  } catch (e: any) {
    toast.error('Delete failed', { description: e?.message })
  }
}

function startEditLabel(opt: DropdownOption) {
  editingCell.value = { optId: opt._id, field: 'label' }
  editingValue.value = opt.label
}

function commitEditLabel(dropdownId: string, optId: string) {
  if (editingValue.value.trim()) {
    updateOption(dropdownId, optId, { label: editingValue.value.trim(), value: editingValue.value.trim() })
  }
  editingCell.value = null
}

async function reorderOptions(dropdownId: string) {
  const dd = dropdowns.value.find(d => d._id === dropdownId)
  if (!dd) return
  // sortedOptions was already reordered by draggable — write order values & sync back
  const reordered = sortedOptions.value.map((opt, idx) => ({ ...opt, order: idx }))
  dd.options = reordered
  sortedOptions.value = reordered
  try {
    const res = await $fetch<{ success: boolean, data: DropdownRecord }>('/api/dropdowns', {
      method: 'PUT',
      body: { dropdownId, reorderedOptions: reordered },
    })
    if (res.data) {
      const idx = dropdowns.value.findIndex(d => d._id === dropdownId)
      if (idx !== -1) dropdowns.value[idx] = res.data
    }
  } catch (e: any) {
    toast.error('Failed to save order', { description: e?.message })
  }
}

// ─── Server-first data fetching (blocks navigation until resolved) ──────
await useAsyncData('general-settings', async () => {
  await Promise.all([fetchRecords(), fetchWorkspaces(), fetchCompanyProfile(), fetchDropdowns()])
  return true
})

// ─── Open modals ─────────────────────────────────────────
function openCreate() {
  form.value = emptyForm()
  editingId.value = null
  showCreateModal.value = true
}

function openEdit(rec: SkillBonusRecord) {
  form.value = {
    skillSet: rec.skillSet,
    reviewedTimes: rec.reviewedTimes,
    supervisorCheck: rec.supervisorCheck,
    bonusAmount: rec.bonusAmount,
  }
  editingId.value = rec._id
  showCreateModal.value = true
}

// ─── Save (create or update) ─────────────────────────────
async function saveRecord() {
  if (!form.value.skillSet) return toast.error('Skill Set is required')
  saving.value = true
  try {
    if (editingId.value) {
      await $fetch(`/api/skill-bonus/${editingId.value}`, { method: 'PUT', body: form.value })
      toast.success('Record updated')
    }
    else {
      await $fetch('/api/skill-bonus', { method: 'POST', body: form.value })
      toast.success('Record created')
    }
    showCreateModal.value = false
    await fetchRecords()
  }
  catch (e: any) {
    toast.error('Save failed', { description: e?.message })
  }
  finally { saving.value = false }
}

// ─── Delete ──────────────────────────────────────────────
async function deleteRecord(id: string) {
  const idx = records.value.findIndex(r => r._id === id)
  if (idx === -1) return
  const snapshot = records.value[idx]!
  records.value.splice(idx, 1)
  try {
    await $fetch(`/api/skill-bonus/${id}`, { method: 'DELETE' })
    toast.success('Record deleted')
  }
  catch (e: any) {
    records.value.splice(idx, 0, snapshot)
    toast.error('Delete failed', { description: e?.message })
  }
}

// ─── Workspace Modal Utils ───────────────────────────────
function openWpCreate() {
  wpForm.value = emptyWpForm()
  editingWpId.value = null
  showWpModal.value = true
}

function openWpEdit(rec: WorkspaceRecord) {
  wpForm.value = {
    name: rec.name,
    logo: rec.logo,
    plan: rec.plan,
    allowedMenus: [...rec.allowedMenus],
    menuPermissions: JSON.parse(JSON.stringify(rec.menuPermissions || {}))
  }
  editingWpId.value = rec._id
  showWpModal.value = true
}

async function saveWorkspace() {
  if (!wpForm.value.name) return toast.error('Workspace name is required')
  savingWp.value = true
  try {
    if (editingWpId.value) {
      await $fetch(`/api/workspaces/${editingWpId.value}`, { method: 'PUT', body: wpForm.value })
      toast.success('Workspace updated')
    }
    else {
      await $fetch('/api/workspaces', { method: 'POST', body: wpForm.value })
      toast.success('Workspace created')
    }
    showWpModal.value = false
    await fetchWorkspaces()
    await refreshNuxtData('workspaces-list')
  }
  catch (e: any) {
    toast.error('Save failed', { description: e?.message })
  }
  finally { savingWp.value = false }
}

async function deleteWorkspace(id: string) {
  try {
    await $fetch(`/api/workspaces/${id}`, { method: 'DELETE' })
    toast.success('Workspace deleted')
    await fetchWorkspaces()
    await refreshNuxtData('workspaces-list')
  } catch (e: any) {
    toast.error('Delete failed', { description: e?.message })
  }
}

// ─── Level color helpers ─────────────────────────────────
function levelColor(lvl: string) {
  if (lvl === 'Mastered') return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
  if (lvl === 'Proficient') return 'bg-blue-500/15 text-blue-400 border-blue-500/30'
  if (lvl === 'Needs Improvement') return 'bg-amber-500/15 text-amber-400 border-amber-500/30'
  return 'bg-muted text-muted-foreground border-border/40'
}

import { navMenu, navMenuConcepts, navMenuBottom } from '~/constants/menus'

// ─── Route Capabilities (which CRUD ops each route supports) ─────
const ROUTE_CAPS: Record<string, { ops: string[], icon: string }> = {
  '/admin/dashboard': { ops: ['read'], icon: 'i-lucide-layout-dashboard' },
  '/admin/skills': { ops: ['create', 'read', 'update', 'delete'], icon: 'i-lucide-graduation-cap' },
  '/admin/activities': { ops: ['read'], icon: 'i-lucide-activity' },
  '/hr/employees': { ops: ['create', 'read', 'update', 'delete'], icon: 'i-lucide-users' },
  '/hr/employee-performance': { ops: ['create', 'read', 'update', 'delete'], icon: 'i-lucide-bar-chart-3' },
  '/hr/employees-bonus-report': { ops: ['read'], icon: 'i-lucide-trophy' },
  '/tasks': { ops: ['create', 'read', 'update', 'delete'], icon: 'i-lucide-layout-dashboard' },
  '/project-communication': { ops: ['create', 'read', 'update', 'delete'], icon: 'i-lucide-message-square' },
  '/daily-production': { ops: ['create', 'read', 'update', 'delete'], icon: 'i-lucide-clipboard-list' },
  '/email': { ops: ['create', 'read', 'update', 'delete'], icon: 'i-lucide-mail' },
  '/sales/invoices': { ops: ['create', 'read', 'update', 'delete'], icon: 'i-lucide-receipt' },
  '/reports/sales': { ops: ['read'], icon: 'i-lucide-trending-up' },
  '/reports/financial': { ops: ['read'], icon: 'i-lucide-pie-chart' },
  '/admin/general-settings': { ops: ['read', 'update'], icon: 'i-lucide-settings' },
  '/crm/pipeline': { ops: ['create', 'read', 'update', 'delete'], icon: 'i-lucide-contact' },
  '/crm/products': { ops: ['create', 'read', 'update', 'delete'], icon: 'i-lucide-package' },
  '/crm/appointments': { ops: ['create', 'read', 'update', 'delete'], icon: 'i-lucide-calendar-check' },
  '/crm/flooring-estimate': { ops: ['create', 'read', 'update', 'delete'], icon: 'i-lucide-ruler' },
  '/crm/contracts': { ops: ['create', 'read', 'update', 'delete'], icon: 'i-lucide-file-signature' },
  '/external/stain-sign-off': { ops: ['create', 'read', 'update', 'delete'], icon: 'i-lucide-stamp' },
}

const OP_META: Record<string, { label: string, color: string, icon: string }> = {
  create: { label: 'Create', color: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/25', icon: 'i-lucide-plus' },
  read:   { label: 'View',   color: 'bg-blue-500/15 text-blue-500 border-blue-500/30 hover:bg-blue-500/25',    icon: 'i-lucide-eye' },
  update: { label: 'Edit',   color: 'bg-amber-500/15 text-amber-500 border-amber-500/30 hover:bg-amber-500/25', icon: 'i-lucide-pencil' },
  delete: { label: 'Delete', color: 'bg-red-500/15 text-red-500 border-red-500/30 hover:bg-red-500/25',         icon: 'i-lucide-trash-2' },
}

function getCaps(routeId: string) {
  return ROUTE_CAPS[routeId] || { ops: ['read'], icon: 'i-lucide-circle' }
}
function isViewOnly(routeId: string) {
  const c = getCaps(routeId)
  return c.ops.length === 1 && c.ops[0] === 'read'
}
function hasPerm(menuId: string, op: string) {
  return wpForm.value.menuPermissions[menuId]?.includes(op) || false
}
function togglePerm(menuId: string, op: string) {
  if (!wpForm.value.menuPermissions[menuId]) wpForm.value.menuPermissions[menuId] = []
  const perms = wpForm.value.menuPermissions[menuId]
  const idx = perms.indexOf(op)
  if (idx >= 0) {
    if (op === 'read') return
    perms.splice(idx, 1)
  } else {
    perms.push(op)
  }
}
function toggleMenu(menuId: string) {
  const idx = wpForm.value.allowedMenus.indexOf(menuId)
  if (idx >= 0) {
    wpForm.value.allowedMenus.splice(idx, 1)
    delete wpForm.value.menuPermissions[menuId]
  } else {
    wpForm.value.allowedMenus.push(menuId)
    wpForm.value.menuPermissions[menuId] = [...getCaps(menuId).ops]
  }
}

const availableMenus = computed(() => {
  const menus: { id: string, title: string, group: string }[] = []
  
  navMenu.forEach(group => {
    group.items.forEach((item: any) => {
      menus.push({ id: item.link, title: item.title, group: group.heading || 'Admin' })
    })
  })
  
  navMenuConcepts.items.forEach((item: any) => {
    menus.push({ id: item.link, title: item.title, group: navMenuConcepts.heading })
  })
  
  navMenuBottom.forEach((item: any) => {
    menus.push({ id: item.link, title: item.title, group: 'System Controls' })
  })
  
  return menus
})

const menusByGroup = computed(() => {
  const map = new Map<string, typeof availableMenus.value>()
  for (const m of availableMenus.value) {
    if (!map.has(m.group)) map.set(m.group, [])
    map.get(m.group)!.push(m)
  }
  return Array.from(map.entries()).map(([group, items]) => ({ group, items }))
})

function hasAllInGroup(groupItems: any[]) {
   return groupItems.every(i => wpForm.value.allowedMenus.includes(i.id))
}
function toggleGroup(groupItems: any[]) {
   if (hasAllInGroup(groupItems)) {
      wpForm.value.allowedMenus = wpForm.value.allowedMenus.filter(m => !groupItems.some(i => i.id === m))
      for (const i of groupItems) delete wpForm.value.menuPermissions[i.id]
   } else {
      for (const i of groupItems) {
         if (!wpForm.value.allowedMenus.includes(i.id)) {
            wpForm.value.allowedMenus.push(i.id)
            wpForm.value.menuPermissions[i.id] = [...getCaps(i.id).ops]
         }
      }
   }
}

const WpIconsList = [
  'i-lucide-shield-check',
  'i-lucide-hard-hat',
  'i-lucide-user',
  'i-lucide-users',
  'i-lucide-clipboard-list',
  'i-lucide-landmark',
  'i-lucide-activity',
  'i-lucide-building',
  'i-lucide-box',
  'i-lucide-briefcase',
]
</script>
<template>
  <div class="flex flex-col -m-4 lg:-m-6 h-[calc(100vh-theme(spacing.16))] overflow-hidden bg-background">

    <!-- Top Navigation Header -->
    <div class="shrink-0 border-b border-border/60 bg-muted/10 px-4 sm:px-6 flex flex-col justify-end pt-4 h-20">
      <div class="flex items-center justify-between mb-0 h-full pb-0">
        <!-- Tabs -->
        <div class="flex items-center gap-6 overflow-x-auto h-full">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            class="flex items-center gap-2 h-full pb-4 border-b-2 text-sm font-semibold transition-colors whitespace-nowrap outline-none"
            :class="activeTab === tab.id
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border/60'"
            @click="navigateTo(`/admin/general-settings/${tab.id}`)"
          >
            <Icon :name="tab.icon" class="size-4" />
            {{ tab.label }}
          </button>
        </div>

        <!-- Action Buttons -->
        <div class="flex items-center gap-3 pb-3">
          <Button v-if="activeTab === 'skill-bonus'" size="sm" class="h-9 px-3" @click="openCreate">
            <Icon name="i-lucide-plus" class="mr-1.5 size-3.5" />
            Add Rule
          </Button>
          <Button v-if="activeTab === 'workspaces'" size="sm" class="h-9 px-3" @click="openWpCreate">
            <Icon name="i-lucide-plus" class="mr-1.5 size-3.5" />
            Add Workspace
          </Button>
        </div>
      </div>
    </div>

    <!-- Content area -->
    <main class="flex-1 flex flex-col min-h-0 h-full overflow-y-auto p-4 sm:p-6 bg-muted/5">

        <!-- ═══════ SKILL BONUS TAB ═══════ -->
        <template v-if="activeTab === 'skill-bonus'">

          <!-- Empty state -->
          <div v-if="records.length === 0" class="flex flex-col items-center justify-center py-16 sm:py-24 gap-3 sm:gap-4 text-center px-4">
            <div class="size-14 sm:size-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 border border-amber-500/20 flex items-center justify-center">
              <Icon name="i-lucide-trophy" class="size-6 sm:size-8 text-amber-400" />
            </div>
            <h3 class="text-base sm:text-lg font-semibold">No Skill Bonus Rules</h3>
            <p class="text-xs sm:text-sm text-muted-foreground max-w-sm">
              Define bonus rules for skill assessments. Set reviewed times, results, and bonus amounts for each skill level.
            </p>
            <Button size="sm" @click="openCreate">
              <Icon name="i-lucide-plus" class="mr-1.5 size-3.5 sm:size-4" />
              Create First Rule
            </Button>
          </div>

          <!-- Data table -->
          <div v-else class="rounded-xl border border-border/50 bg-card shadow-xs overflow-hidden">
            <div class="overflow-x-auto">
              <table class="w-full text-sm" style="min-width: 520px">
                <thead>
                  <tr class="border-b border-border/50 bg-muted/30">
                    <th class="text-left px-3 sm:px-4 py-2.5 sm:py-3 font-semibold text-muted-foreground text-[10px] sm:text-xs uppercase tracking-wider">Skill Set</th>
                    <th class="text-center px-3 sm:px-4 py-2.5 sm:py-3 font-semibold text-muted-foreground text-[10px] sm:text-xs uppercase tracking-wider">Reviewed</th>
                    <th class="text-center px-3 sm:px-4 py-2.5 sm:py-3 font-semibold text-muted-foreground text-[10px] sm:text-xs uppercase tracking-wider">Supervisor</th>
                    <th class="text-right px-3 sm:px-4 py-2.5 sm:py-3 font-semibold text-muted-foreground text-[10px] sm:text-xs uppercase tracking-wider">Bonus</th>
                    <th class="w-16 sm:w-20 px-3 sm:px-4 py-2.5 sm:py-3" />
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="r in records"
                    :key="r._id"
                    class="group border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors"
                  >
                    <!-- Skill Set -->
                    <td class="px-3 sm:px-4 py-2.5 sm:py-3">
                      <span
                        class="inline-flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs font-semibold px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full border"
                        :class="levelColor(r.skillSet)"
                      >
                        {{ r.skillSet }}
                      </span>
                    </td>

                    <!-- Reviewed Times -->
                    <td class="px-3 sm:px-4 py-2.5 sm:py-3 text-center">
                      <span class="inline-flex items-center justify-center size-6 sm:size-7 rounded-lg bg-muted/60 text-xs sm:text-sm font-bold border border-border/30">
                        {{ r.reviewedTimes }}
                      </span>
                    </td>

                    <!-- Supervisor Check -->
                    <td class="px-3 sm:px-4 py-2.5 sm:py-3 text-center">
                      <span
                        class="inline-flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs font-medium px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full border"
                        :class="r.supervisorCheck === 'Unique'
                          ? 'bg-violet-500/15 text-violet-400 border-violet-500/30'
                          : 'bg-muted/60 text-muted-foreground border-border/40'"
                      >
                        <Icon :name="r.supervisorCheck === 'Unique' ? 'i-lucide-fingerprint' : 'i-lucide-users'" class="size-2.5 sm:size-3" />
                        {{ r.supervisorCheck || '—' }}
                      </span>
                    </td>

                    <!-- Bonus Amount -->
                    <td class="px-3 sm:px-4 py-2.5 sm:py-3 text-right">
                      <span class="text-sm sm:text-base font-bold text-emerald-400">${{ r.bonusAmount.toFixed(2) }}</span>
                    </td>

                    <!-- Actions -->
                    <td class="px-3 sm:px-4 py-2.5 sm:py-3">
                      <div class="flex items-center gap-0.5 sm:gap-1 justify-end sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button
                          class="size-6 sm:size-7 rounded flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          @click="openEdit(r)"
                        >
                          <Icon name="i-lucide-pencil" class="size-3 sm:size-3.5" />
                        </button>
                        <button
                          class="size-6 sm:size-7 rounded flex items-center justify-center hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          @click="deleteRecord(r._id)"
                        >
                          <Icon name="i-lucide-trash-2" class="size-3 sm:size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Summary cards -->
          <div v-if="records.length > 0" class="mt-3 sm:mt-5 grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4">
            <div class="rounded-xl border border-border/50 bg-card p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
              <div class="size-8 sm:size-10 rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/20 flex items-center justify-center">
                <Icon name="i-lucide-trophy" class="size-4 sm:size-5 text-emerald-400" />
              </div>
              <div>
                <p class="text-[10px] sm:text-xs text-muted-foreground font-medium">Total Rules</p>
                <p class="text-base sm:text-lg font-bold">{{ records.length }}</p>
              </div>
            </div>
            <div class="rounded-xl border border-border/50 bg-card p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
              <div class="size-8 sm:size-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-500/5 border border-blue-500/20 flex items-center justify-center">
                <Icon name="i-lucide-dollar-sign" class="size-4 sm:size-5 text-blue-400" />
              </div>
              <div>
                <p class="text-[10px] sm:text-xs text-muted-foreground font-medium">Max Bonus</p>
                <p class="text-base sm:text-lg font-bold text-emerald-400">${{ Math.max(...records.map(r => r.bonusAmount)).toFixed(2) }}</p>
              </div>
            </div>
            <div class="rounded-xl border border-border/50 bg-card p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
              <div class="size-8 sm:size-10 rounded-lg bg-gradient-to-br from-violet-500/20 to-violet-500/5 border border-violet-500/20 flex items-center justify-center">
                <Icon name="i-lucide-layers" class="size-4 sm:size-5 text-violet-400" />
              </div>
              <div>
                <p class="text-[10px] sm:text-xs text-muted-foreground font-medium">Skill Levels</p>
                <p class="text-base sm:text-lg font-bold">{{ new Set(records.map(r => r.skillSet)).size }}</p>
              </div>
            </div>
          </div>
        </template>

        <!-- ═══════ WORKSPACES TAB ═══════ -->
        <template v-else-if="activeTab === 'workspaces'">
          <div v-if="loadingWp" class="space-y-3">
             <div class="h-10 bg-muted/60 rounded-lg animate-pulse" />
             <div v-for="i in 3" :key="i" class="h-16 bg-muted/40 rounded-lg animate-pulse" />
          </div>

          <div v-else-if="workspaces.length === 0" class="flex flex-col items-center justify-center py-16 sm:py-24 gap-3 sm:gap-4 text-center px-4">
            <div class="size-14 sm:size-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
              <Icon name="i-lucide-network" class="size-6 sm:size-8 text-primary" />
            </div>
            <h3 class="text-base sm:text-lg font-semibold">No Workspaces Found</h3>
            <p class="text-xs sm:text-sm text-muted-foreground max-w-sm">
              Create different workspaces to limit access to certain dashboard modules for your team.
            </p>
            <Button size="sm" @click="openWpCreate">
              <Icon name="i-lucide-plus" class="mr-1.5 size-3.5 sm:size-4" />
              Create Workspace
            </Button>
          </div>

          <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
            <div 
              v-for="wp in workspaces" 
              :key="wp._id"
              class="relative rounded-xl border border-border/50 bg-card p-4 sm:p-5 group flex flex-col min-h-[140px] sm:min-h-[160px]"
            >
              <div v-if="wp.isLocked" class="absolute top-3 right-3 sm:top-4 sm:right-4" title="Admin Workspace is locked.">
                 <Icon name="i-lucide-lock" class="size-3.5 sm:size-4 text-amber-500/70" />
              </div>
              
              <div class="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
                <div class="size-10 sm:size-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                  <Icon :name="wp.logo || 'i-lucide-building'" class="size-5 sm:size-6 text-primary" />
                </div>
                <div>
                  <h3 class="font-bold text-sm sm:text-base line-clamp-1">{{ wp.name }}</h3>
                  <p class="text-[10px] sm:text-xs text-muted-foreground">{{ wp.plan || 'Workspace' }}</p>
                </div>
              </div>

              <div class="mt-auto">
                 <!-- Actions -->
                 <div class="flex items-center gap-1.5 sm:gap-2 pt-3 sm:pt-4 border-t border-border/50">
                    <Button variant="secondary" size="sm" class="flex-1 text-xs sm:text-sm h-8 sm:h-9" @click="openWpEdit(wp)">
                      <Icon name="i-lucide-settings-2" class="mr-1 sm:mr-1.5 size-3 sm:size-3.5" /> Configure
                    </Button>
                    <Button 
                      v-if="!wp.isLocked"
                      variant="outline" 
                      size="sm" 
                      class="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      @click="deleteWorkspace(wp._id)"
                    >
                      <Icon name="i-lucide-trash-2" class="size-3.5" />
                    </Button>
                 </div>
              </div>
            </div>
          </div>
        </template>

        <!-- ═══════ COMPANY TAB ═══════ -->
        <template v-else-if="activeTab === 'company'">
          <div v-if="loadingCompany" class="space-y-4">
            <div class="h-32 bg-muted/60 rounded-xl animate-pulse" />
            <div class="grid grid-cols-2 gap-4">
              <div v-for="i in 6" :key="i" class="h-16 bg-muted/40 rounded-lg animate-pulse" />
            </div>
          </div>

          <div v-else class="space-y-6">
            
            <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <!-- Logo Section -->
              <div class="rounded-xl border border-border/50 bg-card overflow-hidden flex flex-col">
                <div class="px-5 py-4 border-b border-border/50 bg-muted/20">
                  <h3 class="text-sm font-bold flex items-center gap-2">
                    <Icon name="i-lucide-image" class="size-4 text-primary" />
                    Company Logo
                  </h3>
                </div>
                <div class="p-5 flex-1 flex items-center justify-center">
                 <div class="relative group w-full max-w-sm h-48 rounded-xl border-2 border-dashed border-border/60 flex items-center justify-center bg-muted/20 overflow-hidden transition-all hover:border-primary/40">
                    <img v-if="companyProfile.logo" :src="companyProfile.logo" alt="Company Logo" class="size-full object-contain p-4 bg-white/50 dark:bg-black/20" />
                    <Icon v-else name="i-lucide-building-2" class="size-16 text-muted-foreground/30" />
                    
                    <div v-if="uploadingLogo" class="absolute inset-0 bg-background/80 flex items-center justify-center backdrop-blur-sm z-20">
                      <Icon name="i-lucide-loader-circle" class="size-8 text-primary animate-spin" />
                    </div>

                    <!-- Overlay Actions -->
                    <label v-if="!companyProfile.logo" class="absolute inset-0 cursor-pointer z-10">
                      <input type="file" accept="image/*" class="sr-only" @change="handleLogoUpload" />
                      <!-- Center hover hint -->
                      <div class="absolute inset-0 flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-muted/50 backdrop-blur-[2px]">
                        <div class="size-10 rounded-full bg-background border flex items-center justify-center shadow-sm">
                          <Icon name="i-lucide-upload" class="size-4 text-primary" />
                        </div>
                        <span class="text-xs font-semibold text-muted-foreground">Upload Logo</span>
                      </div>
                    </label>

                    <div v-if="companyProfile.logo" class="absolute top-2 right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200 z-20">
                      <label class="flex items-center justify-center size-8 rounded-lg bg-background/95 backdrop-blur shadow-sm border cursor-pointer hover:bg-muted text-muted-foreground hover:text-primary transition-colors">
                        <Icon name="i-lucide-upload" class="size-4" />
                        <input type="file" accept="image/*" class="sr-only" @change="handleLogoUpload" />
                      </label>
                      <button class="flex items-center justify-center size-8 rounded-lg bg-background/95 backdrop-blur shadow-sm border cursor-pointer hover:bg-destructive hover:border-destructive hover:text-destructive-foreground text-muted-foreground transition-colors" @click.stop="companyProfile.logo = ''">
                        <Icon name="i-lucide-trash-2" class="size-4" />
                      </button>
                    </div>
                  </div>
                </div>
            </div>

              <!-- Signature Section -->
              <div class="rounded-xl border border-border/50 bg-card overflow-hidden flex flex-col">
                <div class="px-5 py-4 border-b border-border/50 bg-muted/20">
                  <h3 class="text-sm font-bold flex items-center gap-2">
                    <Icon name="i-lucide-pen-tool" class="size-4 text-primary" />
                    Company Signature
                  </h3>
                </div>
                <div class="p-5 flex-1 flex flex-col justify-center">
                  <div class="relative group w-full min-h-[320px] rounded-xl border-2 border-dashed border-border/60 flex items-center justify-center bg-muted/10 overflow-hidden transition-all hover:border-primary/40">
                    <!-- Existing signature preview -->
                    <template v-if="companyProfile.signature">
                      <img :src="companyProfile.signature" alt="Company Signature" class="max-h-[260px] max-w-[90%] w-auto object-contain p-6 bg-white rounded-xl shadow-sm" />
                      <!-- Hover actions -->
                      <div class="absolute top-2 right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200 z-20">
                        <label class="flex items-center justify-center size-8 rounded-lg bg-background/95 backdrop-blur shadow-sm border cursor-pointer hover:bg-muted text-muted-foreground hover:text-primary transition-colors">
                          <Icon name="i-lucide-upload" class="size-4" />
                          <input type="file" accept="image/png,image/jpeg,image/webp" class="sr-only" @change="handleSignatureUpload" />
                        </label>
                        <button class="flex items-center justify-center size-8 rounded-lg bg-background/95 backdrop-blur shadow-sm border cursor-pointer hover:bg-destructive hover:border-destructive hover:text-destructive-foreground text-muted-foreground transition-colors" @click.stop="clearSignature">
                          <Icon name="i-lucide-trash-2" class="size-4" />
                        </button>
                      </div>
                    </template>

                    <!-- Empty state -->
                    <template v-else>
                      <label class="absolute inset-0 cursor-pointer z-10">
                        <input type="file" accept="image/png,image/jpeg,image/webp" class="sr-only" @change="handleSignatureUpload" />
                        <div class="absolute inset-0 flex flex-col items-center justify-center gap-3">
                          <div class="size-14 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/20 flex items-center justify-center">
                            <Icon name="i-lucide-image-plus" class="size-7 text-primary" />
                          </div>
                          <div class="text-center">
                            <span class="text-sm font-semibold text-foreground block">Upload Signature Image</span>
                            <span class="text-xs text-muted-foreground">PNG, JPEG, or WebP — max 5MB</span>
                          </div>
                        </div>
                      </label>
                    </template>

                    <!-- Upload spinner -->
                    <div v-if="uploadingSignature" class="absolute inset-0 bg-background/80 flex items-center justify-center backdrop-blur-sm z-20">
                      <Icon name="i-lucide-loader-circle" class="size-8 text-primary animate-spin" />
                    </div>
                  </div>
                  <p class="text-[10px] text-muted-foreground mt-2 text-center">
                    Upload a transparent PNG of the company signature for best results on contracts.
                  </p>
                </div>
              </div>
            </div>

            <!-- Company Info -->
            <div class="rounded-xl border border-border/50 bg-card overflow-hidden">
              <div class="px-5 py-4 border-b border-border/50 bg-muted/20">
                <h3 class="text-sm font-bold flex items-center gap-2">
                  <Icon name="i-lucide-building-2" class="size-4 text-primary" />
                  Company Information
                </h3>
              </div>
              <div class="p-5 space-y-5">
                <!-- Company Name -->
                <div class="flex flex-col gap-1.5">
                  <Label for="co-name" class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Company Name</Label>
                  <Input id="co-name" v-model="companyProfile.name" placeholder="Ann Arbor Hardwoods LLC" class="h-10 text-sm font-medium" />
                </div>

                <!-- Address & Location Row (Inline on Desktop) -->
                <div class="grid grid-cols-1 md:grid-cols-12 gap-3">
                  <div class="md:col-span-5 flex flex-col gap-1.5">
                    <Label for="co-address" class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Street Address</Label>
                    <Input id="co-address" v-model="companyProfile.address" placeholder="2232 South Main Street" class="h-10 text-sm" />
                  </div>
                  <div class="md:col-span-3 flex flex-col gap-1.5">
                    <Label for="co-city" class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">City</Label>
                    <Input id="co-city" v-model="companyProfile.city" placeholder="Ann Arbor" class="h-10 text-sm" />
                  </div>
                  <div class="md:col-span-2 flex flex-col gap-1.5">
                    <Label for="co-state" class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">State</Label>
                    <Input id="co-state" v-model="companyProfile.state" placeholder="MI" class="h-10 text-sm" />
                  </div>
                  <div class="md:col-span-2 flex flex-col gap-1.5">
                    <Label for="co-zip" class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Zip</Label>
                    <Input id="co-zip" v-model="companyProfile.zip" placeholder="48104" class="h-10 text-sm" />
                  </div>
                </div>

                <Separator />

                <!-- Phone Numbers -->
                <div class="grid grid-cols-2 gap-4">
                  <div class="flex flex-col gap-1.5">
                    <Label for="co-phone1" class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <Icon name="i-lucide-phone" class="size-3 inline mr-1" />
                      Primary Phone
                    </Label>
                    <Input id="co-phone1" v-model="companyProfile.phone1" placeholder="(734) 604-3786" class="h-10 text-sm tabular-nums" />
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <Label for="co-phone2" class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <Icon name="i-lucide-phone" class="size-3 inline mr-1" />
                      Secondary Phone
                    </Label>
                    <Input id="co-phone2" v-model="companyProfile.phone2" placeholder="(734) 709-1023" class="h-10 text-sm tabular-nums" />
                  </div>
                </div>

                <!-- Website, Email & License -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div class="flex flex-col gap-1.5">
                    <Label for="co-website" class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <Icon name="i-lucide-globe" class="size-3 inline mr-1" />
                      Website
                    </Label>
                    <Input id="co-website" v-model="companyProfile.website" placeholder="www.a2hardwood.com" class="h-10 text-sm" />
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <Label for="co-email" class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <Icon name="i-lucide-mail" class="size-3 inline mr-1" />
                      Email
                    </Label>
                    <Input id="co-email" v-model="companyProfile.email" placeholder="quote@a2hardwood.com" class="h-10 text-sm" />
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <Label for="co-license" class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <Icon name="i-lucide-shield-check" class="size-3 inline mr-1" />
                      Builder's License Number
                    </Label>
                    <Input id="co-license" v-model="companyProfile.licenseNumber" placeholder="242600350" class="h-10 text-sm font-mono" />
                  </div>
                </div>
              </div>
            </div>

            <!-- Preview Card -->
            <div class="rounded-xl border border-border/50 bg-card overflow-hidden">
              <div class="px-5 py-4 border-b border-border/50 bg-muted/20">
                <h3 class="text-sm font-bold flex items-center gap-2">
                  <Icon name="i-lucide-eye" class="size-4 text-primary" />
                  Letterhead Preview
                </h3>
              </div>
              <div class="p-6 bg-white dark:bg-zinc-900">
                <div class="flex items-start gap-6">
                  <div v-if="companyProfile.logo" class="w-[200px] h-20 shrink-0">
                    <img :src="companyProfile.logo" alt="Logo" class="size-full object-contain object-left" />
                  </div>
                  <div v-else class="w-[200px] h-20 shrink-0 rounded-xl bg-muted/40 border border-dashed border-border flex items-center justify-center">
                    <Icon name="i-lucide-image" class="size-8 text-muted-foreground/30" />
                  </div>
                  <div class="text-right flex-1">
                    <p class="text-base font-bold text-emerald-700 dark:text-emerald-400">{{ companyProfile.name || 'Company Name' }}</p>
                    <p class="text-xs font-semibold text-foreground/80">{{ companyProfile.address }}</p>
                    <p class="text-xs font-semibold text-foreground/80">{{ companyProfile.city }}, {{ companyProfile.state }}. {{ companyProfile.zip }}</p>
                    <p class="text-xs font-bold text-foreground/80">{{ companyProfile.phone1 }}</p>
                    <p v-if="companyProfile.phone2" class="text-xs font-bold text-foreground/80">{{ companyProfile.phone2 }}</p>
                    <p class="text-xs font-bold text-foreground/80">{{ companyProfile.website }}</p>
                    <p class="text-xs font-bold text-foreground/80">{{ companyProfile.email }}</p>
                    <p v-if="companyProfile.licenseNumber" class="text-xs font-bold text-foreground/80">Builder's License Number: {{ companyProfile.licenseNumber }}</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Auto-save indicator -->
            <div class="flex justify-end items-center gap-2 h-8">
              <transition name="fade">
                <span v-if="autoSaving || savingCompany" class="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Icon name="i-lucide-loader-circle" class="size-3.5 animate-spin" />
                  Saving…
                </span>
              </transition>
            </div>
          </div>
        </template>

        <!-- ═══════ DROPDOWNS TAB ═══════ -->
        <template v-else-if="activeTab === 'dropdowns'">
          <div v-if="loadingDropdowns" class="space-y-3">
            <div class="h-10 bg-muted/60 rounded-lg animate-pulse" />
            <div v-for="i in 3" :key="i" class="h-24 bg-muted/40 rounded-lg animate-pulse" />
          </div>

          <div v-else-if="dropdowns.length === 0" class="flex flex-col items-center justify-center py-16 gap-4 text-center px-4">
            <div class="size-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
              <Icon name="i-lucide-list" class="size-8 text-primary" />
            </div>
            <h3 class="text-lg font-semibold">No Dropdowns</h3>
            <p class="text-sm text-muted-foreground max-w-sm">No dropdown configurations found. Seed from the API to get started.</p>
          </div>

          <div v-else class="space-y-4">
            <!-- Dropdown Cards Grid -->
            <div v-if="!activeDropdownId" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div
                v-for="dd in dropdowns"
                :key="dd._id"
                class="rounded-xl border border-border/50 bg-card p-5 group hover:border-primary/30 hover:shadow-md transition-all cursor-pointer"
                @click="activeDropdownId = dd._id"
              >
                <div class="flex items-center gap-3 mb-3">
                  <div class="size-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
                    <Icon name="i-lucide-list" class="size-5 text-primary" />
                  </div>
                  <div>
                    <h3 class="font-bold text-sm">{{ dd.name }}</h3>
                    <p class="text-[10px] text-muted-foreground">{{ dd.options.length }} options</p>
                  </div>
                </div>
                <div class="flex flex-wrap gap-1">
                  <span
                    v-for="opt in dd.options.slice(0, 8)"
                    :key="opt._id"
                    class="text-[10px] px-2 py-0.5 rounded-full border font-medium"
                    :style="opt.color ? { backgroundColor: opt.color + '20', color: opt.color, borderColor: opt.color + '40' } : {}"
                    :class="!opt.color ? 'bg-muted/60 text-muted-foreground border-border/40' : ''"
                  >
                    {{ opt.label }}
                  </span>
                  <span v-if="dd.options.length > 8" class="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    +{{ dd.options.length - 8 }} more
                  </span>
                </div>
              </div>
            </div>

            <!-- Expanded Dropdown Options Table -->
            <div v-if="activeDropdown" class="space-y-4">
              <div class="flex items-center gap-3">
                <button
                  class="size-8 rounded-lg flex items-center justify-center hover:bg-muted text-muted-foreground transition-colors"
                  @click="activeDropdownId = null; addingOption = false"
                >
                  <Icon name="i-lucide-arrow-left" class="size-4" />
                </button>
                <h2 class="text-base font-bold">{{ activeDropdown.name }}</h2>
                <span class="text-xs text-muted-foreground">{{ activeDropdown.options.length }} options</span>
                <div class="ml-auto">
                  <Button size="sm" class="h-8 px-3" @click="addingOption = true; newOptionLabel = ''">
                    <Icon name="i-lucide-plus" class="mr-1.5 size-3.5" />
                    Add Option
                  </Button>
                </div>
              </div>

              <!-- Add new option row -->
              <div v-if="addingOption" class="flex items-center gap-2 px-4 py-3 rounded-xl border border-primary/30 bg-primary/5">
                <input
                  v-model="newOptionLabel"
                  class="flex-1 h-8 px-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="New option label..."
                  @keydown.enter="addOption(activeDropdown!._id)"
                  @keydown.escape="addingOption = false"
                />
                <Button size="sm" class="h-8" @click="addOption(activeDropdown!._id)">Add</Button>
                <Button size="sm" variant="ghost" class="h-8" @click="addingOption = false">Cancel</Button>
              </div>

              <!-- Options Table -->
              <div class="rounded-xl border border-border/50 bg-card shadow-xs overflow-hidden">
                <div class="overflow-x-auto">
                  <table class="w-full text-sm" style="min-width: 600px">
                    <thead>
                      <tr class="border-b border-border/50 bg-muted/30">
                        <th class="w-10 px-2 py-3" />
                        <th class="text-left px-4 py-3 font-semibold text-muted-foreground text-[10px] uppercase tracking-wider w-8">#</th>
                        <th class="text-left px-4 py-3 font-semibold text-muted-foreground text-[10px] uppercase tracking-wider">Label</th>
                        <th class="text-center px-4 py-3 font-semibold text-muted-foreground text-[10px] uppercase tracking-wider w-24">Color</th>
                        <th class="text-center px-4 py-3 font-semibold text-muted-foreground text-[10px] uppercase tracking-wider w-24">Icon</th>
                        <th class="w-16 px-4 py-3" />
                      </tr>
                    </thead>
                    <draggable
                      :list="sortedOptions"
                      tag="tbody"
                      item-key="_id"
                      handle=".drag-handle"
                      ghost-class="opacity-30"
                      drag-class="!bg-primary/10"
                      @end="reorderOptions(activeDropdown!._id)"
                    >
                      <template #item="{ element: opt, index: idx }">
                      <tr
                        class="group border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors"
                      >
                        <!-- Drag Handle -->
                        <td class="px-2 py-2.5 text-center">
                          <div class="drag-handle cursor-grab active:cursor-grabbing size-7 rounded flex items-center justify-center hover:bg-muted text-muted-foreground/40 hover:text-muted-foreground transition-colors">
                            <Icon name="i-lucide-grip-vertical" class="size-4" />
                          </div>
                        </td>
                        <!-- Order -->
                        <td class="px-4 py-2.5 text-xs text-muted-foreground font-mono">{{ idx + 1 }}</td>

                        <!-- Label (inline-editable) -->
                        <td class="px-4 py-2.5">
                          <div
                            v-if="editingCell?.optId === opt._id && editingCell?.field === 'label'"
                            class="flex items-center gap-1"
                          >
                            <input
                              v-model="editingValue"
                              class="h-7 px-2 rounded border bg-background text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-primary/20"
                              @keydown.enter="commitEditLabel(activeDropdown!._id, opt._id)"
                              @keydown.escape="editingCell = null"
                              @blur="commitEditLabel(activeDropdown!._id, opt._id)"
                            />
                          </div>
                          <div
                            v-else
                            class="flex items-center gap-2 cursor-pointer group/label"
                            @click="startEditLabel(opt)"
                          >
                            <span
                              class="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border"
                              :style="opt.color ? { backgroundColor: opt.color + '20', color: opt.color, borderColor: opt.color + '40' } : {}"
                              :class="!opt.color ? 'bg-muted/60 text-foreground border-border/40' : ''"
                            >
                              <Icon v-if="opt.icon" :name="opt.icon" class="size-3" />
                              {{ opt.label }}
                            </span>
                            <Icon name="i-lucide-pencil" class="size-3 text-muted-foreground/0 group-hover/label:text-muted-foreground transition-colors" />
                          </div>
                        </td>

                        <!-- Color picker -->
                        <td class="px-4 py-2.5 text-center">
                          <Popover>
                            <PopoverTrigger as-child>
                              <button class="mx-auto size-7 rounded-lg border flex items-center justify-center hover:bg-muted transition-colors">
                                <div
                                  v-if="opt.color"
                                  class="size-4 rounded-md"
                                  :style="{ backgroundColor: opt.color }"
                                />
                                <Icon v-else name="i-lucide-palette" class="size-3.5 text-muted-foreground" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent class="w-56 p-3" align="center">
                              <p class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Pick Color</p>
                              <div class="grid grid-cols-10 gap-1">
                                <button
                                  v-for="c in COLOR_PALETTE"
                                  :key="c"
                                  class="size-5 rounded-md border transition-all hover:scale-110"
                                  :class="opt.color === c ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : 'border-transparent'"
                                  :style="{ backgroundColor: c }"
                                  @click="updateOption(activeDropdown!._id, opt._id, { color: c })"
                                />
                              </div>
                              <button
                                v-if="opt.color"
                                class="mt-2 w-full text-[10px] text-muted-foreground hover:text-foreground py-1 rounded hover:bg-muted transition-colors"
                                @click="updateOption(activeDropdown!._id, opt._id, { color: '' })"
                              >
                                Clear color
                              </button>
                            </PopoverContent>
                          </Popover>
                        </td>

                        <!-- Icon picker -->
                        <td class="px-4 py-2.5 text-center">
                          <Popover @update:open="(v: boolean) => { if (v) iconSearchQuery = '' }">
                            <PopoverTrigger as-child>
                              <button class="mx-auto size-7 rounded-lg border flex items-center justify-center hover:bg-muted transition-colors">
                                <Icon v-if="opt.icon" :name="opt.icon" class="size-3.5" :style="opt.color ? { color: opt.color } : {}" />
                                <Icon v-else name="i-lucide-smile" class="size-3.5 text-muted-foreground" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent class="w-64 p-3" align="center">
                              <input
                                v-model="iconSearchQuery"
                                class="w-full h-7 px-2 rounded border bg-background text-xs mb-2 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                placeholder="Search icons..."
                              />
                              <div class="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto">
                                <button
                                  v-for="ic in filteredIcons"
                                  :key="ic"
                                  class="size-7 rounded-md flex items-center justify-center hover:bg-muted transition-colors"
                                  :class="opt.icon === ic ? 'bg-primary/10 ring-1 ring-primary' : ''"
                                  :title="ic.replace('i-lucide-', '')"
                                  @click="updateOption(activeDropdown!._id, opt._id, { icon: ic })"
                                >
                                  <Icon :name="ic" class="size-3.5" />
                                </button>
                              </div>
                              <button
                                v-if="opt.icon"
                                class="mt-2 w-full text-[10px] text-muted-foreground hover:text-foreground py-1 rounded hover:bg-muted transition-colors"
                                @click="updateOption(activeDropdown!._id, opt._id, { icon: '' })"
                              >
                                Clear icon
                              </button>
                            </PopoverContent>
                          </Popover>
                        </td>

                        <!-- Actions -->
                        <td class="px-4 py-2.5">
                          <button
                            class="size-7 rounded flex items-center justify-center hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors sm:opacity-0 sm:group-hover:opacity-100"
                            @click="removeOption(activeDropdown!._id, opt._id)"
                          >
                            <Icon name="i-lucide-trash-2" class="size-3.5" />
                          </button>
                        </td>
                      </tr>
                      </template>
                    </draggable>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </template>

    </main>
    <!-- ═══════ CREATE / EDIT MODAL ═══════ -->
    <Dialog v-model:open="showCreateModal">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{{ editingId ? 'Edit Skill Bonus Rule' : 'Add Skill Bonus Rule' }}</DialogTitle>
          <DialogDescription>
            {{ editingId ? 'Update the bonus rule details.' : 'Define a new bonus rule for a skill level.' }}
          </DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-5 py-3">
          <!-- Skill Set -->
          <div class="flex flex-col gap-1.5">
            <Label for="sb-skillset">Skill Set</Label>
            <Select v-model="form.skillSet">
              <SelectTrigger id="sb-skillset">
                <SelectValue placeholder="Select a skill level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="lvl in SKILL_LEVELS" :key="lvl" :value="lvl">{{ lvl }}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <!-- Reviewed Times & Bonus Amount -->
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1.5">
              <Label for="sb-reviewed">Reviewed Times</Label>
              <Input id="sb-reviewed" v-model.number="form.reviewedTimes" type="number" min="0" placeholder="e.g. 2" />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="sb-bonus">Bonus Amount ($)</Label>
              <Input id="sb-bonus" v-model.number="form.bonusAmount" type="number" min="0" step="0.01" placeholder="e.g. 0.04" />
            </div>
          </div>


          <!-- Supervisor Check -->
          <div class="flex flex-col gap-1.5">
            <Label for="sb-supervisor">Supervisor Check</Label>
            <Select v-model="form.supervisorCheck">
              <SelectTrigger id="sb-supervisor">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="opt in SUPERVISOR_OPTIONS" :key="opt" :value="opt">{{ opt }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="showCreateModal = false">Cancel</Button>
          <Button :disabled="saving" @click="saveRecord">
            <Icon v-if="saving" name="i-lucide-loader-circle" class="mr-2 size-4 animate-spin" />
            {{ editingId ? 'Save Changes' : 'Add Rule' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- ═══════ WORKSPACE MODAL ═══════ -->
    <Dialog v-model:open="showWpModal">
      <DialogContent class="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{{ editingWpId ? 'Configure Workspace' : 'Add Workspace' }}</DialogTitle>
          <DialogDescription>
             Define the scope of this workspace and toggle exactly which modules its members can access.
          </DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-5 py-3 overflow-y-auto max-h-[65vh] pr-2">
          
          <div class="grid grid-cols-2 gap-4">
            <!-- Name -->
            <div class="flex flex-col gap-1.5 col-span-2 sm:col-span-1">
              <Label for="wp-name">Workspace Name</Label>
              <Input id="wp-name" v-model="wpForm.name" placeholder="Management Team" />
            </div>
            <!-- Plan Label -->
            <div class="flex flex-col gap-1.5 col-span-2 sm:col-span-1">
              <Label for="wp-plan">Badge / Plan Name</Label>
              <Input id="wp-plan" v-model="wpForm.plan" placeholder="Full Access" />
            </div>
          </div>

          <!-- Logo -->
          <div class="flex flex-col gap-2">
            <Label>Workspace Icon</Label>
            <div class="flex flex-wrap gap-2">
               <button
                 v-for="icon in WpIconsList" :key="icon"
                 class="size-10 rounded-lg border flex items-center justify-center transition-all"
                 :class="wpForm.logo === icon ? 'bg-primary text-primary-foreground border-primary shadow-sm ring-2 ring-primary/20' : 'bg-card text-muted-foreground border-border/50 hover:bg-muted'"
                 @click="wpForm.logo = icon"
               >
                 <Icon :name="icon" class="size-5" />
               </button>
            </div>
          </div>

          <Separator class="my-1" />

          <!-- Permissions Builder -->
          <div class="flex flex-col gap-4">
             <div>
                <Label class="text-base font-semibold">Menu Access & Permissions</Label>
                <p class="text-xs text-muted-foreground mt-0.5 mb-4">Toggle modules on/off and configure granular CRUD permissions for each route.</p>
             </div>

             <!-- Render all grouped menus -->
             <div class="grid grid-cols-1 gap-5">
                <div v-for="g in menusByGroup" :key="g.group" class="rounded-xl border border-border/60 bg-muted/10 overflow-hidden">
                   <div class="px-4 py-2.5 bg-muted/30 border-b border-border/50 flex items-center justify-between">
                      <span class="text-xs font-bold uppercase tracking-wider text-muted-foreground">{{ g.group }}</span>
                      <button class="text-[10px] font-medium text-primary hover:underline uppercase" @click="toggleGroup(g.items)">
                         {{ hasAllInGroup(g.items) ? 'Deselect All' : 'Select All' }}
                      </button>
                   </div>
                   <div class="divide-y divide-border/30 bg-card">
                      <div 
                         v-for="item in g.items" 
                         :key="item.id" 
                         class="transition-all duration-200"
                         :class="wpForm.allowedMenus.includes(item.id) ? 'bg-card' : 'bg-muted/10 opacity-50'"
                      >
                         <!-- Menu toggle row -->
                         <div 
                           class="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
                           @click="toggleMenu(item.id)"
                         >
                           <div 
                             class="size-8 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                             :class="wpForm.allowedMenus.includes(item.id) ? 'bg-primary/10 border border-primary/20' : 'bg-muted border border-border/50'"
                           >
                             <Icon :name="getCaps(item.id).icon" class="size-4" :class="wpForm.allowedMenus.includes(item.id) ? 'text-primary' : 'text-muted-foreground'" />
                           </div>
                           <div class="flex-1 min-w-0">
                             <span class="font-medium text-sm" :class="wpForm.allowedMenus.includes(item.id) ? 'text-foreground' : 'text-muted-foreground'">{{ item.title }}</span>
                             <p v-if="isViewOnly(item.id) && wpForm.allowedMenus.includes(item.id)" class="text-[10px] text-blue-500/70 mt-0.5 flex items-center gap-1">
                               <Icon name="i-lucide-lock" class="size-2.5" />
                               View only — no editable actions
                             </p>
                           </div>
                           <div class="shrink-0">
                             <div 
                               class="size-5 rounded-md border-2 flex items-center justify-center transition-all"
                               :class="wpForm.allowedMenus.includes(item.id) ? 'bg-primary border-primary' : 'border-border'"
                             >
                               <Icon v-if="wpForm.allowedMenus.includes(item.id)" name="i-lucide-check" class="size-3 text-primary-foreground" />
                             </div>
                           </div>
                         </div>

                         <!-- CRUD Permission pills (shown when active & has multiple ops) -->
                         <div 
                           v-if="wpForm.allowedMenus.includes(item.id) && !isViewOnly(item.id)" 
                           class="px-4 pb-3 pt-0 ml-11"
                         >
                           <div class="flex flex-wrap gap-1.5">
                             <button
                               v-for="op in getCaps(item.id).ops"
                               :key="op"
                               class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-semibold uppercase tracking-wider transition-all cursor-pointer"
                               :class="hasPerm(item.id, op) 
                                 ? OP_META[op]?.color 
                                 : 'bg-muted/30 text-muted-foreground/40 border-border/30 hover:bg-muted/50'"
                               :title="op === 'read' ? 'View is always enabled' : `Toggle ${OP_META[op]?.label ?? op}`"
                               @click.stop="togglePerm(item.id, op)"
                             >
                               <Icon :name="OP_META[op]?.icon ?? 'i-lucide-circle'" class="size-2.5" />
                               {{ OP_META[op]?.label ?? op }}
                               <Icon v-if="op === 'read'" name="i-lucide-lock" class="size-2 opacity-50" />
                             </button>
                           </div>
                         </div>
                      </div>
                   </div>
                </div>
             </div>

          </div>

        </div>

        <DialogFooter>
          <Button variant="outline" @click="showWpModal = false">Cancel</Button>
          <Button :disabled="savingWp" @click="saveWorkspace">
            <Icon v-if="savingWp" name="i-lucide-loader-circle" class="mr-2 size-4 animate-spin" />
            {{ editingWpId ? 'Save Configuration' : 'Create Workspace' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

  </div>
</template>
