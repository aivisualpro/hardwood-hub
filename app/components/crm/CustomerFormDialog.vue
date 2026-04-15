<script setup lang="ts">
import { toast } from 'vue-sonner'

const props = defineProps<{
  modelValue: boolean
  customer?: any
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'saved', customer: any): void
}>()

const form = ref({
  name: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  zip: '',
  notes: '',
  stage: '',
  estimatedProjectDuration: '',
  totalEstimate: undefined as number | undefined,
  assignedTo: '',
  totalTrackedViews: 0,
  estimateSentOn: '',
  initialContactDate: '',
  lastFollowUpSentOn: '',
  dateApproved: '',
  projectAssignedTo: '',
  woodOrderDate: '',
  tags: '',
})

const isLoading = ref(false)

watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    if (props.customer) {
      form.value = { 
        name: props.customer.name || '',
        firstName: props.customer.firstName || '',
        lastName: props.customer.lastName || '',
        email: props.customer.email || '',
        phone: props.customer.phone || '',
        address: props.customer.address || '',
        city: props.customer.city || '',
        state: props.customer.state || '',
        zip: props.customer.zip || '',
        notes: props.customer.notes || '',
        stage: props.customer.stage || '',
        estimatedProjectDuration: props.customer.estimatedProjectDuration || '',
        totalEstimate: props.customer.totalEstimate || undefined,
        assignedTo: props.customer.assignedTo || '',
        totalTrackedViews: props.customer.totalTrackedViews || 0,
        estimateSentOn: props.customer.estimateSentOn ? (new Date(props.customer.estimateSentOn).toISOString().split('T')[0] || '') : '',
        initialContactDate: props.customer.initialContactDate ? (new Date(props.customer.initialContactDate).toISOString().split('T')[0] || '') : '',
        lastFollowUpSentOn: props.customer.lastFollowUpSentOn ? (new Date(props.customer.lastFollowUpSentOn).toISOString().split('T')[0] || '') : '',
        dateApproved: props.customer.dateApproved ? (new Date(props.customer.dateApproved).toISOString().split('T')[0] || '') : '',
        projectAssignedTo: props.customer.projectAssignedTo || '',
        woodOrderDate: props.customer.woodOrderDate ? (new Date(props.customer.woodOrderDate).toISOString().split('T')[0] || '') : '',
        tags: (props.customer.tags || []).join(', '),
      }
    } else {
      form.value = {
        name: '',
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        zip: '',
        notes: '',
        stage: '',
        estimatedProjectDuration: '',
        totalEstimate: undefined,
        assignedTo: '',
        totalTrackedViews: 0,
        estimateSentOn: '',
        initialContactDate: '',
        lastFollowUpSentOn: '',
        dateApproved: '',
        projectAssignedTo: '',
        woodOrderDate: '',
        tags: '',
      }
    }
  }
})

async function submit() {
  if (!form.value.firstName.trim() && !form.value.name.trim()) {
    toast?.error?.('Please enter a First Name or Company Name')
    return
  }
  
  isLoading.value = true
  try {
    const url = props.customer ? `/api/customers/${props.customer._id}` : '/api/customers'
    const method = props.customer ? 'PUT' : 'POST'
    
    const nameParts = form.value.name ? form.value.name.split(' ') : []
    const fallbackFirstName = nameParts[0] || ''
    const fallbackLastName = nameParts.slice(1).join(' ') || ''

    const payload = {
      ...form.value,
      firstName: form.value.firstName || fallbackFirstName,
      lastName: form.value.lastName || fallbackLastName,
      tags: form.value.tags ? form.value.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
      estimateSentOn: form.value.estimateSentOn || null,
      initialContactDate: form.value.initialContactDate || null,
      lastFollowUpSentOn: form.value.lastFollowUpSentOn || null,
      dateApproved: form.value.dateApproved || null,
      woodOrderDate: form.value.woodOrderDate || null,
      totalEstimate: form.value.totalEstimate ? Number(form.value.totalEstimate) : null,
      totalTrackedViews: form.value.totalTrackedViews ? Number(form.value.totalTrackedViews) : 0,
    }
    
    if (!payload.name) {
      payload.name = `${payload.firstName} ${payload.lastName}`.trim()
    }
    
    const res = await $fetch<any>(url, {
      method,
      body: payload
    })
    
    if (res.success) {
      emit('saved', res.data)
      emit('update:modelValue', false)
      toast.success('Customer saved successfully')
    } else {
      toast.error(res.message || 'Failed to save customer')
    }
  } catch (e: any) {
    console.error(e)
    toast.error(e?.data?.message || e?.message || 'An error occurred while saving')
  } finally {
    isLoading.value = false
  }
}

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

function normalizeStage(stageStr: string): string {
  if (!stageStr) return ''
  let s = stageStr.trim().toLowerCase()
  s = s.replace('neads', 'needs')
  s = s.replace(/needs estimate\s*$/, 'needs estimate')
  return s
}

const activeDropdown = ref<string | null>(null)
const stageSearch = ref('')
const stageSearchInput = ref<HTMLInputElement | null>(null)

const employeeSearch = ref('')
const employeeSearchInput = ref<HTMLInputElement | null>(null)

watch(activeDropdown, (val) => {
  if (val === 'stage') {
    stageSearch.value = ''
    setTimeout(() => {
      stageSearchInput.value && stageSearchInput.value.focus()
    }, 50)
  }
  if (val === 'projectAssignedTo') {
    employeeSearch.value = ''
    setTimeout(() => {
      employeeSearchInput.value && employeeSearchInput.value.focus()
    }, 50)
  }
})

const filteredStageOptions = computed(() => {
  let all = [...STAGES]
  if (form.value.stage) {
     const exactVal = form.value.stage.trim()
     const found = all.find(x => normalizeStage(x.id) === normalizeStage(exactVal))
     if (!found && exactVal) {
        all.push({ id: exactVal, label: exactVal, bg: 'bg-muted/80', text: 'text-foreground', border: 'border-border' })
     }
  }
  if (!stageSearch.value) return all
  const sub = stageSearch.value.toLowerCase()
  return all.filter(s => s.label.toLowerCase().includes(sub))
})

function handleStageSelect(newStage: string) {
  if (!newStage.trim()) return
  form.value.stage = newStage.trim()
  activeDropdown.value = null
}

function getStageClasses(stageName: string) {
  if (!stageName) return 'bg-muted text-muted-foreground border-border'
  const norm = normalizeStage(stageName)
  const found = STAGES.find(s => normalizeStage(s.id) === norm)
  if (found) return `${found.bg} ${found.text} border ${found.border}`
  return 'bg-muted/80 text-foreground border-border'
}

const { data: employeesRes } = await useFetch<any>('/api/employees')
const employeesData = computed(() => employeesRes.value?.data || [])

const filteredEmployees = computed(() => {
  if (!employeeSearch.value) return employeesData.value
  const s = employeeSearch.value.toLowerCase()
  return employeesData.value.filter((e: any) => e.employee.toLowerCase().includes(s))
})

function getSelectedEmployees() {
  if (!form.value.projectAssignedTo) return []
  return form.value.projectAssignedTo.split(',').map((s: string) => s.trim()).filter(Boolean)
}

function isSelectedEmployee(emp: string) {
  return getSelectedEmployees().includes(emp)
}

function toggleEmployee(emp: string) {
  const selected = getSelectedEmployees()
  if (selected.includes(emp)) {
    form.value.projectAssignedTo = selected.filter(x => x !== emp).join(', ')
  } else {
    selected.push(emp)
    form.value.projectAssignedTo = selected.join(', ')
  }
}
</script>

<template>
  <Dialog :open="modelValue" @update:open="emit('update:modelValue', $event)">
    <DialogContent class="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>{{ customer ? 'Edit Customer' : 'New Customer' }}</DialogTitle>
        <DialogDescription>
          {{ customer ? 'Update the details for this customer below.' : 'Fill in the details below to create a new customer.' }}
        </DialogDescription>
      </DialogHeader>
      
      <form @submit.prevent="submit" class="space-y-4 py-4 max-h-[75vh] overflow-y-auto px-2">
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2 col-span-2">
            <Label>Company / Display Name</Label>
            <Input v-model="form.name" placeholder="Acme Corp" />
          </div>
          
          <div class="space-y-2">
            <Label>First Name <span class="text-destructive">*</span></Label>
            <Input v-model="form.firstName" placeholder="John" required />
          </div>
          
          <div class="space-y-2">
            <Label>Last Name</Label>
            <Input v-model="form.lastName" placeholder="Doe" />
          </div>

          <div class="space-y-2">
            <Label>Email</Label>
            <Input v-model="form.email" type="email" placeholder="john@example.com" />
          </div>
          
          <div class="space-y-2">
            <Label>Phone</Label>
            <Input v-model="form.phone" placeholder="(555) 555-5555" />
          </div>

          <div class="space-y-2 relative" :class="activeDropdown === 'stage' ? 'z-50' : ''">
            <Label>Stage</Label>
            <div class="relative">
              <button type="button" @click.stop="activeDropdown = activeDropdown === 'stage' ? null : 'stage'" class="w-full flex items-center justify-between px-3 py-2 rounded-md border border-input bg-background hover:bg-muted/50 transition-colors shadow-sm text-sm focus:outline-none focus:ring-1 focus:ring-primary h-9">
                <div class="flex items-center gap-2">
                  <div class="size-2 rounded-full ring-1 ring-border shadow-xs" :class="getStageClasses(form.stage)" />
                  <span :class="form.stage ? 'text-foreground font-bold uppercase tracking-wider text-[10px]' : 'text-muted-foreground'">{{ form.stage || 'Select stage...' }}</span>
                </div>
                <Icon name="i-lucide-chevron-down" class="size-4 opacity-50" />
              </button>
              
              <div v-if="activeDropdown === 'stage'" class="fixed inset-0 z-40" @click.stop="activeDropdown = null" />
              <div v-if="activeDropdown === 'stage'" class="absolute left-0 mt-1 top-full w-full bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-xl shadow-primary/5 z-50 flex flex-col ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 duration-150">
                 <div class="p-2 border-b border-border/50">
                   <input ref="stageSearchInput" type="text" v-model="stageSearch" placeholder="Search or add fresh..." class="w-full bg-background border border-border/50 rounded filter-none px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary" @click.stop @keydown.enter.prevent="handleStageSelect(stageSearch)" />
                 </div>
                 <div class="max-h-[200px] overflow-y-auto py-1.5">
                    <button type="button" v-for="st in filteredStageOptions" :key="st.id" @click.stop="handleStageSelect(st.id)" class="w-full text-left px-3 py-2 text-[11px] font-bold uppercase tracking-wider hover:bg-muted/60 transition-colors flex items-center gap-2">
                       <div class="size-2 rounded-full shadow-inner ring-1 ring-border" :class="st.bg" />
                       <span class="truncate">{{ st.label }}</span>
                    </button>
                    <button type="button" v-if="stageSearch && !filteredStageOptions.find(s => s.id.toLowerCase() === stageSearch.toLowerCase())" @click.stop="handleStageSelect(stageSearch)" class="w-full text-left px-3 py-2 text-sm hover:bg-primary/10 text-primary transition-colors flex items-center gap-2 font-bold whitespace-nowrap">
                       <Icon name="i-lucide-plus" class="size-4 shrink-0" />
                       <span class="truncate">Add "{{ stageSearch }}"</span>
                    </button>
                 </div>
              </div>
            </div>
          </div>
          
          <div class="space-y-2 col-span-2 sm:col-span-1 relative" :class="activeDropdown === 'projectAssignedTo' ? 'z-50' : ''">
            <Label>Project Assigned To</Label>
            <div class="relative">
              <button type="button" @click.stop="activeDropdown = activeDropdown === 'projectAssignedTo' ? null : 'projectAssignedTo'" class="w-full flex items-center justify-between px-3 py-2 rounded-md border border-input bg-background hover:bg-muted/50 transition-colors shadow-sm text-sm focus:outline-none focus:ring-1 focus:ring-primary min-h-[36px] h-auto">
                <div class="flex items-center gap-2 flex-wrap">
                  <span v-if="!form.projectAssignedTo" class="text-muted-foreground">Select assignees...</span>
                  <template v-else>
                    <span v-for="emp in getSelectedEmployees()" :key="emp" class="text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20">{{ emp }}</span>
                  </template>
                </div>
                <Icon name="i-lucide-users" class="size-4 opacity-50 shrink-0" />
              </button>
              
              <div v-if="activeDropdown === 'projectAssignedTo'" class="fixed inset-0 z-40" @click.stop="activeDropdown = null" />
              <div v-if="activeDropdown === 'projectAssignedTo'" class="absolute left-0 mt-1 top-full w-full bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-xl shadow-primary/5 z-50 flex flex-col ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 duration-150">
                 <div class="p-2 border-b border-border/50">
                   <input ref="employeeSearchInput" type="text" v-model="employeeSearch" placeholder="Search employees..." class="w-full bg-background border border-border/50 rounded filter-none px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary" @click.stop />
                 </div>
                 <div class="max-h-[200px] overflow-y-auto py-1.5">
                    <button type="button" v-for="emp in filteredEmployees" :key="emp.employee" @click.stop="toggleEmployee(emp.employee)" class="w-full text-left px-3 py-2 text-sm hover:bg-muted/60 transition-colors flex items-center justify-between gap-2">
                       <span class="truncate" :class="isSelectedEmployee(emp.employee) ? 'font-bold text-primary' : ''">{{ emp.employee }}</span>
                       <Icon v-if="isSelectedEmployee(emp.employee)" name="i-lucide-check" class="size-4 text-primary shrink-0" />
                    </button>
                    <div v-if="!filteredEmployees.length" class="px-3 py-2 text-xs text-muted-foreground text-center">No employees found.</div>
                 </div>
              </div>
            </div>
          </div>
          
          <div class="space-y-2">
            <Label>Estim. Project Duration</Label>
            <Input v-model="form.estimatedProjectDuration" placeholder="e.g. 3 weeks" />
          </div>
          
          <div class="space-y-2">
            <Label>Total Estimate ($)</Label>
            <Input v-model="form.totalEstimate" type="number" step="0.01" placeholder="10000" />
          </div>
          
          <div class="space-y-2">
            <Label>Total Tracked Views</Label>
            <Input v-model="form.totalTrackedViews" type="number" placeholder="0" />
          </div>

          <div class="space-y-2">
            <Label>Initial Contact Date</Label>
            <Input v-model="form.initialContactDate" type="date" />
          </div>
          
          <div class="space-y-2">
            <Label>Last Follow Up Date</Label>
            <Input v-model="form.lastFollowUpSentOn" type="date" />
          </div>
          
          <div class="space-y-2">
            <Label>Estimate Sent On</Label>
            <Input v-model="form.estimateSentOn" type="date" />
          </div>
          
          <div class="space-y-2">
            <Label>Date Approved</Label>
            <Input v-model="form.dateApproved" type="date" />
          </div>
          
          <div class="space-y-2">
            <Label>Wood Order Date</Label>
            <Input v-model="form.woodOrderDate" type="date" />
          </div>

          <div class="space-y-2 col-span-2">
            <Label>Tags (comma separated)</Label>
            <Input v-model="form.tags" placeholder="VIP, Flooring, Urgent" />
          </div>
          
          <div class="space-y-2 col-span-2">
            <Label>Address</Label>
            <Input v-model="form.address" placeholder="123 Main St" />
          </div>
          
          <div class="space-y-2">
            <Label>City</Label>
            <Input v-model="form.city" placeholder="Anytown" />
          </div>
          
          <div class="grid grid-cols-2 gap-2 space-y-0">
            <div class="space-y-2">
              <Label>State</Label>
              <Input v-model="form.state" placeholder="NY" />
            </div>
            <div class="space-y-2">
              <Label>ZIP</Label>
              <Input v-model="form.zip" placeholder="10001" />
            </div>
          </div>
          
          <div class="space-y-2 col-span-2">
            <Label>Notes</Label>
            <Textarea v-model="form.notes" placeholder="Additional details..." rows="3" />
          </div>
        </div>
        
        <DialogFooter class="mt-4">
          <button type="button" class="px-4 py-2 text-sm font-medium border rounded-md" @click="emit('update:modelValue', false)">Cancel</button>
          <button type="submit" :disabled="isLoading" class="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-md disabled:opacity-50">
            {{ isLoading ? 'Saving...' : 'Save' }}
          </button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
