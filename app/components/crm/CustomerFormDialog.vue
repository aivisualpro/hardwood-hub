<script setup lang="ts">
import { toast } from 'vue-sonner'

const props = defineProps<{
  modelValue: boolean
  customer?: any
  apiPrefix?: string
}>()

// When editing from customer detail page, hide project-specific fields
const isCustomerMode = computed(() => props.apiPrefix === '/api/customers')

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'saved', customer: any): void
}>()

const form = ref({
  customerId: '' as string,
  name: '',
  projectName: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  zip: '',
  notes: '',
  status: '' as string,
  estimatedProjectDuration: '',
  totalEstimate: undefined as number | undefined,
  laborSandingTotal: undefined as number | undefined,
  assignedTo: '',
  totalTrackedViews: 0,
  estimateSentOn: '',
  initialContactDate: '',
  lastFollowUpSentOn: '',
  dateApproved: '',
  projectAssignedTo: '',
  woodOrderDate: '',
  tags: '',
  contactIds: [] as string[],
})

const isLoading = ref(false)

function toNamesString(val: any): string {
  if (!val) return ''
  if (typeof val === 'string') return val
  if (Array.isArray(val)) {
    return val.map((item: any) => {
      if (!item) return ''
      if (typeof item === 'object') {
        return item.employee || item.name || ''
      }
      const found = employeesData.value.find((e: any) => String(e._id) === String(item))
      return found ? found.employee : ''
    }).filter(Boolean).join(', ')
  }
  return ''
}

function toObjectIdArray(val: string): string[] {
  if (!val) return []
  return val.split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(name => {
      const found = employeesData.value.find((e: any) => 
        e.employee.toLowerCase() === name.toLowerCase() || 
        String(e._id) === name
      )
      return found ? String(found._id) : null
    })
    .filter((id): id is string => !!id)
}

watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    // Refresh customer list to ensure all records are available
    refreshCustomers()

    if (props.customer) {
      form.value = {
        customerId: props.customer.customerId || '',
        name: props.customer.name || '',
        projectName: props.customer.projectName || '',
        firstName: props.customer.firstName || '',
        lastName: props.customer.lastName || '',
        email: props.customer.email || '',
        phone: props.customer.phone || '',
        address: props.customer.address || '',
        city: props.customer.city || '',
        state: props.customer.state || '',
        zip: props.customer.zip || '',
        notes: props.customer.notes || '',
        status: props.customer.status ? String(props.customer.status) : '',
        estimatedProjectDuration: props.customer.estimatedProjectDuration || '',
        totalEstimate: props.customer.totalEstimate || undefined,
        laborSandingTotal: props.customer.laborSandingTotal || undefined,
        assignedTo: toNamesString(props.customer.assignedTo),
        totalTrackedViews: props.customer.totalTrackedViews || 0,
        estimateSentOn: props.customer.estimateSentOn ? (new Date(props.customer.estimateSentOn).toISOString().split('T')[0] || '') : '',
        initialContactDate: props.customer.initialContactDate ? (new Date(props.customer.initialContactDate).toISOString().split('T')[0] || '') : '',
        lastFollowUpSentOn: props.customer.lastFollowUpSentOn ? (new Date(props.customer.lastFollowUpSentOn).toISOString().split('T')[0] || '') : '',
        dateApproved: props.customer.dateApproved ? (new Date(props.customer.dateApproved).toISOString().split('T')[0] || '') : '',
        projectAssignedTo: toNamesString(props.customer.projectAssignedTo),
        woodOrderDate: props.customer.woodOrderDate ? (new Date(props.customer.woodOrderDate).toISOString().split('T')[0] || '') : '',
        tags: (props.customer.tags || []).join(', '),
        contactIds: (props.customer.contactIds || []).map((id: any) => String(id)),
      }
    }
    else {
      form.value = {
        customerId: '',
        name: '',
        projectName: '',
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        zip: '',
        notes: '',
        status: '',
        estimatedProjectDuration: '',
        totalEstimate: undefined,
        laborSandingTotal: undefined,
        assignedTo: '',
        totalTrackedViews: 0,
        estimateSentOn: '',
        initialContactDate: '',
        lastFollowUpSentOn: '',
        dateApproved: '',
        projectAssignedTo: '',
        woodOrderDate: '',
        tags: '',
        contactIds: [],
      }
    }
  }
})

async function submit() {
  if (!form.value.name.trim()) {
    toast?.error?.('Please select a customer')
    return
  }

  isLoading.value = true
  try {
    const base = props.apiPrefix || '/api/pipeline'
    const isEditing = !!props.customer?._id
    const url = isEditing ? `${base}/${props.customer._id}` : base
    const method = isEditing ? 'PUT' : 'POST'

    const nameParts = form.value.name ? form.value.name.split(' ') : []
    const fallbackFirstName = nameParts[0] || ''
    const fallbackLastName = nameParts.slice(1).join(' ') || ''

    const payload: any = {
      ...form.value,
      customerId: form.value.customerId || null,
      customerName: form.value.name || '',
      firstName: form.value.firstName || fallbackFirstName,
      lastName: form.value.lastName || fallbackLastName,
      tags: form.value.tags ? form.value.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
      estimateSentOn: form.value.estimateSentOn || null,
      initialContactDate: form.value.initialContactDate || null,
      lastFollowUpSentOn: form.value.lastFollowUpSentOn || null,
      dateApproved: form.value.dateApproved || null,
      woodOrderDate: form.value.woodOrderDate || null,
      totalEstimate: form.value.totalEstimate ? Number(form.value.totalEstimate) : null,
      laborSandingTotal: form.value.laborSandingTotal ? Number(form.value.laborSandingTotal) : null,
      totalTrackedViews: form.value.totalTrackedViews ? Number(form.value.totalTrackedViews) : 0,
    }

    if (!isCustomerMode.value) {
      payload.assignedTo = toObjectIdArray(form.value.assignedTo)
      payload.projectAssignedTo = toObjectIdArray(form.value.projectAssignedTo)
    }

    if (!payload.name) {
      payload.name = `${payload.firstName} ${payload.lastName}`.trim()
    }

    const res = await $fetch<any>(url, {
      method,
      body: payload,
    })

    if (res.success) {
      emit('saved', res.data)
      emit('update:modelValue', false)
      toast.success('Project saved successfully')
    }
    else {
      toast.error(res.message || 'Failed to save customer')
    }
  }
  catch (e: any) {
    console.error(e)
    toast.error(e?.data?.message || e?.message || 'An error occurred while saving')
  }
  finally {
    isLoading.value = false
  }
}

// ─── Dynamic Status dropdown (same as pipeline detail) ────
interface StatusOption { _id: string, label: string, value: string, color: string, icon: string, order: number }
const statusDropdownOptions = ref<StatusOption[]>([])

const { data: statusDropdownRes } = await useFetch<any>('/api/dropdowns?name=Customer Status', {
  key: 'customer-status-dropdown-form',
})
watch(statusDropdownRes, (val) => {
  if (val?.data?.options) statusDropdownOptions.value = val.data.options
  else if (val?.data && Array.isArray(val.data)) {
    const match = val.data.find((dd: any) => dd.name === 'Customer Status')
    if (match?.options) statusDropdownOptions.value = match.options
  }
}, { immediate: true })

const statusMap = computed(() => {
  const m = new Map<string, StatusOption>()
  for (const o of statusDropdownOptions.value) m.set(String(o._id), o)
  return m
})

// Build status options from the dropdown
const statusSelectOptions = computed(() => {
  return statusDropdownOptions.value.map(o => ({
    id: String(o._id),
    label: o.label,
    color: o.color || '#6366f1',
  }))
})

// Resolve current status display
const currentStatusDisplay = computed(() => {
  if (form.value.status) {
    const opt = statusMap.value.get(form.value.status)
    if (opt) return { label: opt.label, color: opt.color }
  }
  return null
})

const activeDropdown = ref<string | null>(null)
const stageSearch = ref('')
const stageSearchInput = ref<HTMLInputElement | null>(null)

const employeeSearch = ref('')
const employeeSearchInput = ref<HTMLInputElement | null>(null)

watch(activeDropdown, (val) => {
  if (val === 'status') {
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
  if (val === 'customer') {
    customerSearch.value = ''
    setTimeout(() => {
      customerSearchInput.value && customerSearchInput.value.focus()
    }, 50)
  }
  if (val === 'contact') {
    contactSearch.value = ''
    showAddContactForm.value = false
    setTimeout(() => {
      contactSearchInput.value && contactSearchInput.value.focus()
    }, 50)
  }
})

const filteredStatusOptions = computed(() => {
  let all = [...statusSelectOptions.value]
  // If current status doesn't match any option, add it
  if (form.value.status) {
    const found = all.find(x => x.id === form.value.status)
    if (!found && currentStatusDisplay.value) {
      all.push({ id: form.value.status, label: currentStatusDisplay.value.label, color: currentStatusDisplay.value.color || '' })
    }
  }
  if (!stageSearch.value)
    return all
  const sub = stageSearch.value.toLowerCase()
  return all.filter(s => s.label.toLowerCase().includes(sub))
})

function handleStatusSelect(optionId: string) {
  if (!optionId.trim())
    return
  form.value.status = optionId
  activeDropdown.value = null
}

const { data: employeesRes } = await useFetch<any>('/api/employees')
const employeesData = computed(() => employeesRes.value?.data || [])

// ─── Customer dropdown ────────────────────────────────────
const { data: customersRes, refresh: refreshCustomers } = await useFetch<any>('/api/customers', {
  key: 'all-customers-dropdown',
  params: { limit: 0 },
})
const allCustomers = computed(() => customersRes.value?.data || [])
const customerSearch = ref('')
const customerSearchInput = ref<HTMLInputElement | null>(null)

const filteredCustomers = computed(() => {
  if (!customerSearch.value) return allCustomers.value
  const s = customerSearch.value.toLowerCase()
  return allCustomers.value.filter((c: any) =>
    (c.name || '').toLowerCase().includes(s)
    || (c.firstName || '').toLowerCase().includes(s)
    || (c.lastName || '').toLowerCase().includes(s)
    || (c.email || '').toLowerCase().includes(s),
  )
})

function selectCustomer(cust: any) {
  form.value.customerId = cust._id
  form.value.name = cust.name || `${cust.firstName || ''} ${cust.lastName || ''}`.trim()
  form.value.firstName = cust.firstName || ''
  form.value.lastName = cust.lastName || ''
  form.value.email = cust.email || ''
  form.value.phone = cust.phone || ''
  form.value.address = cust.address || ''
  form.value.city = cust.city || ''
  form.value.state = cust.state || ''
  form.value.zip = cust.zip || ''
  form.value.contactIds = []
  activeDropdown.value = null
}

// ─── Related Contact from selected customer ────────────────
const selectedCustomerObj = computed(() => {
  if (!form.value.customerId) return null
  return allCustomers.value.find((c: any) => c._id === form.value.customerId) || null
})

const selectedCustomerContacts = computed(() => {
  return (selectedCustomerObj.value?.relatedContacts || []) as any[]
})

const contactSearch = ref('')
const contactSearchInput = ref<HTMLInputElement | null>(null)
const showAddContactForm = ref(false)
const addContactLoading = ref(false)

const newContactForm = ref({
  firstName: '',
  lastName: '',
  title: '',
  emails: [''],
  phones: [''],
})

const filteredContacts = computed(() => {
  if (!contactSearch.value) return selectedCustomerContacts.value
  const s = contactSearch.value.toLowerCase()
  return selectedCustomerContacts.value.filter((rc: any) => {
    const name = `${rc.firstName || ''} ${rc.lastName || ''}`.toLowerCase()
    return name.includes(s) || (rc.title || '').toLowerCase().includes(s)
  })
})

function getContactId(rc: any): string {
  return rc._id ? String(rc._id) : ''
}

function getContactLabel(rc: any): string {
  return `${rc.firstName || ''} ${rc.lastName || ''}`.trim()
}

function toggleContact(rc: any) {
  const id = getContactId(rc)
  if (!id) return
  const idx = form.value.contactIds.indexOf(id)
  if (idx >= 0) {
    form.value.contactIds.splice(idx, 1)
  } else {
    form.value.contactIds.push(id)
  }
}

function isContactSelected(rc: any): boolean {
  return form.value.contactIds.includes(getContactId(rc))
}

function getSelectedContactNames(): string {
  return form.value.contactIds.map(id => {
    const rc = selectedCustomerContacts.value.find((c: any) => String(c._id) === id)
    return rc ? getContactLabel(rc) : ''
  }).filter(Boolean).join(', ')
}

function clearContacts() {
  form.value.contactIds = []
}

function openAddContactForm() {
  newContactForm.value = { firstName: '', lastName: '', title: '', emails: [''], phones: [''] }
  showAddContactForm.value = true
}

async function saveNewContact() {
  if (!newContactForm.value.firstName.trim()) {
    toast?.error?.('First name is required')
    return
  }
  addContactLoading.value = true
  try {
    const updatedContacts = [...selectedCustomerContacts.value, {
      firstName: newContactForm.value.firstName.trim(),
      lastName: newContactForm.value.lastName.trim(),
      title: newContactForm.value.title.trim(),
      emails: newContactForm.value.emails.filter(e => e.trim()),
      phones: newContactForm.value.phones.filter(p => p.trim()),
    }]

    const res = await $fetch<any>(`/api/customers/${form.value.customerId}`, {
      method: 'PUT',
      body: { relatedContacts: updatedContacts },
    })

    if (res.success) {
      toast.success('Contact added')
      const custIdx = allCustomers.value.findIndex((c: any) => c._id === form.value.customerId)
      if (custIdx !== -1 && res.data?.relatedContacts) {
        allCustomers.value[custIdx].relatedContacts = res.data.relatedContacts
      }
      // Auto-select the newly added contact by finding its new _id
      const newContacts = res.data?.relatedContacts || []
      const lastContact = newContacts[newContacts.length - 1]
      if (lastContact?._id) {
        form.value.contactIds.push(String(lastContact._id))
      }
      showAddContactForm.value = false
    } else {
      toast.error('Failed to add contact')
    }
  } catch {
    toast.error('Error adding contact')
  } finally {
    addContactLoading.value = false
  }
}

function clearCustomer() {
  form.value.customerId = ''
  form.value.name = ''
  form.value.firstName = ''
  form.value.lastName = ''
  form.value.email = ''
  form.value.phone = ''
  form.value.address = ''
  form.value.city = ''
  form.value.state = ''
  form.value.zip = ''
  form.value.contactIds = []
}

const filteredEmployees = computed(() => {
  if (!employeeSearch.value)
    return employeesData.value
  const s = employeeSearch.value.toLowerCase()
  return employeesData.value.filter((e: any) => e.employee.toLowerCase().includes(s))
})

// ── Crew (projectAssignedTo) helpers ──────────────────────────────────────────
function getSelectedEmployees() {
  if (!form.value.projectAssignedTo)
    return []
  return form.value.projectAssignedTo.split(',').map((s: string) => s.trim()).filter(Boolean)
}

function isSelectedEmployee(emp: string) {
  return getSelectedEmployees().includes(emp)
}

function toggleEmployee(emp: string) {
  const selected = getSelectedEmployees()
  if (selected.includes(emp)) {
    form.value.projectAssignedTo = selected.filter(x => x !== emp).join(', ')
  }
  else {
    selected.push(emp)
    form.value.projectAssignedTo = selected.join(', ')
  }
}

// ── Assigned To helpers ──────────────────────────────────────────────────────
function getSelectedAssignees() {
  if (!form.value.assignedTo)
    return []
  return form.value.assignedTo.split(',').map((s: string) => s.trim()).filter(Boolean)
}

function isSelectedAssignee(emp: string) {
  return getSelectedAssignees().includes(emp)
}

function toggleAssignee(emp: string) {
  const selected = getSelectedAssignees()
  if (selected.includes(emp)) {
    form.value.assignedTo = selected.filter(x => x !== emp).join(', ')
  }
  else {
    selected.push(emp)
    form.value.assignedTo = selected.join(', ')
  }
}
</script>

<template>
  <Dialog :open="modelValue" @update:open="emit('update:modelValue', $event)">
    <DialogContent class="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>{{ customer?._id ? (isCustomerMode ? 'Edit Client' : 'Edit Project') : 'Add Project' }}</DialogTitle>
        <DialogDescription>
          {{ customer?._id ? (isCustomerMode ? 'Update the client details below.' : 'Update the details for this project below.') : 'Fill in the details below to create a new project.' }}
        </DialogDescription>
      </DialogHeader>

      <form autocomplete="off" class="space-y-4 py-4 max-h-[75vh] overflow-y-auto px-2" @submit.prevent="submit">
        <div class="grid grid-cols-2 gap-4">
          <!-- Customer field: text input in customer mode, dropdown in project mode -->
          <div v-if="isCustomerMode" class="space-y-2 col-span-2">
            <Label>Customer Name <span class="text-destructive">*</span></Label>
            <Input v-model="form.name" placeholder="Customer name" />
          </div>
          <div v-else class="space-y-2 col-span-2 relative" :class="activeDropdown === 'customer' ? 'z-50' : ''">
            <Label>Customer <span class="text-destructive">*</span></Label>
            <div class="relative">
              <button type="button" class="w-full flex items-center justify-between px-3 py-2 rounded-md border border-input bg-background hover:bg-muted/50 transition-colors shadow-sm text-sm focus:outline-none focus:ring-1 focus:ring-primary h-9" @click.stop="activeDropdown = activeDropdown === 'customer' ? null : 'customer'">
                <span :class="form.name ? 'text-foreground font-medium' : 'text-muted-foreground'">{{ form.name || 'Select customer...' }}</span>
                <div class="flex items-center gap-1">
                  <button v-if="form.customerId" type="button" class="size-5 rounded flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors" @click.stop="clearCustomer">
                    <Icon name="i-lucide-x" class="size-3" />
                  </button>
                  <Icon name="i-lucide-chevron-down" class="size-4 opacity-50" />
                </div>
              </button>

              <div v-if="activeDropdown === 'customer'" class="fixed inset-0 z-40" @click.stop="activeDropdown = null" />
              <div v-if="activeDropdown === 'customer'" class="absolute left-0 mt-1 top-full w-full bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-xl shadow-primary/5 z-50 flex flex-col ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 duration-150">
                <div class="p-2 border-b border-border/50">
                  <input ref="customerSearchInput" v-model="customerSearch" type="text" placeholder="Search customers..." class="w-full bg-background border border-border/50 rounded filter-none px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary" @click.stop>
                </div>
                <div class="max-h-[200px] overflow-y-auto py-1.5">
                  <button v-for="c in filteredCustomers" :key="c._id" type="button" class="w-full text-left px-3 py-2 text-sm hover:bg-muted/60 transition-colors flex items-center justify-between gap-2" @click.stop="selectCustomer(c)">
                    <div class="min-w-0">
                      <span class="block truncate font-medium" :class="form.customerId === c._id ? 'text-primary font-bold' : ''">{{ c.name || `${c.firstName || ''} ${c.lastName || ''}`.trim() }}</span>
                      <span v-if="c.email" class="block text-[10px] text-muted-foreground truncate">{{ c.email }}</span>
                    </div>
                    <Icon v-if="form.customerId === c._id" name="i-lucide-check" class="size-4 text-primary shrink-0" />
                  </button>
                  <div v-if="!filteredCustomers.length" class="px-3 py-2 text-xs text-muted-foreground text-center">
                    No customers found.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="!isCustomerMode" class="space-y-2 col-span-2">
            <Label>Project Name</Label>
            <Input v-model="form.projectName" placeholder="e.g. Kitchen Remodel" />
          </div>

          <!-- Related Contacts (multi-select, shown when a customer is selected) -->
          <div v-if="form.customerId" class="space-y-2 col-span-2 relative" :class="activeDropdown === 'contact' ? 'z-50' : ''">
            <Label>Related Contacts</Label>
            <div class="relative">
              <button type="button" class="w-full flex items-center justify-between px-3 py-2 rounded-md border border-input bg-background hover:bg-muted/50 transition-colors shadow-sm text-sm focus:outline-none focus:ring-1 focus:ring-primary min-h-[36px] h-auto" @click.stop="activeDropdown = activeDropdown === 'contact' ? null : 'contact'">
                <div class="flex items-center gap-2 flex-wrap">
                  <span v-if="!form.contactIds.length" class="text-muted-foreground">Select contacts...</span>
                  <template v-else>
                    <span v-for="cId in form.contactIds" :key="cId" class="text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20">
                      {{ selectedCustomerContacts.find((c: any) => String(c._id) === cId) ? getContactLabel(selectedCustomerContacts.find((c: any) => String(c._id) === cId)) : cId }}
                    </span>
                  </template>
                </div>
                <div class="flex items-center gap-1 shrink-0">
                  <button v-if="form.contactIds.length" type="button" class="size-5 rounded flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors" @click.stop="clearContacts">
                    <Icon name="i-lucide-x" class="size-3" />
                  </button>
                  <Icon name="i-lucide-chevron-down" class="size-4 opacity-50" />
                </div>
              </button>

              <div v-if="activeDropdown === 'contact'" class="fixed inset-0 z-40" @click.stop="activeDropdown = null" />
              <div v-if="activeDropdown === 'contact'" class="absolute left-0 mt-1 top-full w-full bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-xl shadow-primary/5 z-50 flex flex-col ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 duration-150">
                <!-- Search -->
                <div class="p-2 border-b border-border/50">
                  <input ref="contactSearchInput" v-model="contactSearch" type="text" placeholder="Search contacts..." class="w-full bg-background border border-border/50 rounded filter-none px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary" @click.stop>
                </div>

                <!-- Add New Contact inline form -->
                <div v-if="showAddContactForm" class="p-3 border-b border-border/50 space-y-2" @click.stop>
                  <div class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary mb-1">
                    <Icon name="i-lucide-user-plus" class="size-3.5" />
                    New Contact
                  </div>
                  <div class="grid grid-cols-2 gap-2">
                    <input v-model="newContactForm.firstName" type="text" placeholder="First Name *" class="w-full bg-background border border-border/50 rounded px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary">
                    <input v-model="newContactForm.lastName" type="text" placeholder="Last Name" class="w-full bg-background border border-border/50 rounded px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary">
                  </div>
                  <input v-model="newContactForm.title" type="text" placeholder="Title / Role" class="w-full bg-background border border-border/50 rounded px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary">
                  <input v-model="newContactForm.emails[0]" type="email" placeholder="Email" class="w-full bg-background border border-border/50 rounded px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary">
                  <input v-model="newContactForm.phones[0]" type="text" placeholder="Phone" class="w-full bg-background border border-border/50 rounded px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary">
                  <div class="flex items-center gap-2 pt-1">
                    <button type="button" :disabled="addContactLoading" class="px-3 py-1 text-xs font-semibold text-primary-foreground bg-primary rounded disabled:opacity-50" @click.stop="saveNewContact">
                      {{ addContactLoading ? 'Saving...' : 'Save Contact' }}
                    </button>
                    <button type="button" class="px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground" @click.stop="showAddContactForm = false">
                      Cancel
                    </button>
                  </div>
                </div>

                <!-- Contact list (multi-select checkboxes) -->
                <div class="max-h-[200px] overflow-y-auto py-1.5">
                  <button v-for="(rc, i) in filteredContacts" :key="i" type="button" class="w-full text-left px-3 py-2 text-sm hover:bg-muted/60 transition-colors flex items-center justify-between gap-2" @click.stop="toggleContact(rc)">
                    <div class="min-w-0 flex items-center gap-2">
                      <div class="size-4 rounded border shrink-0 flex items-center justify-center transition-colors" :class="isContactSelected(rc) ? 'bg-primary border-primary' : 'border-input'">
                        <Icon v-if="isContactSelected(rc)" name="i-lucide-check" class="size-3 text-primary-foreground" />
                      </div>
                      <div class="min-w-0">
                        <span class="block truncate font-medium" :class="isContactSelected(rc) ? 'text-primary' : ''">{{ getContactLabel(rc) }}</span>
                        <span v-if="rc.title" class="block text-[10px] text-muted-foreground truncate">{{ rc.title }}</span>
                      </div>
                    </div>
                  </button>
                  <div v-if="!filteredContacts.length && !showAddContactForm" class="px-3 py-2 text-xs text-muted-foreground text-center">
                    No contacts found.
                  </div>
                </div>

                <!-- Add New button -->
                <div v-if="!showAddContactForm" class="p-1.5 border-t border-border/50">
                  <button type="button" class="w-full text-left px-3 py-2 text-sm hover:bg-primary/10 text-primary transition-colors flex items-center gap-2 font-semibold rounded" @click.stop="openAddContactForm">
                    <Icon name="i-lucide-plus" class="size-4" />
                    Add New Contact
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div v-if="!isCustomerMode" class="space-y-2 relative" :class="activeDropdown === 'status' ? 'z-50' : ''">
            <Label>Status</Label>
            <div class="relative">
              <button type="button" class="w-full flex items-center justify-between px-3 py-2 rounded-md border border-input bg-background hover:bg-muted/50 transition-colors shadow-sm text-sm focus:outline-none focus:ring-1 focus:ring-primary h-9" @click.stop="activeDropdown = activeDropdown === 'status' ? null : 'status'">
                <div class="flex items-center gap-2">
                  <div
                    class="size-2 rounded-full ring-1 ring-border shadow-xs"
                    :style="currentStatusDisplay?.color ? { backgroundColor: currentStatusDisplay.color } : {}"
                  />
                  <span :class="currentStatusDisplay ? 'text-foreground font-bold uppercase tracking-wider text-[10px]' : 'text-muted-foreground'">{{ currentStatusDisplay?.label || 'Select status...' }}</span>
                </div>
                <Icon name="i-lucide-chevron-down" class="size-4 opacity-50" />
              </button>

              <div v-if="activeDropdown === 'status'" class="fixed inset-0 z-40" @click.stop="activeDropdown = null" />
              <div v-if="activeDropdown === 'status'" class="absolute left-0 mt-1 top-full w-full bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-xl shadow-primary/5 z-50 flex flex-col ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 duration-150">
                <div class="p-2 border-b border-border/50">
                  <input ref="stageSearchInput" v-model="stageSearch" type="text" placeholder="Search statuses..." class="w-full bg-background border border-border/50 rounded filter-none px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary" @click.stop>
                </div>
                <div class="max-h-[200px] overflow-y-auto py-1.5">
                  <button v-for="st in filteredStatusOptions" :key="st.id" type="button" class="w-full text-left px-3 py-2 text-[11px] font-bold uppercase tracking-wider hover:bg-muted/60 transition-colors flex items-center gap-2" @click.stop="handleStatusSelect(st.id)">
                    <div
                      class="size-2 rounded-full shadow-inner ring-1 ring-border"
                      :style="st.color ? { backgroundColor: st.color } : {}"
                    />
                    <span class="truncate" :class="form.status === st.id ? 'text-primary' : ''">{{ st.label }}</span>
                    <Icon v-if="form.status === st.id" name="i-lucide-check" class="size-3 text-primary ml-auto shrink-0" />
                  </button>
                  <div v-if="!filteredStatusOptions.length" class="px-3 py-2 text-xs text-muted-foreground text-center">
                    No statuses found.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="!isCustomerMode" class="space-y-2 col-span-2 sm:col-span-1 relative" :class="activeDropdown === 'assignedTo' ? 'z-50' : ''">
            <Label>Assigned To</Label>
            <div class="relative">
              <button type="button" class="w-full flex items-center justify-between px-3 py-2 rounded-md border border-input bg-background hover:bg-muted/50 transition-colors shadow-sm text-sm focus:outline-none focus:ring-1 focus:ring-primary min-h-[36px] h-auto" @click.stop="activeDropdown = activeDropdown === 'assignedTo' ? null : 'assignedTo'">
                <div class="flex items-center gap-2 flex-wrap">
                  <span v-if="!form.assignedTo" class="text-muted-foreground">Select assignee...</span>
                  <template v-else>
                    <span v-for="emp in getSelectedAssignees()" :key="emp" class="text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20">{{ emp }}</span>
                  </template>
                </div>
                <Icon name="i-lucide-user" class="size-4 opacity-50 shrink-0" />
              </button>

              <div v-if="activeDropdown === 'assignedTo'" class="fixed inset-0 z-40" @click.stop="activeDropdown = null" />
              <div v-if="activeDropdown === 'assignedTo'" class="absolute left-0 mt-1 top-full w-full bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-xl shadow-primary/5 z-50 flex flex-col ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 duration-150">
                <div class="p-2 border-b border-border/50">
                  <input v-model="employeeSearch" type="text" placeholder="Search employees..." class="w-full bg-background border border-border/50 rounded filter-none px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary" @click.stop>
                </div>
                <div class="max-h-[200px] overflow-y-auto py-1.5">
                  <button v-for="emp in filteredEmployees" :key="emp.employee" type="button" class="w-full text-left px-3 py-2 text-sm hover:bg-muted/60 transition-colors flex items-center justify-between gap-2" @click.stop="toggleAssignee(emp.employee)">
                    <span class="truncate" :class="isSelectedAssignee(emp.employee) ? 'font-bold text-primary' : ''">{{ emp.employee }}</span>
                    <Icon v-if="isSelectedAssignee(emp.employee)" name="i-lucide-check" class="size-4 text-primary shrink-0" />
                  </button>
                  <div v-if="!filteredEmployees.length" class="px-3 py-2 text-xs text-muted-foreground text-center">
                    No employees found.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="!isCustomerMode" class="space-y-2 col-span-2 sm:col-span-1 relative" :class="activeDropdown === 'projectAssignedTo' ? 'z-50' : ''">
            <Label>Crew</Label>
            <div class="relative">
              <button type="button" class="w-full flex items-center justify-between px-3 py-2 rounded-md border border-input bg-background hover:bg-muted/50 transition-colors shadow-sm text-sm focus:outline-none focus:ring-1 focus:ring-primary min-h-[36px] h-auto" @click.stop="activeDropdown = activeDropdown === 'projectAssignedTo' ? null : 'projectAssignedTo'">
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
                  <input ref="employeeSearchInput" v-model="employeeSearch" type="text" placeholder="Search employees..." class="w-full bg-background border border-border/50 rounded filter-none px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary" @click.stop>
                </div>
                <div class="max-h-[200px] overflow-y-auto py-1.5">
                  <button v-for="emp in filteredEmployees" :key="emp.employee" type="button" class="w-full text-left px-3 py-2 text-sm hover:bg-muted/60 transition-colors flex items-center justify-between gap-2" @click.stop="toggleEmployee(emp.employee)">
                    <span class="truncate" :class="isSelectedEmployee(emp.employee) ? 'font-bold text-primary' : ''">{{ emp.employee }}</span>
                    <Icon v-if="isSelectedEmployee(emp.employee)" name="i-lucide-check" class="size-4 text-primary shrink-0" />
                  </button>
                  <div v-if="!filteredEmployees.length" class="px-3 py-2 text-xs text-muted-foreground text-center">
                    No employees found.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="!isCustomerMode" class="space-y-2">
            <Label>Estim. Project Duration</Label>
            <Input v-model="form.estimatedProjectDuration" placeholder="e.g. 3 weeks" />
          </div>



          <div v-if="!isCustomerMode" class="space-y-2">
            <Label>Total Tracked Views</Label>
            <Input v-model="form.totalTrackedViews" type="number" placeholder="0" />
          </div>

          <div v-if="!isCustomerMode" class="space-y-2">
            <Label>Initial Contact Date</Label>
            <Input v-model="form.initialContactDate" type="date" />
          </div>

          <div v-if="!isCustomerMode" class="space-y-2">
            <Label>Last Follow Up Date</Label>
            <Input v-model="form.lastFollowUpSentOn" type="date" />
          </div>

          <div v-if="!isCustomerMode" class="space-y-2">
            <Label>Estimate Sent On</Label>
            <Input v-model="form.estimateSentOn" type="date" />
          </div>

          <div v-if="!isCustomerMode" class="space-y-2">
            <Label>Date Approved</Label>
            <Input v-model="form.dateApproved" type="date" />
          </div>

          <div v-if="!isCustomerMode" class="space-y-2">
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
          <button type="button" class="px-4 py-2 text-sm font-medium border rounded-md" @click="emit('update:modelValue', false)">
            Cancel
          </button>
          <button type="submit" :disabled="isLoading" class="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-md disabled:opacity-50">
            {{ isLoading ? 'Saving...' : 'Save' }}
          </button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
