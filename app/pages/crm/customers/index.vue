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

onMounted(() => {
  fetchCustomers()
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

const groupedCustomers = computed(() => {
  const groups: Record<string, any[]> = {}
  STAGES.forEach(s => groups[s.id] = [])
  
  filteredCustomers.value.forEach(c => {
    let s = c.stage
    // standardise
    if (!s) s = 'contact made'
    
    // Find closest match or default
    const matched = STAGES.find(x => x.id.toLowerCase() === s.toLowerCase())
    if (matched) {
      const arr = groups[matched.id] || []
      arr.push(c)
      groups[matched.id] = arr
    } else {
      const arr = groups[s] || []
      arr.push(c)
      groups[s] = arr
    }
  })
  
  return Object.keys(groups).map(s => {
    const def = STAGES.find(x => x.id === s) || { id: s, label: s, bg: 'bg-muted', text: 'text-foreground', border: 'border-border' }
    return {
      stage: def,
      items: groups[s] || []
    }
  }).filter(g => g.items.length > 0 || STAGES.find(x => x.id === g.stage.id))
})

const expandedStages = ref<Record<string, boolean>>({})

watchEffect(() => {
  STAGES.forEach(s => {
    if (expandedStages.value[s.id] === undefined) {
      expandedStages.value[s.id] = true
    }
  })
})

const getChevronClipPath = (isFirst: boolean) => {
  if (isFirst) {
    return 'polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%)'
  }
  return 'polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%, 10px 50%)'
}
</script>

<template>
  <div class="h-full flex flex-col space-y-4">
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
      </div>
    </Teleport>

    <CrmCustomerFormDialog 
      v-model="showCreateModal"
      @saved="onCustomerCreated"
    />

    <!-- Pipeline Headers -->
    <div class="flex overflow-x-auto w-full pb-1 -mx-2 px-2 scrollbar-hide text-xs whitespace-nowrap min-h-[48px] select-none">
      <div v-for="(g, idx) in groupedCustomers" :key="g.stage.id"
           class="relative flex items-center justify-center h-12 pl-6 pr-6 -ml-3 first:ml-0 first:pl-4 transition-all duration-300 hover:brightness-110 cursor-pointer"
           :class="[g.stage.bg, g.stage.text]"
           @click="expandedStages[g.stage.id] = !expandedStages[g.stage.id]"
           :style="{ zIndex: groupedCustomers.length - idx, clipPath: getChevronClipPath(idx === 0) }">
        <div class="flex flex-col items-center justify-center pt-0.5">
          <span class="font-bold text-[13px] leading-tight">{{ g.items.length }}</span>
          <span class="text-[9px] uppercase tracking-wider opacity-95 truncate max-w-[90px]" :title="g.stage.label">{{ g.stage.label }}</span>
        </div>
      </div>
    </div>

    <!-- Table Details -->
    <div class="flex-1 overflow-x-auto overflow-y-auto bg-card border border-border/50 text-sm shadow-sm h-[calc(100vh-14rem)]">
      <table class="w-full text-left border-collapse whitespace-nowrap">
        <thead class="bg-muted/95 backdrop-blur text-muted-foreground text-[10px] font-bold uppercase tracking-wider ring-1 ring-border/5 sticky top-0 z-20">
          <tr>
            <th class="p-2.5 w-10 text-center"><input type="checkbox" class="rounded border-border text-primary cursor-pointer" /></th>
            <th class="p-2.5 min-w-[200px]">Name</th>
            <th class="p-2.5 min-w-[140px]">Stage</th>
            <th class="p-2.5 min-w-[160px]">Estimated project duration</th>
            <th class="p-2.5 min-w-[120px]">Total estimate</th>
            <th class="p-2.5 min-w-[140px]">Assigned To</th>
            <th class="p-2.5 min-w-[140px] text-center">Total Tracked Views</th>
            <th class="p-2.5 min-w-[140px]">Estimate sent on</th>
            <th class="p-2.5 min-w-[250px]">Notes</th>
            <th class="p-2.5 min-w-[140px]">inital contact date</th>
            <th class="p-2.5 min-w-[160px]">last Follow up sent on</th>
            <th class="p-2.5 min-w-[140px]">date approved</th>
            <th class="p-2.5 min-w-[160px]">Project assigned to:</th>
            <th class="p-2.5 min-w-[140px]">wood order date</th>
          </tr>
        </thead>
        <tbody v-if="isLoading">
          <tr v-for="i in 5" :key="i">
            <td colspan="14" class="p-4">
              <div class="h-6 bg-muted/40 rounded animate-pulse"></div>
            </td>
          </tr>
        </tbody>
        <tbody v-else v-for="g in groupedCustomers" :key="g.stage.id" class="border-b-4 border-border/20 last:border-0 group/tbody">
          
          <!-- Stage Group Header -->
          <tr class="bg-muted/40 cursor-pointer hover:bg-muted/60 transition-colors" @click="expandedStages[g.stage.id] = !expandedStages[g.stage.id]">
            <td colspan="14" class="p-1 border-l-[6px]" :class="g.stage.border">
              <div class="flex items-center gap-2 px-2 py-1.5">
                <button type="button" class="flex items-center justify-center size-5 rounded hover:bg-background/80 transition-colors">
                  <Icon :name="expandedStages[g.stage.id] ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" class="size-4 text-muted-foreground" />
                </button>
                <div class="px-2 py-[3px] rounded text-[10px] uppercase font-bold tracking-wider inline-flex shadow-xs" :class="[g.stage.bg, g.stage.text]">
                  {{ g.stage.label }}
                </div>
                <button type="button" class="ml-1 flex items-center justify-center size-5 rounded-full hover:bg-background/80 transition-colors text-muted-foreground opacity-50 group-hover/tbody:opacity-100" title="Add Customer">
                  <Icon name="i-lucide-plus" class="size-3.5" />
                </button>
              </div>
            </td>
          </tr>

          <!-- Stage Group Items -->
          <template v-if="expandedStages[g.stage.id]">
            <tr v-for="c in g.items" :key="c._id" class="hover:bg-muted/10 border-b border-border/30 last:border-0 text-[13px] transition-colors group/row">
              <td class="p-2.5 text-center px-4">
                <input type="checkbox" class="rounded border-border text-primary cursor-pointer" />
              </td>
              <td class="p-2.5 font-semibold text-foreground/90 max-w-[200px] truncate cursor-pointer hover:text-primary transition-colors" @click="navigateTo(`/crm/customers/${c._id}`)">
                {{ c.name || `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Unknown' }}
              </td>
              <td class="p-2.5">
                <div class="inline-flex items-center gap-1.5 object-contain">
                  <Icon name="i-lucide-play" class="size-3" :class="g.stage.text === 'text-white' ? 'text-primary' : g.stage.text" />
                  <span class="text-xs font-medium">{{ c.stage || 'contact made' }}</span>
                </div>
              </td>
              <td class="p-2.5 text-muted-foreground">{{ c.estimatedProjectDuration || '' }}</td>
              <td class="p-2.5 tabular-nums font-medium text-foreground/80">{{ formatCurrency(c.totalEstimate) }}</td>
              <td class="p-2.5">
                <div class="flex items-center gap-2" v-if="c.assignedTo">
                  <div class="flex-shrink-0 size-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold uppercase text-primary border border-primary/20">
                    {{ c.assignedTo.substring(0, 1) }}
                  </div>
                  <span class="text-xs">{{ c.assignedTo }}</span>
                </div>
              </td>
              <td class="p-2.5 tabular-nums text-center text-muted-foreground">{{ c.totalTrackedViews || 0 }}</td>
              <td class="p-2.5 tabular-nums text-muted-foreground">{{ formatShortDate(c.estimateSentOn) }}</td>
              <td class="p-2.5 max-w-[250px] truncate text-muted-foreground text-xs" :title="c.notes">{{ c.notes || '' }}</td>
              <td class="p-2.5 tabular-nums text-muted-foreground">{{ formatShortDate(c.initialContactDate) }}</td>
              <td class="p-2.5 tabular-nums text-muted-foreground">{{ formatShortDate(c.lastFollowUpSentOn) }}</td>
              <td class="p-2.5 tabular-nums text-muted-foreground">{{ formatShortDate(c.dateApproved) }}</td>
              <td class="p-2.5 text-muted-foreground">{{ c.projectAssignedTo || '' }}</td>
              <td class="p-2.5 tabular-nums text-muted-foreground">{{ formatShortDate(c.woodOrderDate) }}</td>
            </tr>
            <tr v-if="g.items.length === 0">
              <td colspan="14" class="p-4 py-6 text-center text-muted-foreground text-[11px] font-medium bg-muted/5 border-b border-border/30">
                No customers in "{{ g.stage.label }}"
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
</style>
