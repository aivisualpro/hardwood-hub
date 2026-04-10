<script setup lang="ts">
import type { CrmSubmission } from '~/composables/useCrm'
import { format } from 'date-fns'

const props = defineProps<{
  items: CrmSubmission[]
  isLoading: boolean
  type?: string
  showTypeColumn?: boolean
  emptyIcon?: string
  emptyTitle?: string
  emptyDescription?: string
  isEmbedded?: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle-star', id: string): void
  (e: 'update-status', id: string, status: string): void
  (e: 'view-details', item: CrmSubmission): void
}>()

const selectedItem = ref<CrmSubmission | null>(null)
const relatedSubmissions = ref<CrmSubmission[]>([])
const isLoadingRelated = ref(false)
const showDetailSheet = ref(false)

async function viewDetails(item: CrmSubmission) {
  selectedItem.value = item
  showDetailSheet.value = true
  
  if (item.email) {
    isLoadingRelated.value = true
    try {
      const res = await $fetch<any>(`/api/crm/submissions?email=${encodeURIComponent(item.email)}&limit=100`)
      // Filter out current item from related records
      relatedSubmissions.value = (res.data || []).filter((s: CrmSubmission) => s._id !== item._id)
    } finally {
      isLoadingRelated.value = false
    }
  } else {
    relatedSubmissions.value = []
  }
}

function formatDate(date: string) {
  if (!date) return '—'
  return format(new Date(date), 'MMM dd, yyyy h:mm a')
}

function formatDateShort(date: string) {
  if (!date) return '—'
  return format(new Date(date), 'MMM dd, yyyy')
}

function statusColor(status: string) {
  switch (status) {
    case 'new': return 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
    case 'contacted': return 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
    case 'in-progress': return 'bg-violet-500/15 text-violet-600 dark:text-violet-400'
    case 'completed': return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
    case 'archived': return 'bg-zinc-500/15 text-zinc-500 dark:text-zinc-400'
    default: return 'bg-zinc-500/15 text-zinc-500'
  }
}

function typeIcon(type: string) {
  switch (type) {
    case 'appointment': return 'i-lucide-calendar-check'
    case 'fast-quote': return 'i-lucide-zap'
    case 'flooring-estimate': return 'i-lucide-ruler'
    case 'subscriber': return 'i-lucide-mail-check'
    default: return 'i-lucide-file-text'
  }
}

function typeLabel(type: string) {
  switch (type) {
    case 'appointment': return 'Appointment'
    case 'fast-quote': return 'Fast Quote'
    case 'flooring-estimate': return 'Estimate'
    case 'subscriber': return 'Subscriber'
    default: return 'Other'
  }
}

function typeColor(type: string) {
  switch (type) {
    case 'appointment': return 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
    case 'fast-quote': return 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
    case 'flooring-estimate': return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
    case 'subscriber': return 'bg-violet-500/15 text-violet-600 dark:text-violet-400'
    default: return 'bg-zinc-500/15 text-zinc-500'
  }
}

const statuses = ['new', 'contacted', 'in-progress', 'completed', 'archived']
</script>

<template>
  <div>
    <!-- Desktop Table (Hidden on mobile) -->
    <div class="hidden md:block border rounded-2xl bg-card overflow-hidden">
      <table class="w-full text-sm border-collapse">
        <thead>
          <tr class="border-b bg-muted/30">
            <th class="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-8" />
            <th class="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Contact</th>
            <th class="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Email</th>
            <th v-if="showTypeColumn" class="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Type</th>
            <th class="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hidden xl:table-cell">Phone</th>
            <th class="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Date</th>
            <th class="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Status</th>
            <th class="text-right py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-12" />
          </tr>
        </thead>
        <tbody v-if="isLoading">
          <tr v-for="n in 8" :key="n" class="border-b last:border-b-0">
            <td class="py-3 px-4"><div class="w-5 h-5 rounded bg-muted animate-pulse" /></td>
            <td class="py-3 px-4">
              <div class="h-4 w-36 rounded bg-muted animate-pulse" />
            </td>
            <td class="py-3 px-4 hidden lg:table-cell"><div class="h-4 w-48 rounded bg-muted animate-pulse" /></td>
            <td v-if="showTypeColumn" class="py-3 px-4"><div class="h-5 w-20 rounded-full bg-muted animate-pulse" /></td>
            <td class="py-3 px-4 hidden xl:table-cell"><div class="h-4 w-28 rounded bg-muted animate-pulse" /></td>
            <td class="py-3 px-4 hidden md:table-cell"><div class="h-4 w-24 rounded bg-muted animate-pulse" /></td>
            <td class="py-3 px-4"><div class="h-5 w-20 rounded-full bg-muted animate-pulse" /></td>
            <td class="py-3 px-4"><div class="h-5 w-5 rounded bg-muted animate-pulse" /></td>
          </tr>
        </tbody>
        <tbody v-else-if="items.length === 0">
          <tr>
            <td :colspan="showTypeColumn ? 7 : 6" class="py-16 text-center">
              <div class="flex flex-col items-center gap-3">
                <div class="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center">
                  <Icon :name="emptyIcon || 'i-lucide-inbox'" class="size-7 text-muted-foreground/50" />
                </div>
                <div>
                  <p class="font-medium text-muted-foreground">{{ emptyTitle || 'No submissions yet' }}</p>
                  <p class="text-xs text-muted-foreground/60 mt-1">{{ emptyDescription || 'Click "Sync from WordPress" to pull in form submissions' }}</p>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr
            v-for="item in items"
            :key="item._id"
            class="border-b last:border-b-0 hover:bg-muted/20 transition-colors cursor-pointer group"
            @click="navigateTo(`/crm/submissions/${item._id}`)"
          >
            <!-- Star -->
            <td class="py-3 px-4">
              <button
                class="transition-all duration-200 hover:scale-125"
                :class="item.starred ? 'text-amber-400' : 'text-muted-foreground/30 hover:text-amber-400'"
                @click.stop="emit('toggle-star', item._id)"
              >
                <Icon :name="item.starred ? 'i-lucide-star' : 'i-lucide-star'" class="size-4" :class="item.starred ? 'fill-amber-400' : ''" />
              </button>
            </td>

            <!-- Contact -->
            <td class="py-3 px-4">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0 ring-1 ring-primary/10">
                  <span class="text-xs font-bold text-primary uppercase">
                    {{ (item.name || item.email || '?').charAt(0) }}
                  </span>
                </div>
                <div class="min-w-0">
                  <p class="font-medium truncate text-foreground leading-tight group-hover:text-primary transition-colors">
                    {{ item.name || 'Unknown' }}
                  </p>
                </div>
              </div>
            </td>

            <!-- Email (Separate Column) -->
            <td class="py-3 px-4 hidden lg:table-cell">
              <span class="text-xs text-muted-foreground truncate max-w-[200px] block group-hover:text-primary transition-colors">
                {{ item.email || '—' }}
              </span>
            </td>

            <!-- Type -->
            <td v-if="showTypeColumn" class="py-3 px-4">
              <span
                class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                :class="typeColor(item.type)"
              >
                <Icon :name="typeIcon(item.type)" class="size-3" />
                {{ typeLabel(item.type) }}
              </span>
            </td>

            <!-- Phone -->
            <td class="py-3 px-4 hidden xl:table-cell">
              <span class="text-muted-foreground text-xs">{{ item.phone || '—' }}</span>
            </td>

            <!-- Date -->
            <td class="py-3 px-4 hidden md:table-cell">
              <span class="text-muted-foreground text-xs">{{ formatDateShort(item.dateSubmitted) }}</span>
            </td>

            <!-- Status -->
            <td class="py-3 px-4">
              <span
                class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize"
                :class="statusColor(item.status)"
              >
                {{ item.status }}
              </span>
            </td>

            <!-- Actions -->
            <td class="py-3 px-4 text-right">
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <button
                    class="inline-flex items-center justify-center w-7 h-7 rounded-md hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
                    @click.stop
                  >
                    <Icon name="i-lucide-more-horizontal" class="size-4 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" class="w-44">
                  <DropdownMenuItem v-for="s in statuses" :key="s" @click.stop="emit('update-status', item._id, s)">
                    <Icon name="i-lucide-circle" class="size-3.5 mr-2" />
                    Mark as {{ s }}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Mobile/Tablet Card View (Hidden on desktop) -->
    <div class="md:hidden space-y-4">
      <!-- Loading Skeleton for Cards -->
      <template v-if="isLoading">
        <div v-for="n in 5" :key="n" class="p-5 rounded-3xl border border-border/50 bg-card/50 space-y-4 animate-pulse">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="size-10 rounded-full bg-muted" />
              <div class="space-y-2">
                <div class="h-4 w-32 bg-muted rounded" />
                <div class="h-3 w-48 bg-muted rounded" />
              </div>
            </div>
            <div class="size-5 bg-muted rounded" />
          </div>
          <div class="h-px bg-border/30" />
          <div class="flex items-center justify-between">
            <div class="h-6 w-20 rounded-full bg-muted" />
            <div class="h-6 w-20 rounded-full bg-muted" />
          </div>
        </div>
      </template>

      <!-- Empty State for Cards -->
      <template v-else-if="items.length === 0">
        <div class="py-20 flex flex-col items-center gap-4 text-center px-6">
          <div class="w-16 h-16 rounded-3xl bg-muted/50 flex items-center justify-center">
            <Icon :name="emptyIcon || 'i-lucide-inbox'" class="size-8 text-muted-foreground/40" />
          </div>
          <div>
            <p class="font-bold text-lg">{{ emptyTitle || 'No items found' }}</p>
            <p class="text-sm text-muted-foreground mt-1">{{ emptyDescription || 'Check your filters or click Sync to fetch new data' }}</p>
          </div>
        </div>
      </template>

      <!-- Submissions Cards -->
      <template v-else>
        <div 
          v-for="item in items" 
          :key="item._id"
          class="group relative overflow-hidden p-5 rounded-3xl border border-border/50 bg-card transition-all active:scale-[0.98] shadow-sm hover:shadow-md"
          @click="navigateTo(`/crm/submissions/${item._id}`)"
        >
          <!-- Subtle Type Gradient -->
          <div 
            class="absolute top-0 right-0 w-32 h-32 blur-3xl opacity-10 pointer-events-none -mr-10 -mt-10"
            :class="{
              'bg-sky-500': item.type === 'appointment',
              'bg-amber-500': item.type === 'fast-quote',
              'bg-emerald-500': item.type === 'flooring-estimate',
              'bg-primary': item.type === 'subscriber',
            }"
          />

          <div class="flex flex-col gap-4">
            <!-- Card Top: Contact & Quick Actions -->
            <div class="flex items-start justify-between">
              <div class="flex items-center gap-3">
                <div class="size-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0 ring-1 ring-primary/10 shadow-inner">
                  <span class="text-base font-bold text-primary uppercase">
                    {{ (item.name || item.email || '?').charAt(0) }}
                  </span>
                </div>
                <div class="min-w-0">
                  <h4 class="font-bold text-foreground truncate group-hover:text-primary transition-colors pr-8">
                    {{ item.name || 'Anonymous' }}
                  </h4>
                  <p class="text-xs text-muted-foreground truncate max-w-[200px] mt-0.5">
                    {{ item.email || 'No email provided' }}
                  </p>
                </div>
              </div>

              <!-- Quick Star Toggle -->
              <button
                class="absolute top-5 right-5 p-2 rounded-xl bg-muted/20 border border-transparent active:border-amber-400/30 transition-all"
                :class="item.starred ? 'text-amber-400' : 'text-muted-foreground/30'"
                @click.stop="emit('toggle-star', item._id)"
              >
                <Icon :name="item.starred ? 'i-lucide-star' : 'i-lucide-star'" class="size-5" :class="item.starred ? 'fill-amber-400' : ''" />
              </button>
            </div>

            <!-- Card Middle: Details -->
            <div class="flex items-center gap-3 text-[11px] font-medium text-muted-foreground">
              <p class="flex items-center gap-1.5">
                <Icon name="i-lucide-calendar" class="size-3" />
                {{ formatDateShort(item.dateSubmitted) }}
              </p>
              <span class="size-1 rounded-full bg-muted-foreground/20" />
              <p v-if="item.phone" class="flex items-center gap-1.5">
                <Icon name="i-lucide-phone" class="size-3" />
                {{ item.phone }}
              </p>
            </div>

            <div class="h-px bg-border/30 -mx-5" />

            <!-- Card Bottom: Badges -->
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-2">
                <span
                  class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
                  :class="typeColor(item.type)"
                >
                  <Icon :name="typeIcon(item.type)" class="size-3" />
                  {{ typeLabel(item.type) }}
                </span>
                <span
                  class="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
                  :class="statusColor(item.status)"
                >
                  {{ item.status }}
                </span>
              </div>

              <!-- Status Change Dropdown (Mobile Friendly Trigger) -->
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <button
                    class="size-9 rounded-xl bg-muted/40 flex items-center justify-center active:bg-muted transition-colors"
                    @click.stop
                  >
                    <Icon name="i-lucide-more-horizontal" class="size-5 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" class="w-56 p-1.5 rounded-2xl shadow-xl border-border/50">
                  <div class="px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Update State</div>
                  <DropdownMenuItem 
                    v-for="s in statuses" 
                    :key="s" 
                    class="rounded-xl px-3 py-2.5 text-xs font-semibold"
                    @click.stop="emit('update-status', item._id, s)"
                  >
                    <Icon name="i-lucide-check-circle-2" class="size-4 mr-2" :class="item.status === s ? 'text-primary' : 'text-muted-foreground/30'" />
                    Mark as {{ s }}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- Detail Sheet -->
    <Sheet v-model:open="showDetailSheet">
      <SheetContent class="sm:max-w-xl overflow-y-auto">
        <SheetHeader v-if="selectedItem">
          <div class="flex items-center gap-3 mb-1">
            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center ring-1 ring-primary/10">
              <span class="text-lg font-bold text-primary uppercase">
                {{ (selectedItem.name || selectedItem.email || '?').charAt(0) }}
              </span>
            </div>
            <div>
              <SheetTitle class="text-lg">{{ selectedItem.name || 'Unknown Contact' }}</SheetTitle>
              <SheetDescription>{{ selectedItem.formName }}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div v-if="selectedItem" class="mt-6 space-y-6">
          <!-- Quick Info -->
          <div class="grid grid-cols-2 gap-4">
            <div v-if="selectedItem.email" class="flex items-center gap-2 text-sm">
              <Icon name="i-lucide-mail" class="size-4 text-muted-foreground shrink-0" />
              <a :href="`mailto:${selectedItem.email}`" class="text-primary hover:underline truncate">{{ selectedItem.email }}</a>
            </div>
            <div v-if="selectedItem.phone" class="flex items-center gap-2 text-sm">
              <Icon name="i-lucide-phone" class="size-4 text-muted-foreground shrink-0" />
              <a :href="`tel:${selectedItem.phone}`" class="text-primary hover:underline">{{ selectedItem.phone }}</a>
            </div>
            <div v-if="selectedItem.address || selectedItem.city" class="flex items-start gap-2 text-sm col-span-2">
              <Icon name="i-lucide-map-pin" class="size-4 text-muted-foreground shrink-0 mt-0.5" />
              <span class="text-foreground">
                {{ [selectedItem.address, selectedItem.city, selectedItem.state, selectedItem.zip].filter(Boolean).join(', ') }}
              </span>
            </div>
          </div>

          <Separator />

          <!-- Status & Type -->
          <div class="flex items-center gap-3 flex-wrap">
            <span
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
              :class="typeColor(selectedItem.type)"
            >
              <Icon :name="typeIcon(selectedItem.type)" class="size-3.5" />
              {{ typeLabel(selectedItem.type) }}
            </span>
            <span
              class="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium capitalize"
              :class="statusColor(selectedItem.status)"
            >
              {{ selectedItem.status }}
            </span>
            <span class="text-xs text-muted-foreground ml-auto">
              Submitted {{ formatDate(selectedItem.dateSubmitted) }}
            </span>
          </div>

          <!-- Message -->
          <div v-if="selectedItem.message" class="space-y-2">
            <h4 class="text-sm font-medium text-foreground">Message</h4>
            <div class="rounded-lg bg-muted/30 p-4 text-sm text-foreground/80 leading-relaxed border border-border/50">
              {{ selectedItem.message }}
            </div>
          </div>

          <!-- All Fields -->
          <div v-if="selectedItem.fields && Object.keys(selectedItem.fields).length > 0" class="space-y-2">
            <h4 class="text-sm font-medium text-foreground">All Form Fields</h4>
            <div class="rounded-lg border border-border/50 overflow-hidden">
              <div
                v-for="(value, key) in selectedItem.fields"
                :key="String(key)"
                class="flex items-start gap-4 px-4 py-2.5 even:bg-muted/20 text-sm"
              >
                <span class="text-muted-foreground font-medium min-w-[120px] shrink-0">{{ key }}</span>
                <span class="text-foreground break-all">{{ value || '—' }}</span>
              </div>
            </div>
          </div>

          <!-- Related Submissions Section -->
          <div v-if="selectedItem.email" class="pt-2 space-y-4">
            <div class="flex items-center justify-between">
              <h4 class="text-sm font-bold text-foreground flex items-center gap-2">
                <Icon name="i-lucide-history" class="size-4 text-primary" />
                Submission History
              </h4>
              <span class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded">
                Found {{ relatedSubmissions.length + 1 }} total
              </span>
            </div>

            <div v-if="isLoadingRelated" class="space-y-3">
              <div v-for="i in 2" :key="i" class="h-16 rounded-xl bg-muted/40 animate-pulse" />
            </div>

            <div v-else-if="relatedSubmissions.length > 0" class="space-y-2">
              <div
                v-for="sub in relatedSubmissions"
                :key="sub._id"
                class="group relative flex flex-col gap-2 p-4 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/40 transition-all cursor-pointer"
                @click="viewDetails(sub)"
              >
                <div class="flex items-center justify-between gap-4">
                  <div class="flex items-center gap-2 min-w-0">
                    <span
                      class="shrink-0 w-2 h-2 rounded-full"
                      :class="sub.status === 'new' ? 'bg-blue-500' : 'bg-muted-foreground/30'"
                    />
                    <p class="text-sm font-semibold truncate">{{ sub.formName }}</p>
                  </div>
                  <span class="text-[10px] text-muted-foreground shrink-0 uppercase tracking-tighter tabular-nums">
                    {{ formatDateShort(sub.dateSubmitted) }}
                  </span>
                </div>
                
                <div class="flex items-center gap-3">
                  <span
                    class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold"
                    :class="typeColor(sub.type)"
                  >
                    <Icon :name="typeIcon(sub.type)" class="size-2.5" />
                    {{ typeLabel(sub.type) }}
                  </span>
                  <span class="text-[10px] text-muted-foreground truncate italic">
                    {{ sub.message ? `"${sub.message.substring(0, 60)}..."` : 'No message' }}
                  </span>
                </div>
                <Icon name="i-lucide-chevron-right" class="absolute right-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/0 group-hover:text-muted-foreground/50 transition-all" />
              </div>
            </div>

            <div v-else class="text-center py-6 rounded-xl border border-dashed text-muted-foreground">
              <p class="text-xs">No other records found for this email.</p>
            </div>
          </div>

          <!-- Metadata -->
          <div class="text-[10px] text-muted-foreground/40 space-y-1 pt-4 border-t">
            <p>GF Entry #{{ selectedItem.gfEntryId }} · Form ID #{{ selectedItem.gfFormId }}</p>
            <p v-if="selectedItem.ip">IP: {{ selectedItem.ip }}</p>
            <p v-if="selectedItem.sourceUrl">Source: {{ selectedItem.sourceUrl }}</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  </div>
</template>
