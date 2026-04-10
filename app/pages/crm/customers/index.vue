<script setup lang="ts">
import { toast } from 'vue-sonner'

const { setHeader } = usePageHeader()
setHeader({
  title: 'Customers',
  icon: 'i-lucide-users',
  description: 'Manage all unified customers and leads',
})

const customers = ref<any[]>([])
const isLoading = ref(true)
const showCreateModal = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const isImporting = ref(false)

const isQuickEditMode = ref(false)
const activeDropdown = ref<string | null>(null)

function toggleAssignee(customer: any, field: string, email: string) {
  let arr = getAssignedToArray(customer[field])
  if (arr.includes(email)) {
    arr = arr.filter(e => e !== email)
  } else {
    arr.push(email)
  }
  const val = arr.join(',')
  customer[field] = val
  
  $fetch(`/api/customers/${customer._id}`, {
    method: 'PUT',
    body: { [field]: val }
  }).catch(() => toast.error('Failed to save assignment'))
}

function removeAssignee(customer: any, field: string, email: string) {
  let arr = getAssignedToArray(customer[field])
  arr = arr.filter(e => e !== email)
  const val = arr.join(',')
  customer[field] = val
  
  $fetch(`/api/customers/${customer._id}`, {
    method: 'PUT',
    body: { [field]: val }
  }).catch(() => toast.error('Failed to remove assignment'))
}

async function handleQuickUpdate(customer: any, field: string, event: Event) {
  const target = event.target as HTMLInputElement | HTMLTextAreaElement
  let val: any = target.value
  
  if (target.type === 'number') {
    val = val === '' ? null : Number(val)
  }
  if (target.type === 'date' && !val) val = null

  // Update optimistic local state immediately (spreadsheet feel)
  customer[field] = val

  try {
    const res = await $fetch<any>(`/api/customers/${customer._id}`, {
      method: 'PUT',
      body: { [field]: val }
    })
    if (!res.success) throw new Error('API failed')
  } catch (err) {
    toast.error(`Failed to save ${field}`)
  }
}

async function handleFileUpload(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  isImporting.value = true
  const formData = new FormData()
  formData.append('file', file)

  try {
    const res = await $fetch<any>('/api/customers/import', {
      method: 'POST',
      body: formData
    })
    if (res?.success) {
      toast.success(`Imported ${res.count} customers`)
      fetchCustomers()
    } else {
      toast.error(res?.error || 'Failed to import customers')
    }
  } catch (error) {
    toast.error('An error occurred during import')
  } finally {
    isImporting.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}

async function fetchCustomers() {
  isLoading.value = true
  try {
    const res = await $fetch<any>('/api/customers')
    if (res?.success) {
      customers.value = res.data || []
    }
  } catch (error) {
    toast.error('Failed to load customers')
  } finally {
    isLoading.value = false
  }
}

function onCustomerCreated(customer: any) {
  customers.value.unshift(customer)
}

const employeesList = ref<any[]>([])

async function fetchEmployees() {
  try {
    const res = await $fetch<any>('/api/employees')
    if (res?.success) {
      employeesList.value = res.data || []
    }
  } catch (error) {
    console.error('Failed to load employees', error)
  }
}

function resolveAssignedTo(assignedTo: string | undefined | null) {
  if (!assignedTo) return null
  const emp = employeesList.value.find(e => e.email === assignedTo || e.employee === assignedTo || e._id === assignedTo)
  if (emp) return { name: emp.employee, image: emp.profileImage }
  return { name: assignedTo, image: null }
}

function getAssignedToArray(assignedTo: any): string[] {
  if (!assignedTo) return []
  if (Array.isArray(assignedTo)) return assignedTo.filter(Boolean)
  if (typeof assignedTo === 'string') return assignedTo.split(/[,;]/).map(s => s.trim()).filter(Boolean)
  return []
}

function getAssignedToNames(assignedTo: any): string {
  const arr = getAssignedToArray(assignedTo)
  if (!arr.length) return ''
  return arr.map(a => resolveAssignedTo(a)?.name).filter(Boolean).join(', ')
}

onMounted(() => {
  fetchCustomers()
  fetchEmployees()
})

function formatCurrency(val: any) {
  if (val === null || val === undefined || val === '') return ''
  const num = Number(val)
  if (isNaN(num)) return val
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num)
}

function formatShortDate(dateString: string) {
  if (!dateString) return ''
  const d = new Date(dateString)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const searchQuery = ref('')
const selectedStageFilter = ref<string>('all')

const filteredCustomers = computed(() => {
  const query = searchQuery.value.toLowerCase()
  let list = customers.value

  if (query) {
    list = list.filter(c => 
      c.name?.toLowerCase().includes(query) || 
      c.email?.toLowerCase().includes(query) || 
      c.phone?.toLowerCase().includes(query) ||
      c.stage?.toLowerCase().includes(query)
    )
  }

  // Filter by selected tab stage
  if (selectedStageFilter.value !== 'all') {
    if (selectedStageFilter.value === 'uncategorized') {
      list = list.filter(c => !c.stage || c.stage.trim() === '')
    } else {
      list = list.filter(c => c.stage && normalizeStage(c.stage) === normalizeStage(selectedStageFilter.value))
    }
  }

  return list.sort((a, b) => {
    const nameA = (a.name || `${a.firstName || ''} ${a.lastName || ''}`.trim() || 'Unknown').toLowerCase()
    const nameB = (b.name || `${b.firstName || ''} ${b.lastName || ''}`.trim() || 'Unknown').toLowerCase()
    return nameA.localeCompare(nameB)
  })
})

const STAGES = [
  { id: 'contact made', label: 'contact made', bg: 'bg-[#FFD966]', text: 'text-black', border: 'border-[#FFD966]' },
  { id: 'Needs estimate', label: 'Needs estimate', bg: 'bg-[#FFE599]', text: 'text-black', border: 'border-[#FFE599]' },
  { id: 'Estimate sent', label: 'Estimate sent', bg: 'bg-[#F6B26B]', text: 'text-black', border: 'border-[#F6B26B]' },
  { id: 'Changes requested', label: 'Changes requested', bg: 'bg-[#4A86E8]', text: 'text-white', border: 'border-[#4A86E8]' },
  { id: 'Follow-Up Sent', label: 'Follow-Up Sent', bg: 'bg-[#E06666]', text: 'text-white', border: 'border-[#E06666]' },
  { id: 'Needs Sched', label: 'Needs Sched', bg: 'bg-[#EA9999]', text: 'text-black', border: 'border-[#EA9999]' },
  { id: 'Needs Contr', label: 'Needs Contr', bg: 'bg-[#B4A7D6]', text: 'text-black', border: 'border-[#B4A7D6]' },
  { id: 'Waiting for sign', label: 'Waiting for Si...', bg: 'bg-[#8E7CC3]', text: 'text-white', border: 'border-[#8E7CC3]' },
  { id: 'Needs Deposit', label: 'Needs Deposit', bg: 'bg-[#3D85C6]', text: 'text-white', border: 'border-[#3D85C6]' },
  { id: 'Needs wood', label: 'Needs wood', bg: 'bg-[#0B5394]', text: 'text-white', border: 'border-[#0B5394]' },
  { id: 'Needs Crew', label: 'Needs Crew', bg: 'bg-[#76A5AF]', text: 'text-black', border: 'border-[#76A5AF]' },
  { id: 'Project In Rev', label: 'Project Is Re...', bg: 'bg-[#45818E]', text: 'text-white', border: 'border-[#45818E]' },
  { id: 'Project In Pro', label: 'Project In Pro...', bg: 'bg-[#38761D]', text: 'text-white', border: 'border-[#38761D]' },
  { id: 'needs follow', label: 'needs follow', bg: 'bg-[#6AA84F]', text: 'text-white', border: 'border-[#6AA84F]' },
  { id: 'inspection do', label: 'inspection do...', bg: 'bg-[#93C47D]', text: 'text-black', border: 'border-[#93C47D]' },
  { id: 'Waiting for P', label: 'Waiting for P...', bg: 'bg-[#8FCE00]', text: 'text-black', border: 'border-[#8FCE00]' },
  { id: 'lost', label: 'lost', bg: 'bg-[#999999]', text: 'text-white', border: 'border-[#999999]' },
  { id: 'subscribers', label: 'subscribers', bg: 'bg-[#333333]', text: 'text-white', border: 'border-[#333333]' }
]

// Helper to normalize stages and fix common CSV import typos
function normalizeStage(stageStr: string): string {
  if (!stageStr) return ''
  let s = stageStr.trim().toLowerCase()
  s = s.replace('neads', 'needs') // fix typo from CSV
  s = s.replace(/needs estimate\s*$/, 'needs estimate')
  return s
}

// We dynamically track new stages uploaded by users
const dynamicStages = ref<any[]>([])

// Pipeline groupings for correct top-bar counts (always global, ignoring active tab)
const pipelineGroups = computed(() => {
  const groups: Record<string, any[]> = {}
  STAGES.forEach(s => groups[s.id] = [])
  dynamicStages.value.forEach(s => groups[s.id] = [])
  groups['uncategorized'] = []
  
  // Apply search query if needed
  const query = searchQuery.value.toLowerCase()
  let list = customers.value
  if (query) {
    list = list.filter(c => 
      c.name?.toLowerCase().includes(query) || 
      c.email?.toLowerCase().includes(query) || 
      c.phone?.toLowerCase().includes(query) ||
      c.stage?.toLowerCase().includes(query)
    )
  }

  list.forEach(c => {
    let s = c.stage
    if (!s || s.trim() === '') {
      const arr = groups['uncategorized'] || []
      arr.push(c)
      groups['uncategorized'] = arr
      return
    }
    
    let searchStage = normalizeStage(s)
    
    const matched = STAGES.find(x => normalizeStage(x.id) === searchStage)
    if (matched) {
      const arr = groups[matched.id] || []
      arr.push(c)
      groups[matched.id] = arr
    } else {
      // Dynamic missing stage
      const exactVal = s.trim()
      let dynMatch = dynamicStages.value.find(x => x.id.toLowerCase() === exactVal.toLowerCase())
      if (!dynMatch) {
        dynMatch = { id: exactVal, label: exactVal, bg: 'bg-muted/80', text: 'text-foreground', border: 'border-border' }
        dynamicStages.value.push(dynMatch)
        groups[exactVal] = []
      }
      const arr = groups[dynMatch.id] || []
      arr.push(c)
      groups[dynMatch.id] = arr
    }
  })
  
  const allStages = [...STAGES, ...dynamicStages.value]
  
  return [
    {
      stage: { id: 'all', label: 'All', bg: 'bg-primary/20', text: 'text-primary', border: 'border-primary/20' },
      items: list
    },
    ...allStages.map(s => ({ stage: s, items: groups[s.id] || [] })),
    {
      stage: { id: 'uncategorized', label: 'Uncategorized', bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-border' },
      items: groups['uncategorized']
    }
  ].filter(g => g.stage.id === 'all' || g.items.length > 0 || STAGES.find(x => x.id === g.stage.id))
})

// Table grouping (applies both search AND tab filters)
const tableGroupedCustomers = computed(() => {
  const groups: Record<string, any[]> = {}
  STAGES.forEach(s => groups[s.id] = [])
  dynamicStages.value.forEach(s => groups[s.id] = [])
  groups['uncategorized'] = []
  
  filteredCustomers.value.forEach(c => {
    let s = c.stage
    if (!s || s.trim() === '') {
      const arr = groups['uncategorized'] || []
      arr.push(c)
      groups['uncategorized'] = arr
      return
    }
    
    let searchStage = normalizeStage(s)
    
    const matched = STAGES.find(x => normalizeStage(x.id) === searchStage)
    if (matched) {
      const arr = groups[matched.id] || []
      arr.push(c)
      groups[matched.id] = arr
    } else {
      const exactVal = s.trim()
      const dynMatch = dynamicStages.value.find(x => x.id.toLowerCase() === exactVal.toLowerCase())
      if (dynMatch) {
         const arr = groups[dynMatch.id] || []
         arr.push(c)
         groups[dynMatch.id] = arr
      } else {
         const arr = groups['uncategorized'] || []
         arr.push(c)
         groups['uncategorized'] = arr
      }
    }
  })
  
  const allStages = [...STAGES, ...dynamicStages.value]
  
  return [...allStages.map(s => ({ stage: s, items: groups[s.id] || [] })), 
    { stage: { id: 'uncategorized', label: 'Uncategorized', bg: 'bg-muted', text: 'text-foreground', border: 'border-border' }, items: groups['uncategorized'] }
  ].filter(g => g.items.length > 0)
})


const expandedStages = ref<Record<string, boolean>>({})

watchEffect(() => {
  STAGES.forEach(s => {
    if (expandedStages.value[s.id] === undefined) {
      expandedStages.value[s.id] = true
    }
  })
  if (expandedStages.value['uncategorized'] === undefined) {
    expandedStages.value['uncategorized'] = true
  }
})

const getChevronClipPath = (isFirst: boolean) => {
  if (isFirst) {
    return 'polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%)'
  }
  return 'polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%, 10px 50%)'
}

function selectFilter(id: string) {
  selectedStageFilter.value = id
  if (id !== 'all') {
    expandedStages.value[id] = true
  }
}
</script>

<template>
  <div class="h-[calc(100vh-theme(spacing.20))] sm:h-[calc(100vh-theme(spacing.24))] flex flex-col space-y-4 -mb-4 sm:-mb-6">
    <Teleport to="#header-toolbar">
      <div class="flex items-center gap-2 sm:gap-3 w-full max-w-xl pr-2">
        <div class="relative flex-1">
          <Icon name="i-lucide-search" class="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 size-3.5 sm:size-4 text-muted-foreground" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search customers..."
            class="w-full h-8 sm:h-9 pl-8 sm:pl-9 pr-4 rounded-lg border border-input bg-background/50 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
          >
        </div>
        <input type="file" ref="fileInput" accept=".csv" class="hidden" @change="handleFileUpload" />
        <button
          class="inline-flex items-center justify-center gap-2 h-8 sm:h-9 px-3 sm:px-4 rounded-lg bg-secondary text-secondary-foreground border border-border text-xs sm:text-sm font-bold hover:bg-secondary/90 transition-all shrink-0"
          @click="fileInput?.click()"
          :disabled="isImporting"
        >
          <Icon name="i-lucide-upload" class="size-3.5" :class="{ 'animate-spin': isImporting }" />
          <span class="hidden sm:inline" v-if="!isImporting">Import CSV</span>
          <span class="hidden sm:inline" v-else>Importing...</span>
        </button>
        <button
          class="inline-flex items-center justify-center gap-2 h-8 sm:h-9 px-3 sm:px-4 rounded-lg bg-primary text-primary-foreground text-xs sm:text-sm font-bold hover:bg-primary/90 transition-all shrink-0 shadow-lg shadow-primary/20"
          @click="showCreateModal = true"
        >
          <Icon name="i-lucide-plus" class="size-3.5" />
          <span class="hidden sm:inline">New</span>
        </button>
        <button
          class="inline-flex items-center justify-center gap-2 h-8 sm:h-9 px-3 sm:px-4 rounded-lg text-xs sm:text-sm font-bold transition-all shrink-0 border border-border"
          :class="isQuickEditMode ? 'bg-primary/20 text-primary border-primary/30' : 'bg-background hover:bg-muted text-muted-foreground'"
          @click="isQuickEditMode = !isQuickEditMode"
        >
          <Icon :name="isQuickEditMode ? 'i-lucide-check' : 'i-lucide-edit-3'" class="size-3.5" />
          <span class="hidden sm:inline">{{ isQuickEditMode ? 'Done' : 'Quick Edit' }}</span>
        </button>
      </div>
    </Teleport>

    <CrmCustomerFormDialog 
      v-model="showCreateModal"
      @saved="onCustomerCreated"
    />

    <!-- Pipeline Headers as Filters -->
    <div class="flex overflow-x-auto w-full scrollbar-hide text-xs whitespace-nowrap select-none bg-card rounded-xl overflow-hidden border border-border/50 shadow-sm mb-1">
      <div v-for="(g, idx) in pipelineGroups" :key="g.stage.id"
           class="relative -ml-3 first:ml-0 first:pl-2 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] cursor-pointer origin-center"
           :class="selectedStageFilter === g.stage.id ? 'z-50 scale-[1.12]' : 'opacity-70 hover:opacity-100 hover:brightness-110 hover:scale-[1.03]'"
           :style="{ zIndex: selectedStageFilter === g.stage.id ? 50 : pipelineGroups.length - idx }"
           @click="selectFilter(g.stage.id)">
           
           <!-- ACTIVE STATE (Rotating Conic Edge) -->
           <div v-if="selectedStageFilter === g.stage.id" class="relative flex items-center justify-center h-12 pl-6 pr-6">
              <!-- INVISIBLE TEXT FORCING EXACT WIDTH -->
              <div class="flex flex-col items-center justify-center pt-0.5 opacity-0 pointer-events-none">
                <span class="font-bold text-[13px] leading-tight">{{ g.items.length }}</span>
                <span class="text-[9px] uppercase tracking-wider truncate max-w-[90px]">{{ g.stage.label }}</span>
              </div>
              
              <!-- OUTER BORDER MASK (Clipped) -->
              <div class="absolute inset-0 overflow-hidden" :style="{ clipPath: getChevronClipPath(idx === 0) }">
                 <div class="absolute inset-0 brightness-[0.7]" :class="g.stage.bg"></div>
                 <div class="absolute inset-[-100%] bg-[conic-gradient(from_0deg,transparent_0_300deg,white_360deg)] animate-[spin_2s_linear_infinite]" />
              </div>

              <!-- INNER CONTENT (Inset by 2.5px to reveal outer mask) -->
              <div class="absolute inset-[2.5px] transition-all flex flex-col items-center justify-center pt-0.5 brightness-110 font-bold"
                   :class="[g.stage.bg, g.stage.text]"
                   :style="{ clipPath: getChevronClipPath(idx === 0) }">
                  <span class="font-bold text-[13px] leading-tight">{{ g.items.length }}</span>
                  <span class="text-[9px] uppercase tracking-wider opacity-95 truncate max-w-[90px] text-center" :title="g.stage.label">{{ g.stage.label }}</span>
              </div>
           </div>

           <!-- INACTIVE STATE (Standard) -->
           <div v-else class="flex items-center justify-center h-12 pl-6 pr-6 w-full transition-all duration-300"
                :class="[g.stage.bg, g.stage.text]"
                :style="{ clipPath: getChevronClipPath(idx === 0) }">
              <div class="flex flex-col items-center justify-center pt-0.5">
                <span class="font-bold text-[13px] leading-tight">{{ g.items.length }}</span>
                <span class="text-[9px] uppercase tracking-wider opacity-95 truncate max-w-[90px] text-center" :title="g.stage.label">{{ g.stage.label }}</span>
              </div>
           </div>
      </div>
    </div>

    <!-- Table Details -->
    <div class="flex-1 min-h-0 overflow-auto bg-card border border-border/50 rounded-xl text-sm shadow-sm relative">
      <table class="w-full text-left border-collapse whitespace-nowrap">
        <thead>
          <tr class="border-b bg-card text-muted-foreground text-[10px] font-bold uppercase tracking-wider sticky top-0 z-20">
            <th class="p-2.5 w-10 text-center"><input type="checkbox" class="rounded border-border text-primary cursor-pointer" /></th>
            <th class="p-2.5 min-w-[200px]">Name</th>
            <th class="p-2.5 min-w-[100px]">Est. Duration</th>
            <th class="p-2.5 min-w-[120px]">Total Estimate</th>
            <th class="p-2.5 min-w-[140px]">Assigned To</th>
            <th class="p-2.5 min-w-[80px] text-center">Views</th>
            <th class="p-2.5 min-w-[120px]">Estimate Sent On</th>
            <th class="p-2.5 min-w-[250px]">Notes</th>
            <th class="p-2.5 min-w-[100px]">Contact Date</th>
            <th class="p-2.5 min-w-[100px]">Follow-Up On</th>
            <th class="p-2.5 min-w-[100px]">Date Approved</th>
            <th class="p-2.5 min-w-[140px]">Project Assigned To</th>
            <th class="p-2.5 min-w-[100px]">Wood Ordered</th>
          </tr>
        </thead>
        <tbody v-if="isLoading">
          <tr v-for="i in 5" :key="i">
            <td colspan="13" class="p-4">
              <div class="h-6 bg-muted/40 rounded animate-pulse"></div>
            </td>
          </tr>
        </tbody>
        <tbody v-else v-for="g in tableGroupedCustomers" :key="g.stage.id" class="border-b-4 border-border/20 last:border-0 group/tbody">
          
          <!-- Stage Group Header -->
          <tr class="cursor-pointer group/header" @click="expandedStages[g.stage.id] = !expandedStages[g.stage.id]">
            <td colspan="13" class="p-0 sticky top-[34px] z-10 shadow-sm outline outline-1 outline-border/20">
              <div class="flex items-center gap-2 px-3 py-2 bg-card/95 backdrop-blur-md hover:bg-muted/60 transition-colors border-l-[6px]" :class="g.stage.border">
                <button type="button" class="flex items-center justify-center size-5 rounded hover:bg-background/80 transition-colors bg-background/40">
                  <Icon :name="expandedStages[g.stage.id] ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" class="size-4 text-muted-foreground" />
                </button>
                <div class="px-2 py-[3px] rounded text-[10px] uppercase font-bold tracking-wider inline-flex shadow-xs" :class="[g.stage.bg, g.stage.text]">
                  {{ g.stage.label }}
                </div>
                <button type="button" class="ml-1 flex items-center justify-center size-5 rounded-full hover:bg-background/80 transition-colors text-muted-foreground opacity-50 group-hover/header:opacity-100" title="Add Customer">
                  <Icon name="i-lucide-plus" class="size-3.5" />
                </button>
              </div>
            </td>
          </tr>

          <!-- Stage Group Items -->
          <template v-if="expandedStages[g.stage.id]">
            <tr v-for="c in g.items" :key="c._id" class="border-b border-border/30 last:border-0 text-[13px] transition-colors group/row" :class="!isQuickEditMode ? 'hover:bg-muted/20 cursor-pointer' : ''" @click="!isQuickEditMode && navigateTo(`/crm/customers/${c._id}`)">
              <td class="p-2.5 text-center px-4" @click.stop>
                <input type="checkbox" class="rounded border-border text-primary cursor-pointer" />
              </td>
              <td class="p-2.5 font-semibold text-foreground/90 max-w-[200px]" :class="isQuickEditMode ? 'whitespace-normal' : 'truncate'">
                <input v-if="isQuickEditMode" v-model="c.name" @change="handleQuickUpdate(c, 'name', $event)" class="w-full bg-background border border-border/50 rounded px-2 py-1.5 focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
                <template v-else>
                  {{ c.name || `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Unknown' }}
                </template>
              </td>

              <td class="p-2.5 text-muted-foreground" :class="{'whitespace-normal': isQuickEditMode}">
                <input v-if="isQuickEditMode" v-model="c.estimatedProjectDuration" @change="handleQuickUpdate(c, 'estimatedProjectDuration', $event)" class="w-full bg-background border border-border/50 rounded px-2 py-1.5 outline-none focus:border-primary" />
                <template v-else>{{ c.estimatedProjectDuration || '' }}</template>
              </td>
              
              <td class="p-2.5 tabular-nums font-medium text-foreground/80">
                <input v-if="isQuickEditMode" type="number" step="0.01" v-model="c.totalEstimate" @change="handleQuickUpdate(c, 'totalEstimate', $event)" class="w-full bg-background border border-border/50 rounded px-2 py-1.5 outline-none focus:border-primary" />
                <template v-else>{{ formatCurrency(c.totalEstimate) }}</template>
              </td>
              
              <td class="p-2.5">
                <div v-if="isQuickEditMode" :class="['relative w-full transition-all', activeDropdown === c._id + 'assignedTo' ? 'z-[100]' : 'z-10']">
                  <div v-if="activeDropdown === c._id + 'assignedTo'" class="fixed inset-0 z-40" @click.stop="activeDropdown = null" />
                  
                  <div @click.stop="activeDropdown = activeDropdown === c._id + 'assignedTo' ? null : c._id + 'assignedTo'"
                       class="relative z-50 w-full bg-background border border-border/50 rounded px-2 py-1.5 flex flex-wrap gap-1 items-center min-h-[30px] cursor-pointer hover:border-primary/50 transition-colors">
                    <div v-for="assignee in getAssignedToArray(c.assignedTo)" :key="assignee" 
                         class="text-[10px] bg-primary/10 text-primary pl-1.5 pr-1 py-0.5 rounded-full flex items-center gap-1 font-bold border border-primary/20 max-w-[120px]">
                      <img v-if="resolveAssignedTo(assignee)?.image" :src="resolveAssignedTo(assignee)!.image" class="size-3.5 rounded-full object-cover shrink-0" />
                      <span class="truncate">{{ resolveAssignedTo(assignee)?.name }}</span>
                      <div class="hover:bg-primary/20 rounded-full p-0.5 ml-0.5 shrink-0" @click.stop="removeAssignee(c, 'assignedTo', assignee)">
                        <Icon name="i-lucide-x" class="size-3 text-primary/70 hover:text-red-500 transition-colors" />
                      </div>
                    </div>
                    <div v-if="!getAssignedToArray(c.assignedTo).length" class="text-[11px] text-muted-foreground w-full">Select employees...</div>
                  </div>
                  
                  <div v-if="activeDropdown === c._id + 'assignedTo'"
                       class="absolute left-0 top-full mt-1 w-[220px] bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-xl shadow-primary/5 z-50 max-h-[220px] overflow-y-auto flex flex-col py-1.5 ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div v-for="emp in employeesList" :key="emp.email"
                         class="px-3 py-2 text-xs cursor-pointer font-medium flex items-center gap-2.5 transition-colors"
                         :class="getAssignedToArray(c.assignedTo).includes(emp.email) ? 'bg-primary/10 text-primary' : 'hover:bg-muted/60 text-foreground/80 hover:text-foreground'"
                         @click.stop="toggleAssignee(c, 'assignedTo', emp.email)">
                      <img v-if="emp.profileImage" :src="emp.profileImage" class="size-6 rounded-full object-cover border border-border/50" />
                      <div v-else class="size-6 rounded-full bg-muted flex items-center justify-center text-[10px] uppercase font-bold text-muted-foreground border border-border/50 shadow-sm">{{ emp.employee?.substring(0, 2) }}</div>
                      
                      <div class="flex flex-col min-w-0">
                        <span class="truncate text-[13px] leading-tight font-bold">{{ emp.employee }}</span>
                        <span class="text-[9px] opacity-70 truncate">{{ emp.email }}</span>
                      </div>
                      <Icon v-if="getAssignedToArray(c.assignedTo).includes(emp.email)" name="i-lucide-check-circle-2" class="ml-auto size-4 shrink-0" />
                    </div>
                    <div v-if="!employeesList.length" class="px-3 py-4 text-xs text-muted-foreground text-center flex flex-col items-center gap-2">
                       <Icon name="i-lucide-users" class="size-5 opacity-40" />
                       No employees found
                    </div>
                  </div>
                </div>

                <template v-else>
                  <div class="flex items-center" :class="{ '-space-x-1.5': getAssignedToArray(c.assignedTo).length > 1, 'gap-2': getAssignedToArray(c.assignedTo).length === 1 }" v-if="getAssignedToArray(c.assignedTo).length">
                    <div v-for="assignee in getAssignedToArray(c.assignedTo).slice(0, 3)" :key="assignee" 
                         class="relative flex-shrink-0 size-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold uppercase text-primary border-2 border-card shadow-sm hover:z-10 transition-transform hover:scale-110 cursor-help"
                         :title="resolveAssignedTo(assignee)?.name">
                      <img v-if="resolveAssignedTo(assignee)?.image" :src="resolveAssignedTo(assignee)!.image" class="w-full h-full rounded-full object-cover" />
                      <span v-else>{{ resolveAssignedTo(assignee)?.name.substring(0, 1) }}</span>
                    </div>
                    <div v-if="getAssignedToArray(c.assignedTo).length > 3" class="relative flex-shrink-0 size-6 rounded-full bg-muted flex items-center justify-center text-[9px] font-bold text-muted-foreground border-2 border-card shadow-sm z-0">
                      +{{ getAssignedToArray(c.assignedTo).length - 3 }}
                    </div>
                    <span class="text-xs truncate max-w-[150px] ml-1" :title="getAssignedToNames(c.assignedTo)">
                      {{ getAssignedToNames(c.assignedTo) }}
                    </span>
                  </div>
                </template>
              </td>
              
              <td class="p-2.5 tabular-nums text-center text-muted-foreground">
                <input v-if="isQuickEditMode" type="number" v-model="c.totalTrackedViews" @change="handleQuickUpdate(c, 'totalTrackedViews', $event)" class="w-full text-center bg-background border border-border/50 rounded px-2 py-1.5 outline-none focus:border-primary" />
                <template v-else>{{ c.totalTrackedViews || 0 }}</template>
              </td>
              
              <td class="p-2.5 tabular-nums text-muted-foreground">
                <input v-if="isQuickEditMode" type="date" :value="c.estimateSentOn ? new Date(c.estimateSentOn).toISOString().split('T')[0] : ''" @change="handleQuickUpdate(c, 'estimateSentOn', $event)" class="w-full bg-background border border-border/50 rounded px-2 py-1.5 outline-none focus:border-primary" />
                <template v-else>{{ formatShortDate(c.estimateSentOn) }}</template>
              </td>
              
              <td class="p-2.5 text-xs text-muted-foreground" :class="isQuickEditMode ? 'whitespace-normal align-top' : 'max-w-[250px] truncate'" :title="c.notes">
                <textarea v-if="isQuickEditMode" v-model="c.notes" @change="handleQuickUpdate(c, 'notes', $event)" class="w-full bg-background border border-border/50 rounded px-2 py-1.5 outline-none focus:border-primary resize-y min-h-[60px]" placeholder="Notes..."></textarea>
                <template v-else>{{ c.notes || '' }}</template>
              </td>
              
              <td class="p-2.5 tabular-nums text-muted-foreground">
                <input v-if="isQuickEditMode" type="date" :value="c.initialContactDate ? new Date(c.initialContactDate).toISOString().split('T')[0] : ''" @change="handleQuickUpdate(c, 'initialContactDate', $event)" class="w-full bg-background border border-border/50 rounded px-2 py-1.5 outline-none focus:border-primary" />
                <template v-else>{{ formatShortDate(c.initialContactDate) }}</template>
              </td>
              
              <td class="p-2.5 tabular-nums text-muted-foreground">
                <input v-if="isQuickEditMode" type="date" :value="c.lastFollowUpSentOn ? new Date(c.lastFollowUpSentOn).toISOString().split('T')[0] : ''" @change="handleQuickUpdate(c, 'lastFollowUpSentOn', $event)" class="w-full bg-background border border-border/50 rounded px-2 py-1.5 outline-none focus:border-primary" />
                <template v-else>{{ formatShortDate(c.lastFollowUpSentOn) }}</template>
              </td>
              
              <td class="p-2.5 tabular-nums text-muted-foreground">
                <input v-if="isQuickEditMode" type="date" :value="c.dateApproved ? new Date(c.dateApproved).toISOString().split('T')[0] : ''" @change="handleQuickUpdate(c, 'dateApproved', $event)" class="w-full bg-background border border-border/50 rounded px-2 py-1.5 outline-none focus:border-primary" />
                <template v-else>{{ formatShortDate(c.dateApproved) }}</template>
              </td>
              
              <td class="p-2.5">
                <div v-if="isQuickEditMode" :class="['relative w-full transition-all', activeDropdown === c._id + 'projectAssignedTo' ? 'z-[100]' : 'z-10']">
                  <div v-if="activeDropdown === c._id + 'projectAssignedTo'" class="fixed inset-0 z-40" @click.stop="activeDropdown = null" />
                  
                  <div @click.stop="activeDropdown = activeDropdown === c._id + 'projectAssignedTo' ? null : c._id + 'projectAssignedTo'"
                       class="relative z-50 w-full bg-background border border-border/50 rounded px-2 py-1.5 flex flex-wrap gap-1 items-center min-h-[30px] cursor-pointer hover:border-primary/50 transition-colors">
                    <div v-for="assignee in getAssignedToArray(c.projectAssignedTo)" :key="assignee" 
                         class="text-[10px] bg-primary/10 text-primary pl-1.5 pr-1 py-0.5 rounded-full flex items-center gap-1 font-bold border border-primary/20 max-w-[120px]">
                      <img v-if="resolveAssignedTo(assignee)?.image" :src="resolveAssignedTo(assignee)!.image" class="size-3.5 rounded-full object-cover shrink-0" />
                      <span class="truncate">{{ resolveAssignedTo(assignee)?.name }}</span>
                      <div class="hover:bg-primary/20 rounded-full p-0.5 ml-0.5 shrink-0" @click.stop="removeAssignee(c, 'projectAssignedTo', assignee)">
                        <Icon name="i-lucide-x" class="size-3 text-primary/70 hover:text-red-500 transition-colors" />
                      </div>
                    </div>
                    <div v-if="!getAssignedToArray(c.projectAssignedTo).length" class="text-[11px] text-muted-foreground w-full">Select employees...</div>
                  </div>
                  
                  <div v-if="activeDropdown === c._id + 'projectAssignedTo'"
                       class="absolute left-0 top-full mt-1 w-[220px] bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-xl shadow-primary/5 z-50 max-h-[220px] overflow-y-auto flex flex-col py-1.5 ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div v-for="emp in employeesList" :key="emp.email"
                         class="px-3 py-2 text-xs cursor-pointer font-medium flex items-center gap-2.5 transition-colors"
                         :class="getAssignedToArray(c.projectAssignedTo).includes(emp.email) ? 'bg-primary/10 text-primary' : 'hover:bg-muted/60 text-foreground/80 hover:text-foreground'"
                         @click.stop="toggleAssignee(c, 'projectAssignedTo', emp.email)">
                      <img v-if="emp.profileImage" :src="emp.profileImage" class="size-6 rounded-full object-cover border border-border/50" />
                      <div v-else class="size-6 rounded-full bg-muted flex items-center justify-center text-[10px] uppercase font-bold text-muted-foreground border border-border/50 shadow-sm">{{ emp.employee?.substring(0, 2) }}</div>
                      
                      <div class="flex flex-col min-w-0">
                        <span class="truncate text-[13px] leading-tight font-bold">{{ emp.employee }}</span>
                        <span class="text-[9px] opacity-70 truncate">{{ emp.email }}</span>
                      </div>
                      <Icon v-if="getAssignedToArray(c.projectAssignedTo).includes(emp.email)" name="i-lucide-check-circle-2" class="ml-auto size-4 shrink-0" />
                    </div>
                    <div v-if="!employeesList.length" class="px-3 py-4 text-xs text-muted-foreground text-center flex flex-col items-center gap-2">
                       <Icon name="i-lucide-users" class="size-5 opacity-40" />
                       No employees found
                    </div>
                  </div>
                </div>

                <template v-else>
                  <div class="flex items-center" :class="{ '-space-x-1.5': getAssignedToArray(c.projectAssignedTo).length > 1, 'gap-2': getAssignedToArray(c.projectAssignedTo).length === 1 }" v-if="getAssignedToArray(c.projectAssignedTo).length">
                    <div v-for="assignee in getAssignedToArray(c.projectAssignedTo).slice(0, 3)" :key="assignee" 
                         class="relative flex-shrink-0 size-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold uppercase text-primary border-2 border-card shadow-sm hover:z-10 transition-transform hover:scale-110 cursor-help"
                         :title="resolveAssignedTo(assignee)?.name">
                      <img v-if="resolveAssignedTo(assignee)?.image" :src="resolveAssignedTo(assignee)!.image" class="w-full h-full rounded-full object-cover" />
                      <span v-else>{{ resolveAssignedTo(assignee)?.name.substring(0, 1) }}</span>
                    </div>
                    <div v-if="getAssignedToArray(c.projectAssignedTo).length > 3" class="relative flex-shrink-0 size-6 rounded-full bg-muted flex items-center justify-center text-[9px] font-bold text-muted-foreground border-2 border-card shadow-sm z-0">
                      +{{ getAssignedToArray(c.projectAssignedTo).length - 3 }}
                    </div>
                    <span class="text-xs truncate max-w-[150px] ml-1" :title="getAssignedToNames(c.projectAssignedTo)">
                      {{ getAssignedToNames(c.projectAssignedTo) }}
                    </span>
                  </div>
                </template>
              </td>
              
              <td class="p-2.5 tabular-nums text-muted-foreground">
                <input v-if="isQuickEditMode" type="date" :value="c.woodOrderDate ? new Date(c.woodOrderDate).toISOString().split('T')[0] : ''" @change="handleQuickUpdate(c, 'woodOrderDate', $event)" class="w-full bg-background border border-border/50 rounded px-2 py-1.5 outline-none focus:border-primary" />
                <template v-else>{{ formatShortDate(c.woodOrderDate) }}</template>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

/* 
  We simulate a smooth animated rolling ring/border that organically traces the clip path 
  by rotating dual high-intensity drop-shadow coordinates!
*/
.chevron-glow {
  animation: roll-glow 3s linear infinite;
}

.dark .chevron-glow {
  animation: roll-glow-dark 3s linear infinite;
}

@keyframes roll-glow {
  0%   { filter: drop-shadow(0 0 1px rgba(255, 255, 255, 0.9)) drop-shadow(6px 0 6px rgba(255, 255, 255, 0.8)); }
  25%  { filter: drop-shadow(0 0 1px rgba(255, 255, 255, 0.9)) drop-shadow(0 6px 6px rgba(255, 255, 255, 0.8)); }
  50%  { filter: drop-shadow(0 0 1px rgba(255, 255, 255, 0.9)) drop-shadow(-6px 0 6px rgba(255, 255, 255, 0.8)); }
  75%  { filter: drop-shadow(0 0 1px rgba(255, 255, 255, 0.9)) drop-shadow(0 -6px 6px rgba(255, 255, 255, 0.8)); }
  100% { filter: drop-shadow(0 0 1px rgba(255, 255, 255, 0.9)) drop-shadow(6px 0 6px rgba(255, 255, 255, 0.8)); }
}

@keyframes roll-glow-dark {
  0%   { filter: drop-shadow(0 0 1px rgba(255, 255, 255, 0.9)) drop-shadow(6px 0 6px rgba(255, 255, 255, 0.5)); }
  25%  { filter: drop-shadow(0 0 1px rgba(255, 255, 255, 0.9)) drop-shadow(0 6px 6px rgba(255, 255, 255, 0.5)); }
  50%  { filter: drop-shadow(0 0 1px rgba(255, 255, 255, 0.9)) drop-shadow(-6px 0 6px rgba(255, 255, 255, 0.5)); }
  75%  { filter: drop-shadow(0 0 1px rgba(255, 255, 255, 0.9)) drop-shadow(0 -6px 6px rgba(255, 255, 255, 0.5)); }
  100% { filter: drop-shadow(0 0 1px rgba(255, 255, 255, 0.9)) drop-shadow(6px 0 6px rgba(255, 255, 255, 0.5)); }
}
</style>
