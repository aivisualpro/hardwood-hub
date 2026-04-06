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

function formatDate(dateString: string) {
  if (!dateString) return '—'
  return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const searchQuery = ref('')
const filteredCustomers = computed(() => {
  const query = searchQuery.value.toLowerCase()
  let list = customers.value

  if (query) {
    list = list.filter(c => 
      c.name?.toLowerCase().includes(query) || 
      c.email?.toLowerCase().includes(query) || 
      c.phone?.toLowerCase().includes(query)
    )
  }

  return list.sort((a, b) => {
    const nameA = (a.name || `${a.firstName || ''} ${a.lastName || ''}`.trim() || 'Unknown').toLowerCase()
    const nameB = (b.name || `${b.firstName || ''} ${b.lastName || ''}`.trim() || 'Unknown').toLowerCase()
    return nameA.localeCompare(nameB)
  })
})
</script>

<template>
  <div>
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
        <button
          class="inline-flex items-center justify-center gap-2 h-8 sm:h-9 px-3 sm:px-4 rounded-lg bg-primary text-primary-foreground text-xs sm:text-sm font-bold hover:bg-primary/90 transition-all shrink-0 shadow-lg shadow-primary/20"
          @click="showCreateModal = true"
        >
          <Icon name="i-lucide-plus" class="size-3.5" />
          <span class="hidden sm:inline">New Customer</span>
        </button>
      </div>
    </Teleport>

    <CrmCustomerFormDialog 
      v-model="showCreateModal"
      @saved="onCustomerCreated"
    />

    <div class="rounded-xl border border-border/50 bg-card">
      <table class="w-full text-left">
        <thead class="sticky top-(--header-height) z-30 bg-muted/95 backdrop-blur-sm shadow-sm ring-1 ring-border/5">
          <tr>
            <th class="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Name</th>
            <th class="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Email</th>
            <th class="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Phone</th>
            <th class="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Type</th>
            <th class="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Status</th>
            <th class="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Created</th>
            <th class="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border/30">
          <tr v-if="isLoading" v-for="i in 5" :key="i">
            <td colspan="7" class="px-4 py-3">
              <div class="h-6 bg-muted/40 rounded animate-pulse"></div>
            </td>
          </tr>
          <tr
            v-else
            v-for="c in filteredCustomers"
            :key="c._id"
            class="group hover:bg-muted/10 transition-colors cursor-pointer"
            @click="navigateTo(`/crm/customers/${c._id}`)"
          >
            <td class="px-4 py-3 text-sm font-semibold capitalize">{{ c.name || `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Unknown' }}</td>
            <td class="px-4 py-3 text-xs">{{ c.email || '—' }}</td>
            <td class="px-4 py-3 text-xs">{{ c.phone || '—' }}</td>
            <td class="px-4 py-3">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold capitalize bg-primary/10 text-primary">{{ c.type || 'lead' }}</span>
            </td>
            <td class="px-4 py-3">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold capitalize border bg-muted/50 text-muted-foreground">{{ c.status || 'new' }}</span>
            </td>
            <td class="px-4 py-3 text-xs text-muted-foreground tabular-nums">{{ formatDate(c.createdAt) }}</td>
            <td class="px-4 py-3 text-right">
              <Icon name="i-lucide-chevron-right" class="size-4 text-muted-foreground opacity-50 group-hover:opacity-100 transition-opacity" />
            </td>
          </tr>
          <tr v-if="!isLoading && filteredCustomers.length === 0">
            <td colspan="7" class="px-4 py-12 text-center text-muted-foreground">
              No customers found
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
