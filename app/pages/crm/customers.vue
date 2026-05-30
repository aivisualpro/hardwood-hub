<script setup lang="ts">
import { toast } from 'vue-sonner'

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

// Immediate re-fetch on filter changes
watch(typeFilter, () => fetchClients(1))

useAsyncData('crm-clients', async () => {
  await fetchClients(1)
  return true
}, { server: false, lazy: true })

// ─── CRUD: Create / Edit ─────────────────────────────────
const showDialog = ref(false)
const saving = ref(false)
const editingId = ref<string | null>(null)

const TYPE_OPTIONS = [
  { value: 'lead', label: 'Lead' },
  { value: 'prospect', label: 'Prospect' },
  { value: 'active-customer', label: 'Active Customer' },
  { value: 'past-customer', label: 'Past Customer' },
]

function emptyForm() {
  return {
    name: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    type: 'lead',
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
    firstName: c.firstName || '',
    lastName: c.lastName || '',
    email: c.email || '',
    phone: c.phone || '',
    address: c.address || '',
    city: c.city || '',
    state: c.state || '',
    zip: c.zip || '',
    type: c.type || 'lead',
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
    if (editingId.value) {
      await $fetch(`/api/customers/${editingId.value}`, { method: 'PUT', body: form.value })
      toast.success('Customer updated')
    }
    else {
      await $fetch('/api/customers', { method: 'POST', body: form.value })
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
const TYPE_STYLE: Record<string, string> = {
  'lead': 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400',
  'prospect': 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400',
  'active-customer': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400',
  'past-customer': 'bg-slate-500/10 text-slate-600 border-slate-500/20 dark:text-slate-400',
}

function displayType(t: string) {
  if (!t)
    return '—'
  return t.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'type', label: 'Type' },
]
</script>

<template>
  <!-- Header Toolbar: Search + Add button -->
  <ClientOnly>
    <Teleport defer to="#header-toolbar">
      <div class="flex items-center gap-2 sm:gap-3 w-full max-w-xl pr-2">
        <div class="relative flex-1">
          <Icon name="i-lucide-search" class="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 size-3.5 sm:size-4 text-muted-foreground" />
          <input
            v-model="search"
            type="text"
            placeholder="Search by name, email, phone, city..."
            class="w-full h-8 sm:h-9 pl-8 sm:pl-9 pr-4 rounded-lg border border-input bg-background/50 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
          >
        </div>
        <button
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
        v-if="!search"
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
              class="group hover:bg-muted/10 transition-colors"
            >
              <td class="px-4 py-3">
                <div class="flex items-center gap-2">
                  <div class="size-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon name="i-lucide-user" class="size-3.5 text-primary" />
                  </div>
                  <span class="text-xs font-bold text-foreground truncate max-w-[200px]">{{ c.name || '—' }}</span>
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
                  v-if="c.type"
                  class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold capitalize border"
                  :class="TYPE_STYLE[c.type] || 'bg-muted text-muted-foreground border-border'"
                >
                  {{ displayType(c.type) }}
                </span>
                <span v-else class="text-xs text-muted-foreground">—</span>
              </td>
              <td class="px-4 py-3">
                <div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    class="size-7 rounded-lg flex items-center justify-center hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                    title="Edit"
                    @click="openEdit(c)"
                  >
                    <Icon name="i-lucide-pencil" class="size-3.5" />
                  </button>
                  <button
                    class="size-7 rounded-lg flex items-center justify-center hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    title="Delete"
                    @click="confirmDelete(c)"
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
                v-if="c.type"
                class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold capitalize border"
                :class="TYPE_STYLE[c.type] || 'bg-muted text-muted-foreground border-border'"
              >
                {{ displayType(c.type) }}
              </span>
            </div>
            <div class="flex items-center gap-1">
              <button
                class="size-7 rounded-lg flex items-center justify-center hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                @click="openEdit(c)"
              >
                <Icon name="i-lucide-pencil" class="size-3.5" />
              </button>
              <button
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

        <!-- First / Last -->
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <Label class="text-xs font-bold text-muted-foreground uppercase tracking-wider">First Name</Label>
            <Input v-model="form.firstName" placeholder="First" class="h-9 text-sm" />
          </div>
          <div class="space-y-1.5">
            <Label class="text-xs font-bold text-muted-foreground uppercase tracking-wider">Last Name</Label>
            <Input v-model="form.lastName" placeholder="Last" class="h-9 text-sm" />
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

        <!-- Type -->
        <div class="space-y-1.5">
          <Label class="text-xs font-bold text-muted-foreground uppercase tracking-wider">Type</Label>
          <select
            v-model="form.type"
            class="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          >
            <option v-for="opt in TYPE_OPTIONS" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </div>

        <!-- Address -->
        <div class="space-y-1.5">
          <Label class="text-xs font-bold text-muted-foreground uppercase tracking-wider">Address</Label>
          <Input v-model="form.address" placeholder="123 Main St" class="h-9 text-sm" />
        </div>

        <div class="grid grid-cols-3 gap-3">
          <div class="space-y-1.5 col-span-2">
            <Label class="text-xs font-bold text-muted-foreground uppercase tracking-wider">City</Label>
            <Input v-model="form.city" placeholder="Ann Arbor" class="h-9 text-sm" />
          </div>
          <div class="space-y-1.5">
            <Label class="text-xs font-bold text-muted-foreground uppercase tracking-wider">State</Label>
            <Input v-model="form.state" placeholder="MI" maxlength="2" class="h-9 text-sm" />
          </div>
        </div>

        <div class="space-y-1.5">
          <Label class="text-xs font-bold text-muted-foreground uppercase tracking-wider">Zip Code</Label>
          <Input v-model="form.zip" placeholder="48104" maxlength="10" class="h-9 text-sm w-32" />
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
