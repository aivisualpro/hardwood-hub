<script setup lang="ts">
import { toast } from 'vue-sonner'

const { canCreate, canUpdate, canDelete } = usePermissions('/crm/pipeline')

const { setHeader } = usePageHeader()
setHeader({
  title: 'Customers',
  icon: 'i-lucide-users',
  description: 'Customer records from the master client database',
})

// ─── Server-side state ───────────────────────────────────
const clients = ref<any[]>([])
const loading = ref(true)
const search = ref('')
const typeFilter = ref('')
const page = ref(1)
const totalPages = ref(1)
const total = ref(0)
const PAGE_LIMIT = 25

// ─── Sort (sent to server) ───────────────────────────────
const sortField = ref('name')
const sortDir = ref<'asc' | 'desc'>('asc')

function toggleSort(field: string) {
  if (sortField.value === field) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  }
  else {
    sortField.value = field
    sortDir.value = 'asc'
  }
  fetchClients(1)
}

function sortIcon(field: string) {
  if (sortField.value !== field)
    return 'i-lucide-arrow-up-down'
  return sortDir.value === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'
}

// ─── Fetch (server-side) ─────────────────────────────────
async function fetchClients(targetPage = page.value) {
  loading.value = true
  try {
    const params = new URLSearchParams({
      page: String(targetPage),
      limit: String(PAGE_LIMIT),
      sortField: sortField.value,
      sortDir: sortDir.value,
    })
    if (search.value.trim())
      params.set('search', search.value.trim())
    if (typeFilter.value)
      params.set('type', typeFilter.value)


    const res = await $fetch<any>(`/api/customers?${params.toString()}`)
    if (res?.success) {
      clients.value = res.data || []
      page.value = res.pagination?.page || 1
      totalPages.value = res.pagination?.totalPages || 1
      total.value = res.pagination?.total || 0
    }
  }
  catch {
    toast.error('Failed to load customers')
  }
  finally {
    loading.value = false
  }
}

// Debounce search: 300 ms
let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(search, () => {
  if (searchTimer)
    clearTimeout(searchTimer)
  searchTimer = setTimeout(() => fetchClients(1), 300)
})

// Re-fetch when type filter changes
watch(typeFilter, () => fetchClients(1))

// ─── Customer Type Dropdown ──────────────────────────────
interface TypeOption { _id: string, label: string, value: string, color: string, icon: string, order: number }
const typeOptions = ref<TypeOption[]>([])
const typeDropdownId = ref('')
const typeMap = computed(() => {
  const map = new Map<string, TypeOption>()
  for (const opt of typeOptions.value) map.set(String(opt._id), opt)
  return map
})

function resolveType(c: any): TypeOption | undefined {
  if (!c?.type) return undefined
  const id = String(c.type)
  // Try matching by ObjectId first
  const byId = typeMap.value.get(id)
  if (byId) return byId
  // Fallback: match by label/value (for old string-based type values)
  return typeOptions.value.find(o => o.label?.toLowerCase() === id.toLowerCase() || o.value?.toLowerCase() === id.toLowerCase())
}

const activeDropdown = ref<string | null>(null)
const typeSearch = ref('')
const typeSearchInput = ref<HTMLInputElement | null>(null)

const filteredTypeOptions = computed(() => {
  if (!typeSearch.value) return typeOptions.value
  const s = typeSearch.value.toLowerCase()
  return typeOptions.value.filter((o: TypeOption) =>
    (o.label || '').toLowerCase().includes(s)
    || (o.value || '').toLowerCase().includes(s),
  )
})

function selectType(opt: TypeOption) {
  form.value.type = String(opt._id)
  activeDropdown.value = null
  typeSearch.value = ''
}

function clearType() {
  form.value.type = ''
}

async function addNewType(label: string) {
  if (!label.trim()) return
  const newOpt = { label: label.trim(), value: label.trim(), color: '#6366f1', icon: '', order: typeOptions.value.length }
  try {
    const res = await $fetch<any>('/api/dropdowns', {
      method: 'POST',
      body: { name: 'Customer Type', options: [...typeOptions.value, newOpt] },
    })
    if (res.data) {
      typeOptions.value = res.data.options || []
      typeDropdownId.value = String(res.data._id)
      // Select the newly added option (last one)
      const added = typeOptions.value[typeOptions.value.length - 1]
      if (added) form.value.type = String(added._id)
    }
    typeSearch.value = ''
    activeDropdown.value = null
    toast.success(`Type "${label.trim()}" added`)
  }
  catch {
    toast.error('Failed to add type')
  }
}

watch(activeDropdown, (val) => {
  if (val === 'type') {
    nextTick(() => typeSearchInput.value?.focus())
  }
})

async function loadDropdownOptions() {
  try {
    const res = await $fetch<any>('/api/dropdowns?name=Customer Type')
    if (res?.data?.options) {
      typeOptions.value = res.data.options
    }
    else if (res?.data && Array.isArray(res.data)) {
      const match = res.data.find((dd: any) => dd.name === 'Customer Type')
      if (match?.options) typeOptions.value = match.options
    }
  }
  catch (err) {
    console.warn('Failed to load customer types:', err)
  }
}

useAsyncData('crm-clients', async () => {
  await fetchClients(1)
  return true
}, { server: false, lazy: true })

onMounted(() => {
  loadDropdownOptions()
})

// ─── CRUD: Create / Edit ─────────────────────────────────
const showDialog = ref(false)
const saving = ref(false)
const editingId = ref<string | null>(null)



function emptyForm() {
  return {
    name: '',
    type: '' as string,
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    notes: '',
  }
}

const form = ref(emptyForm())

function openCreate() {
  editingId.value = null
  form.value = emptyForm()
  showDialog.value = true
}

function openEdit(c: any) {
  editingId.value = c._id
  form.value = {
    name: c.name || '',
    type: c.type ? String(c.type) : '',
    email: c.email || '',
    phone: c.phone || '',
    address: c.address || '',
    city: c.city || '',
    state: c.state || '',
    zip: c.zip || '',
    notes: c.notes || '',
  }
  showDialog.value = true
}

async function saveCustomer() {
  if (!form.value.name.trim()) {
    toast.error('Name is required')
    return
  }
  saving.value = true
  try {
    const payload = {
      ...form.value,
      type: form.value.type || null,
    }
    if (editingId.value) {
      await $fetch(`/api/customers/${editingId.value}`, { method: 'PUT', body: payload })
      toast.success('Customer updated')
    }
    else {
      await $fetch('/api/customers', { method: 'POST', body: payload })
      toast.success('Customer created')
    }
    showDialog.value = false
    await fetchClients(page.value)
  }
  catch (e: any) {
    toast.error(editingId.value ? 'Failed to update' : 'Failed to create', { description: e?.message })
  }
  finally {
    saving.value = false
  }
}

// ─── CRUD: Delete ────────────────────────────────────────
const deleteTarget = ref<any | null>(null)
const deleting = ref(false)

function confirmDelete(c: any) {
  deleteTarget.value = c
}

async function doDelete() {
  if (!deleteTarget.value)
    return
  deleting.value = true
  try {
    await $fetch(`/api/customers/${deleteTarget.value._id}`, { method: 'DELETE' })
    toast.success('Customer deleted')
    deleteTarget.value = null
    await fetchClients(page.value)
  }
  catch (e: any) {
    toast.error('Failed to delete', { description: e?.message })
  }
  finally {
    deleting.value = false
  }
}

// ─── Display helpers ─────────────────────────────────────
const columns = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'type', label: 'Type' },
]

// ─── Toolbar filter dropdown state ───────────────────────
const filterDropdownOpen = ref(false)
const filterSearch = ref('')
const filterSearchInput = ref<HTMLInputElement | null>(null)

const filteredFilterOptions = computed(() => {
  if (!filterSearch.value) return typeOptions.value
  const s = filterSearch.value.toLowerCase()
  return typeOptions.value.filter(o => (o.label || '').toLowerCase().includes(s))
})

const selectedFilterLabel = computed(() => {
  if (!typeFilter.value) return 'All Types'
  const opt = typeMap.value.get(typeFilter.value)
  return opt?.label || 'All Types'
})

const selectedFilterColor = computed(() => {
  if (!typeFilter.value) return ''
  return typeMap.value.get(typeFilter.value)?.color || ''
})

function pickFilter(id: string) {
  typeFilter.value = id
  filterDropdownOpen.value = false
  filterSearch.value = ''
}

watch(filterDropdownOpen, (val) => {
  if (val) nextTick(() => filterSearchInput.value?.focus())
})
</script>

<template>
  <!-- Header Toolbar: Search + Add button -->
  <ClientOnly>
    <Teleport defer to="#header-toolbar">
      <div class="flex items-center gap-2 sm:gap-3 w-full max-w-2xl pr-2">
        <div class="relative flex-1">
          <Icon name="i-lucide-search" class="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 size-3.5 sm:size-4 text-muted-foreground" />
          <input
            v-model="search"
            type="text"
            placeholder="Search by name, email, phone, city..."
            class="w-full h-8 sm:h-9 pl-8 sm:pl-9 pr-4 rounded-lg border border-input bg-background/50 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
          >
        </div>
        <div class="relative shrink-0">
          <button
            class="flex items-center gap-1.5 h-8 sm:h-9 px-2.5 sm:px-3 rounded-lg border border-input bg-background/50 text-xs sm:text-sm font-medium hover:bg-muted/50 transition-all max-w-[160px]"
            @click.stop="filterDropdownOpen = !filterDropdownOpen"
          >
            <div v-if="selectedFilterColor" class="size-2 rounded-full shrink-0" :style="{ backgroundColor: selectedFilterColor }" />
            <Icon v-else name="i-lucide-filter" class="size-3 opacity-50 shrink-0" />
            <span class="truncate">{{ selectedFilterLabel }}</span>
            <Icon name="i-lucide-chevron-down" class="size-3 opacity-40 shrink-0" />
          </button>
          <div v-if="filterDropdownOpen" class="fixed inset-0 z-40" @click.stop="filterDropdownOpen = false" />
          <div v-if="filterDropdownOpen" class="absolute right-0 mt-1 top-full w-[200px] bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-xl shadow-primary/5 z-50 flex flex-col ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 duration-150">
            <div class="p-2 border-b border-border/50">
              <input ref="filterSearchInput" v-model="filterSearch" type="text" placeholder="Search types..." class="w-full bg-background border border-border/50 rounded filter-none px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary" @click.stop>
            </div>
            <div class="max-h-[200px] overflow-y-auto py-1.5">
              <button type="button" class="w-full text-left px-3 py-2 text-sm hover:bg-muted/60 transition-colors flex items-center justify-between gap-2" :class="!typeFilter ? 'font-bold text-primary' : ''" @click.stop="pickFilter('')">
                <span>All Types</span>
                <Icon v-if="!typeFilter" name="i-lucide-check" class="size-4 text-primary shrink-0" />
              </button>
              <button v-for="opt in filteredFilterOptions" :key="opt._id" type="button" class="w-full text-left px-3 py-2 text-sm hover:bg-muted/60 transition-colors flex items-center justify-between gap-2" @click.stop="pickFilter(String(opt._id))">
                <div class="flex items-center gap-2">
                  <div class="size-2 rounded-full" :style="{ backgroundColor: opt.color || '#6366f1' }" />
                  <span class="truncate" :class="typeFilter === String(opt._id) ? 'font-bold text-primary' : ''">{{ opt.label }}</span>
                </div>
                <Icon v-if="typeFilter === String(opt._id)" name="i-lucide-check" class="size-4 text-primary shrink-0" />
              </button>
              <div v-if="!filteredFilterOptions.length" class="px-3 py-2 text-xs text-muted-foreground text-center">
                No types found.
              </div>
            </div>
          </div>
        </div>
        <button
          v-if="canCreate()"
          class="inline-flex items-center gap-1.5 h-8 sm:h-9 px-3 sm:px-4 rounded-lg bg-primary text-primary-foreground text-xs sm:text-sm font-bold hover:bg-primary/90 transition-all shrink-0 shadow-sm"
          @click="openCreate"
        >
          <Icon name="i-lucide-plus" class="size-3.5" />
          <span class="hidden sm:inline">Add Customer</span>
        </button>
      </div>
    </Teleport>
  </ClientOnly>

  <div class="space-y-4">

    <!-- Loading -->
    <div v-if="loading" class="space-y-2">
      <div v-for="i in 8" :key="i" class="h-12 bg-muted/30 rounded-lg animate-pulse" />
    </div>

    <!-- Empty -->
    <div
      v-else-if="clients.length === 0"
      class="flex flex-col items-center justify-center py-16 text-center border bg-card rounded-xl border-dashed"
    >
      <Icon name="i-lucide-users" class="size-10 text-muted-foreground/20 mb-4" />
      <h3 class="font-bold text-lg mb-1">
        {{ search ? 'No results found' : 'No customers' }}
      </h3>
      <p class="text-sm text-muted-foreground mb-4">
        {{ search ? 'Try a different search term.' : 'Add your first customer.' }}
      </p>
      <button
        v-if="!search && canCreate()"
        class="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-all"
        @click="openCreate"
      >
        <Icon name="i-lucide-plus" class="size-4" />
        Add Customer
      </button>
    </div>

    <!-- Table -->
    <div v-else class="rounded-xl border border-border/50 bg-card overflow-hidden">
      <!-- Desktop -->
      <div class="hidden lg:block overflow-x-auto">
        <table class="w-full text-left min-w-max">
          <thead>
            <tr class="border-b bg-muted/30">
              <th
                v-for="col in columns"
                :key="col.key"
                class="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"
                @click="toggleSort(col.key)"
              >
                <div class="flex items-center gap-1">
                  {{ col.label }}
                  <Icon :name="sortIcon(col.key)" class="size-3" :class="sortField === col.key ? 'text-primary' : 'opacity-30'" />
                </div>
              </th>
              <th class="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border/30">
            <tr
              v-for="c in clients"
              :key="c._id"
              class="group hover:bg-muted/10 transition-colors cursor-pointer"
              @click="navigateTo(`/crm/customers/${c._id}`)"
            >
              <td class="px-4 py-3">
                <div class="flex items-center gap-2">
                  <div class="size-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon name="i-lucide-user" class="size-3.5 text-primary" />
                  </div>
                  <span class="text-xs font-bold text-primary hover:underline truncate max-w-[200px]">{{ c.name || '—' }}</span>
                </div>
              </td>
              <td class="px-4 py-3">
                <span v-if="c.email" class="text-xs text-foreground">{{ c.email }}</span>
                <span v-else class="text-xs text-muted-foreground">—</span>
              </td>
              <td class="px-4 py-3">
                <span class="text-xs text-muted-foreground tabular-nums">{{ c.phone || '—' }}</span>
              </td>
              <td class="px-4 py-3">
                <span class="text-xs text-muted-foreground">{{ c.city || '—' }}</span>
              </td>
              <td class="px-4 py-3">
                <span class="text-xs text-muted-foreground uppercase font-bold tracking-wider">{{ c.state || '—' }}</span>
              </td>
              <td class="px-4 py-3">
                <span
                  v-if="resolveType(c)"
                  class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold capitalize border"
                  :style="{ backgroundColor: resolveType(c)!.color + '20', color: resolveType(c)!.color, borderColor: resolveType(c)!.color + '40' }"
                >
                  {{ resolveType(c)!.label }}
                </span>
                <span v-else class="text-xs text-muted-foreground">—</span>
              </td>
              <td class="px-4 py-3">
                <div class="flex items-center justify-end gap-1 transition-opacity">
                  <button
                    v-if="canUpdate()"
                    class="size-7 rounded-lg flex items-center justify-center hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                    title="Edit"
                    @click.stop="openEdit(c)"
                  >
                    <Icon name="i-lucide-pencil" class="size-3.5" />
                  </button>
                  <button
                    v-if="canDelete()"
                    class="size-7 rounded-lg flex items-center justify-center hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    title="Delete"
                    @click.stop="confirmDelete(c)"
                  >
                    <Icon name="i-lucide-trash-2" class="size-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Mobile Cards -->
      <div class="block lg:hidden p-3 space-y-2 bg-muted/20">
        <div
          v-for="c in clients"
          :key="c._id"
          class="border border-border/60 rounded-xl p-3.5 bg-card shadow-sm"
        >
          <div class="flex items-center gap-3 mb-2">
            <div class="size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Icon name="i-lucide-user" class="size-4 text-primary" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-bold truncate">
                {{ c.name || '—' }}
              </p>
              <span
                v-if="resolveType(c)"
                class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold capitalize border"
                :style="{ backgroundColor: resolveType(c)!.color + '20', color: resolveType(c)!.color, borderColor: resolveType(c)!.color + '40' }"
              >
                {{ resolveType(c)!.label }}
              </span>
            </div>
            <div class="flex items-center gap-1">
              <button
                v-if="canUpdate()"
                class="size-7 rounded-lg flex items-center justify-center hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                @click="openEdit(c)"
              >
                <Icon name="i-lucide-pencil" class="size-3.5" />
              </button>
              <button
                v-if="canDelete()"
                class="size-7 rounded-lg flex items-center justify-center hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                @click="confirmDelete(c)"
              >
                <Icon name="i-lucide-trash-2" class="size-3.5" />
              </button>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2 text-xs">
            <div v-if="c.email" class="flex items-center gap-1.5 text-muted-foreground">
              <Icon name="i-lucide-mail" class="size-3 shrink-0" />
              <span class="truncate">{{ c.email }}</span>
            </div>
            <div v-if="c.phone" class="flex items-center gap-1.5 text-muted-foreground">
              <Icon name="i-lucide-phone" class="size-3 shrink-0" />
              <span class="tabular-nums">{{ c.phone }}</span>
            </div>
            <div v-if="c.address || c.city" class="flex items-center gap-1.5 text-muted-foreground col-span-2">
              <Icon name="i-lucide-map-pin" class="size-3 shrink-0" />
              <span class="truncate">{{ [c.address, c.city, c.state, c.zip].filter(Boolean).join(', ') }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="!loading && totalPages > 1" class="flex items-center justify-between pt-2">
      <span class="text-xs text-muted-foreground">
        Showing {{ clients.length }} of {{ total }} customers
      </span>
      <div class="flex items-center gap-2">
        <button
          class="h-8 px-3 rounded-lg border border-input text-xs font-medium hover:bg-muted/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          :disabled="page <= 1"
          @click="fetchClients(page - 1)"
        >
          ← Prev
        </button>
        <span class="text-xs text-muted-foreground tabular-nums">{{ page }} / {{ totalPages }}</span>
        <button
          class="h-8 px-3 rounded-lg border border-input text-xs font-medium hover:bg-muted/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          :disabled="page >= totalPages"
          @click="fetchClients(page + 1)"
        >
          Next →
        </button>
      </div>
    </div>
  </div>

  <!-- ═══ Create / Edit Dialog ═══ -->
  <Dialog v-model:open="showDialog">
    <DialogContent class="max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <div class="flex items-center gap-3 mb-1">
          <div class="size-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Icon :name="editingId ? 'i-lucide-pencil' : 'i-lucide-user-plus'" class="size-4 text-primary" />
          </div>
          <div>
            <DialogTitle>{{ editingId ? 'Edit Customer' : 'Add Customer' }}</DialogTitle>
            <DialogDescription class="text-xs mt-0.5">
              {{ editingId ? 'Update customer details' : 'Add a new customer to the master database' }}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div class="space-y-4 pt-2">
        <!-- Name -->
        <div class="space-y-1.5">
          <Label class="text-xs font-bold text-muted-foreground uppercase tracking-wider">Full Name <span class="text-destructive">*</span></Label>
          <Input v-model="form.name" placeholder="e.g. John Smith" class="h-9 text-sm" />
        </div>

        <!-- Type -->
        <div class="space-y-1.5 relative" :class="activeDropdown === 'type' ? 'z-50' : ''">
          <Label class="text-xs font-bold text-muted-foreground uppercase tracking-wider">Type</Label>
          <div class="relative">
            <button type="button" class="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-input bg-background hover:bg-muted/50 transition-colors shadow-sm text-sm focus:outline-none focus:ring-1 focus:ring-primary h-9" @click.stop="activeDropdown = activeDropdown === 'type' ? null : 'type'">
              <div class="flex items-center gap-2">
                <div v-if="resolveType({ type: form.type })" class="size-2.5 rounded-full" :style="{ backgroundColor: resolveType({ type: form.type })!.color }" />
                <span :class="form.type ? 'text-foreground font-medium' : 'text-muted-foreground'">{{ resolveType({ type: form.type })?.label || 'Select type...' }}</span>
              </div>
              <div class="flex items-center gap-1">
                <button v-if="form.type" type="button" class="size-5 rounded flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors" @click.stop="clearType">
                  <Icon name="i-lucide-x" class="size-3" />
                </button>
                <Icon name="i-lucide-chevron-down" class="size-4 opacity-50" />
              </div>
            </button>

            <div v-if="activeDropdown === 'type'" class="fixed inset-0 z-40" @click.stop="activeDropdown = null" />
            <div v-if="activeDropdown === 'type'" class="absolute left-0 mt-1 top-full w-full bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-xl shadow-primary/5 z-50 flex flex-col ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 duration-150">
              <div class="p-2 border-b border-border/50">
                <input ref="typeSearchInput" v-model="typeSearch" type="text" placeholder="Search or add new..." class="w-full bg-background border border-border/50 rounded filter-none px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary" @click.stop @keydown.enter.prevent="typeSearch && !filteredTypeOptions.find(o => o.label.toLowerCase() === typeSearch.toLowerCase()) ? addNewType(typeSearch) : (filteredTypeOptions.length === 1 && filteredTypeOptions[0]) ? selectType(filteredTypeOptions[0]!) : null">
              </div>
              <div class="max-h-[200px] overflow-y-auto py-1.5">
                <button v-for="opt in filteredTypeOptions" :key="opt._id" type="button" class="w-full text-left px-3 py-2 text-sm hover:bg-muted/60 transition-colors flex items-center justify-between gap-2" @click.stop="selectType(opt)">
                  <div class="flex items-center gap-2">
                    <div class="size-2.5 rounded-full" :style="{ backgroundColor: opt.color || '#6366f1' }" />
                    <span class="truncate" :class="form.type === String(opt._id) ? 'font-bold text-primary' : ''">{{ opt.label }}</span>
                  </div>
                  <Icon v-if="form.type === String(opt._id)" name="i-lucide-check" class="size-4 text-primary shrink-0" />
                </button>
                <button v-if="typeSearch && !filteredTypeOptions.find(o => o.label.toLowerCase() === typeSearch.toLowerCase())" type="button" class="w-full text-left px-3 py-2 text-sm hover:bg-primary/10 text-primary transition-colors flex items-center gap-2 font-bold whitespace-nowrap" @click.stop="addNewType(typeSearch)">
                  <Icon name="i-lucide-plus" class="size-4 shrink-0" />
                  <span class="truncate">Add "{{ typeSearch }}"</span>
                </button>
                <div v-if="!filteredTypeOptions.length && !typeSearch" class="px-3 py-2 text-xs text-muted-foreground text-center">
                  No types available.
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Contact -->
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <Label class="text-xs font-bold text-muted-foreground uppercase tracking-wider">Email</Label>
            <Input v-model="form.email" type="email" placeholder="email@example.com" class="h-9 text-sm" />
          </div>
          <div class="space-y-1.5">
            <Label class="text-xs font-bold text-muted-foreground uppercase tracking-wider">Phone</Label>
            <Input v-model="form.phone" placeholder="+1 (555) 000-0000" class="h-9 text-sm" />
          </div>
        </div>

        <!-- Address -->
        <div class="space-y-1.5">
          <Label class="text-xs font-bold text-muted-foreground uppercase tracking-wider">Address</Label>
          <Input v-model="form.address" placeholder="123 Main St" class="h-9 text-sm" />
        </div>

        <!-- City / State / Zip — all inline -->
        <div class="grid grid-cols-6 gap-3">
          <div class="space-y-1.5 col-span-3">
            <Label class="text-xs font-bold text-muted-foreground uppercase tracking-wider">City</Label>
            <Input v-model="form.city" placeholder="Ann Arbor" class="h-9 text-sm" />
          </div>
          <div class="space-y-1.5 col-span-1">
            <Label class="text-xs font-bold text-muted-foreground uppercase tracking-wider">State</Label>
            <Input v-model="form.state" placeholder="MI" maxlength="2" class="h-9 text-sm" />
          </div>
          <div class="space-y-1.5 col-span-2">
            <Label class="text-xs font-bold text-muted-foreground uppercase tracking-wider">Zip</Label>
            <Input v-model="form.zip" placeholder="48104" maxlength="10" class="h-9 text-sm" />
          </div>
        </div>

        <!-- Notes -->
        <div class="space-y-1.5">
          <Label class="text-xs font-bold text-muted-foreground uppercase tracking-wider">Notes</Label>
          <textarea
            v-model="form.notes"
            placeholder="Any additional notes..."
            rows="3"
            class="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>
      </div>

      <DialogFooter class="pt-4 gap-2">
        <Button variant="outline" @click="showDialog = false">
          Cancel
        </Button>
        <Button :disabled="saving" @click="saveCustomer">
          <Icon v-if="saving" name="i-lucide-loader-circle" class="mr-2 size-4 animate-spin" />
          {{ editingId ? 'Save Changes' : 'Add Customer' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- ═══ Delete Confirm Dialog ═══ -->
  <Dialog :open="!!deleteTarget" @update:open="v => { if (!v) deleteTarget = null }">
    <DialogContent class="max-w-sm">
      <DialogHeader>
        <div class="flex items-center gap-3 mb-1">
          <div class="size-9 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center justify-center">
            <Icon name="i-lucide-trash-2" class="size-4 text-destructive" />
          </div>
          <div>
            <DialogTitle>Delete Customer</DialogTitle>
            <DialogDescription class="text-xs mt-0.5">
              This action cannot be undone
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>
      <p class="text-sm text-muted-foreground py-2">
        Are you sure you want to delete <span class="font-bold text-foreground">{{ deleteTarget?.name }}</span>? Their contracts and pipeline data will not be removed.
      </p>
      <DialogFooter class="gap-2">
        <Button variant="outline" @click="deleteTarget = null">
          Cancel
        </Button>
        <Button variant="destructive" :disabled="deleting" @click="doDelete">
          <Icon v-if="deleting" name="i-lucide-loader-circle" class="mr-2 size-4 animate-spin" />
          Delete
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
