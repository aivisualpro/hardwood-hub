<script setup lang="ts">
const { setHeader } = usePageHeader()
setHeader({
  title: 'Customers',
  icon: 'i-lucide-users',
  description: 'Customer records from the master client database',
})

// ─── Data ────────────────────────────────────────────────
const clients = ref<any[]>([])
const loading = ref(true)
const search = ref('')

// Sort
const sortField = ref('name')
const sortDir = ref<'asc' | 'desc'>('asc')

function toggleSort(field: string) {
  if (sortField.value === field) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortField.value = field
    sortDir.value = 'asc'
  }
}

function sortIcon(field: string) {
  if (sortField.value !== field) return 'i-lucide-arrow-up-down'
  return sortDir.value === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'
}

const filteredClients = computed(() => {
  let list = [...clients.value]

  // Search filter
  const q = search.value.trim().toLowerCase()
  if (q) {
    list = list.filter(c =>
      (c.name || '').toLowerCase().includes(q)
      || (c.email || '').toLowerCase().includes(q)
      || (c.phone || '').includes(q)
      || (c.address || '').toLowerCase().includes(q)
      || (c.city || '').toLowerCase().includes(q)
      || (c.state || '').toLowerCase().includes(q)
      || (c.zip || '').includes(q)
      || (c.type || '').toLowerCase().includes(q)
    )
  }

  // Sort
  const f = sortField.value
  const dir = sortDir.value === 'asc' ? 1 : -1
  list.sort((a, b) => {
    const va = (a[f] || '').toString().toLowerCase()
    const vb = (b[f] || '').toString().toLowerCase()
    return va < vb ? -1 * dir : va > vb ? 1 * dir : 0
  })

  return list
})

// ─── Fetch ───────────────────────────────────────────────
await useAsyncData('crm-clients', async () => {
  loading.value = true
  try {
    const res = await $fetch<any>('/api/customers')
    if (res?.success) clients.value = res.data || []
  } catch {
    console.error('Failed to load clients')
  } finally {
    loading.value = false
  }
  return true
}, { server: false, lazy: true })

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'address', label: 'Address' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'zip', label: 'Zip' },
  { key: 'type', label: 'Type' },
]

function displayType(t: string) {
  if (!t) return '—'
  return t.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
</script>

<template>
  <div class="space-y-4">
    <!-- Toolbar -->
    <div class="flex items-center gap-3">
      <div class="relative flex-1 max-w-sm">
        <Icon name="i-lucide-search" class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <input
          v-model="search"
          type="text"
          placeholder="Search clients..."
          class="w-full h-9 pl-9 pr-4 rounded-lg border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-background transition-all"
        >
      </div>
      <span class="text-xs text-muted-foreground font-bold tabular-nums">
        {{ filteredClients.length }} client{{ filteredClients.length !== 1 ? 's' : '' }}
      </span>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="space-y-2">
      <div v-for="i in 8" :key="i" class="h-12 bg-muted/30 rounded-lg animate-pulse" />
    </div>

    <!-- Empty -->
    <div v-else-if="filteredClients.length === 0" class="flex flex-col items-center justify-center py-16 text-center border bg-card rounded-xl border-dashed">
      <Icon name="i-lucide-users" class="size-10 text-muted-foreground/20 mb-4" />
      <h3 class="font-bold text-lg mb-1">{{ search ? 'No results found' : 'No clients' }}</h3>
      <p class="text-sm text-muted-foreground">{{ search ? 'Try a different search term.' : 'No customer records exist yet.' }}</p>
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
            </tr>
          </thead>
          <tbody class="divide-y divide-border/30">
            <tr
              v-for="c in filteredClients"
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
                <span class="text-xs text-muted-foreground truncate max-w-[180px] block">{{ c.address || '—' }}</span>
              </td>
              <td class="px-4 py-3">
                <span class="text-xs text-muted-foreground">{{ c.city || '—' }}</span>
              </td>
              <td class="px-4 py-3">
                <span class="text-xs text-muted-foreground uppercase font-bold tracking-wider">{{ c.state || '—' }}</span>
              </td>
              <td class="px-4 py-3">
                <span class="text-xs text-muted-foreground tabular-nums">{{ c.zip || '—' }}</span>
              </td>
              <td class="px-4 py-3">
                <span
                  v-if="c.type"
                  class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold capitalize border bg-primary/10 text-primary border-primary/20"
                >
                  {{ displayType(c.type) }}
                </span>
                <span v-else class="text-xs text-muted-foreground">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Mobile Cards -->
      <div class="block lg:hidden p-3 space-y-2 bg-muted/20">
        <div v-for="c in filteredClients" :key="c._id" class="border border-border/60 rounded-xl p-3.5 bg-card shadow-sm">
          <div class="flex items-center gap-3 mb-2">
            <div class="size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Icon name="i-lucide-user" class="size-4 text-primary" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-bold truncate">{{ c.name || '—' }}</p>
              <p v-if="c.type" class="text-[10px] font-bold text-primary capitalize">{{ displayType(c.type) }}</p>
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
  </div>
</template>
