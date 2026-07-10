<script setup lang="ts">
import { toast } from 'vue-sonner'

const props = defineProps<{
  estimates: any[]
  templates: any[]
  companyProfile: any
  isLoading?: boolean
  compact?: boolean
}>()

const emit = defineEmits<{
  refresh: []
  edit: [estimate: any]
}>()

const router = useRouter()

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-zinc-500/15 text-zinc-500 border-zinc-500/30',
  sent: 'bg-blue-500/15 text-blue-500 border-blue-500/30',
  received: 'bg-indigo-500/15 text-indigo-600 border-indigo-500/30',
  approved: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
  change_request: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  declined: 'bg-red-500/15 text-red-500 border-red-500/30',
  completed: 'bg-green-500/15 text-green-600 border-green-500/30',
  cancelled: 'bg-red-500/15 text-red-500 border-red-500/30',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  received: 'Received',
  approved: 'Approved',
  change_request: 'Change Request',
  declined: 'Declined',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const STATUS_ICONS: Record<string, string> = {
  draft: 'i-lucide-file-plus',
  sent: 'i-lucide-send',
  received: 'i-lucide-eye',
  approved: 'i-lucide-check-circle-2',
  change_request: 'i-lucide-message-square-warning',
  declined: 'i-lucide-x-circle',
  completed: 'i-lucide-check',
  cancelled: 'i-lucide-ban',
}

function formatDateTime(d: string) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function getLatestTimelineAction(ct: any) {
  if (ct.statusTimeline && ct.statusTimeline.length > 0) {
    return ct.statusTimeline[ct.statusTimeline.length - 1].action
  }
  return ct.status || 'draft'
}

function formatDate(d: string) {
  if (!d)
    return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function displayTitle(title: string): string {
  return (title || '').replace(/^Ann Arbor Hardwoods\s+/i, '').trim()
}

function displayTemplateName(name: string): string {
  return (name || '').replace(/^Ann Arbor Hardwoods\s+/i, '').trim() || name || '—'
}

// ─── Actions ─────────────────────────────────────────────

async function deleteEstimate(id: string) {
  toast.warning('Delete Estimate?', {
    description: 'Are you sure you want to delete this estimate? This action cannot be undone.',
    action: {
      label: 'Delete',
      onClick: async () => {
        try {
          await $fetch(`/api/estimates/detail/${id}`, { method: 'DELETE' })
          toast.success('Estimate deleted')
          emit('refresh')
        }
        catch (e: any) {
          toast.error('Delete failed', { description: e?.message })
        }
      },
    },
    cancel: {
      label: 'Cancel',
      onClick: () => {},
    },
  })
}

const sendingEmailId = ref<string | null>(null)
const showSendEmailModal = ref(false)
const sendEmailEstimate = ref<any>(null)
const sendEmailAddress = ref('')

function openSendEmailModal(ct: any) {
  sendEmailEstimate.value = ct
  sendEmailAddress.value = ct.customerEmail || ''
  showSendEmailModal.value = true
}

async function confirmSendEmail() {
  const ct = sendEmailEstimate.value
  if (!ct)
    return
  if (!sendEmailAddress.value?.trim()) {
    toast.error('Please enter an email address')
    return
  }
  sendingEmailId.value = ct._id
  try {
    const res = await $fetch<{ success: boolean, message: string }>('/api/estimates/send-email', {
      method: 'POST',
      body: { estimateId: ct._id, overrideEmail: sendEmailAddress.value.trim() },
    })
    toast.success('Email Sent!', { description: res.message })
    showSendEmailModal.value = false
    emit('refresh')
  }
  catch (e: any) {
    toast.error('Failed to send email', { description: e?.data?.message || e?.message })
  }
  finally {
    sendingEmailId.value = null
  }
}

async function downloadPDF(ct: any) {
  toast.loading('Generating Estimate PDF...')

  try {
    const response = await fetch(`/api/estimates/download-pdf/${ct._id}`, {
      method: 'GET',
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(text || `Server returned ${response.status}`)
    }

    const contentType = response.headers.get('content-type') || ''

    if (contentType.includes('application/json')) {
      const data = await response.json() as { downloadUrl?: string, filename?: string }
      if (!data?.downloadUrl) {
        throw new Error('Server returned JSON without a downloadUrl')
      }

      toast.loading('Fetching large PDF...')
      const fileRes = await fetch(data.downloadUrl)
      if (!fileRes.ok) {
        throw new Error(`Failed to fetch PDF: ${fileRes.status}`)
      }
      const fileBlob = await fileRes.blob()
      const fileObjUrl = URL.createObjectURL(fileBlob)

      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = fileObjUrl
      a.download = data.filename || `Estimate_${ct.estimateNumber}.pdf`
      document.body.appendChild(a)
      a.click()
      setTimeout(() => {
        document.body.removeChild(a)
        URL.revokeObjectURL(fileObjUrl)
        toast.dismiss()
        toast.success('PDF downloaded successfully')
      }, 400)
      return
    }

    const blob = await response.blob()
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.style.display = 'none'
    a.href = url
    a.download = `Estimate_${ct.estimateNumber}.pdf`
    document.body.appendChild(a)
    a.click()

    setTimeout(() => {
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.dismiss()
      toast.success('PDF downloaded successfully')
    }, 600)
  }
  catch (err: any) {
    toast.dismiss()
    toast.error('Could not generate PDF', { description: err?.message || 'Server error' })
  }
}
</script>

<template>
  <div class="w-full relative">
    <div v-if="isLoading" class="space-y-4">
      <div v-for="i in 3" :key="i" class="h-16 bg-muted/40 rounded-xl animate-pulse" />
    </div>

    <div v-else-if="!estimates?.length" class="flex flex-col items-center justify-center py-12 text-center border bg-card rounded-xl border-dashed">
      <Icon name="i-lucide-file-text" class="size-8 text-muted-foreground mb-4" />
      <h3 class="font-bold text-lg mb-1">
        No estimates found
      </h3>
      <p class="text-sm text-muted-foreground mb-4">
        Get started by creating a new estimate.
      </p>
    </div>

    <!-- Estimates Table -->
    <div v-else class="rounded-xl border border-border/50 bg-card overflow-hidden w-full">
      <!-- Desktop Table -->
      <div class="hidden lg:block overflow-x-auto">
        <table class="w-full text-left min-w-max">
          <thead>
            <tr class="border-b bg-muted/30">
              <th class="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Estimate #
              </th>
              <th v-if="!compact" class="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Customer
              </th>
              <th v-if="!compact" class="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Project
              </th>
              <th v-if="!compact" class="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Title
              </th>
              <th v-if="!compact" class="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Email
              </th>
              <th v-if="!compact" class="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Phone
              </th>
              <th class="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Status
              </th>
              <th class="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Created
              </th>
              <th class="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-32 text-right" />
            </tr>
          </thead>
          <tbody class="divide-y divide-border/30">
            <tr
              v-for="ct in estimates"
              :key="ct._id"
              class="group hover:bg-muted/10 transition-colors cursor-pointer"
              @click="emit('edit', ct)"
            >
              <td class="px-4 py-3">
                <span class="text-xs font-mono font-bold text-primary">{{ ct.estimateNumber }}</span>
              </td>
              <td v-if="!compact" class="px-4 py-3">
                <div class="flex items-center gap-2">
                  <div class="size-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon name="i-lucide-user" class="size-3.5 text-primary" />
                  </div>
                  <span class="text-xs font-semibold">{{ ct.customerName || '—' }}</span>
                </div>
              </td>
              <td v-if="!compact" class="px-4 py-3">
                <span class="text-xs font-medium text-foreground/80">{{ ct.projectName || '—' }}</span>
              </td>
              <td v-if="!compact" class="px-4 py-3">
                <span class="text-sm font-semibold">{{ displayTitle(ct.title) }}</span>
              </td>
              <td v-if="!compact" class="px-4 py-3">
                <span class="text-xs font-medium">{{ ct.customerEmail || '—' }}</span>
              </td>
              <td v-if="!compact" class="px-4 py-3">
                <span class="text-xs text-muted-foreground">{{ ct.customerPhone || '—' }}</span>
              </td>
              <td class="px-4 py-3">
                <HoverCard :open-delay="100" :close-delay="100">
                  <HoverCardTrigger as-child>
                    <span
                      class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold capitalize border cursor-help transition-transform hover:scale-105"
                      :class="STATUS_COLORS[getLatestTimelineAction(ct)] || STATUS_COLORS.draft"
                    >
                      {{ STATUS_LABELS[getLatestTimelineAction(ct)] || getLatestTimelineAction(ct) }}
                    </span>
                  </HoverCardTrigger>
                  <HoverCardContent class="w-64 p-4 z-[100] bg-background border border-primary/50 shadow-xl shadow-primary/5 rounded-xl text-left" side="bottom" align="start">
                    <div class="mb-4">
                      <h4 class="text-sm font-bold leading-none">
                        Estimate Timeline
                      </h4>
                    </div>
                    <div class="space-y-4 relative">
                      <!-- Timeline vertical line -->
                      <div class="absolute left-[11px] top-2 bottom-3 w-[2px] bg-muted/60 rounded-full" />
                      
                      <!-- Timeline items -->
                      <div
                        v-for="(t, index) in (ct.statusTimeline ? [...ct.statusTimeline].reverse() : [{ action: 'draft', timestamp: ct.createdAt, performedBy: 'System' }])"
                        :key="index"
                        class="flex items-start gap-4 relative z-10 w-full"
                      >
                        <div
                          class="size-6 rounded-full flex items-center justify-center shrink-0 border-[3px] border-background transition-colors shadow-sm"
                          :class="t.timestamp ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'"
                        >
                          <Icon :name="STATUS_ICONS[t.action] || 'i-lucide-circle'" class="size-3" />
                        </div>
                        <div class="flex-1 min-w-0 pt-0.5">
                          <p class="text-xs font-bold leading-none capitalize">
                            {{ STATUS_LABELS[t.action] || t.action }}
                          </p>
                          <p class="text-[10px] text-muted-foreground mt-1">
                            By: {{ t.performedBy || 'System' }}
                          </p>
                          <p v-if="t.sentToEmail" class="text-[9px] text-primary/80 truncate font-medium">
                            To: {{ t.sentToEmail }}
                          </p>
                          <p v-if="t.message" class="text-[9px] italic text-muted-foreground mt-1 line-clamp-2">
                            "{{ t.message }}"
                          </p>
                          <p class="text-[9px] text-muted-foreground/80 mt-1">
                            {{ formatDateTime(t.timestamp) }}
                          </p>
                        </div>
                      </div>
                    </div>
                  </HoverCardContent>
                </HoverCard>
              </td>
              <td class="px-4 py-3">
                <span class="text-xs text-muted-foreground tabular-nums">{{ formatDate(ct.createdAt) }}</span>
              </td>
              <td class="px-4 py-3 text-right">
                <div class="flex items-center justify-end gap-1">
                  <button class="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title="Download PDF" @click.stop="downloadPDF(ct)">
                    <Icon name="i-lucide-download" class="size-3.5" />
                  </button>
                  <button
                    class="size-7 rounded-md flex items-center justify-center transition-colors"
                    :class="ct.status === 'sent'
                      ? 'text-primary hover:bg-primary/10'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'"
                    :title="ct.status === 'sent' ? 'Resend email' : 'Send to client'"
                    :disabled="sendingEmailId === ct._id"
                    @click.stop="openSendEmailModal(ct)"
                  >
                    <Icon v-if="sendingEmailId === ct._id" name="i-lucide-loader-circle" class="size-3.5 animate-spin" />
                    <Icon v-else-if="ct.status === 'sent'" name="i-lucide-mail-check" class="size-3.5" />
                    <Icon v-else name="i-lucide-send" class="size-3.5" />
                  </button>
                  <button class="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" title="Edit" @click.stop="emit('edit', ct)">
                    <Icon name="i-lucide-pencil" class="size-3.5" />
                  </button>
                  <button class="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" title="Delete" @click.stop="deleteEstimate(ct._id)">
                    <Icon name="i-lucide-trash-2" class="size-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Mobile/Tablet Card View -->
      <div class="block lg:hidden p-3 space-y-3 bg-muted/20">
        <div v-for="ct in estimates" :key="ct._id" class="border border-border/60 rounded-xl p-3.5 bg-card shadow-sm flex flex-col gap-3 relative cursor-pointer hover:border-primary/30 transition-colors" @click="emit('edit', ct)">
          <div class="flex items-start justify-between gap-3">
            <div class="flex flex-col min-w-0 flex-1">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-[11px] font-mono font-bold text-primary">{{ ct.estimateNumber }}</span>
                <HoverCard :open-delay="100" :close-delay="100">
                  <HoverCardTrigger as-child>
                    <span
                      class="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold capitalize border cursor-help"
                      :class="STATUS_COLORS[getLatestTimelineAction(ct)] || STATUS_COLORS.draft"
                    >
                      {{ STATUS_LABELS[getLatestTimelineAction(ct)] || getLatestTimelineAction(ct) }}
                    </span>
                  </HoverCardTrigger>
                  <HoverCardContent class="w-64 p-4 z-[100] bg-background border border-primary/50 shadow-xl shadow-primary/5 rounded-xl text-left" side="bottom" align="start">
                    <div class="mb-4">
                      <h4 class="text-sm font-bold leading-none">
                        Estimate Timeline
                      </h4>
                    </div>
                    <div class="space-y-4 relative">
                      <!-- Timeline vertical line -->
                      <div class="absolute left-[11px] top-2 bottom-3 w-[2px] bg-muted/60 rounded-full" />
                      
                      <!-- Timeline items -->
                      <div
                        v-for="(t, index) in (ct.statusTimeline ? [...ct.statusTimeline].reverse() : [{ action: 'draft', timestamp: ct.createdAt, performedBy: 'System' }])"
                        :key="index"
                        class="flex items-start gap-4 relative z-10 w-full"
                      >
                        <div
                          class="size-6 rounded-full flex items-center justify-center shrink-0 border-[3px] border-background transition-colors shadow-sm"
                          :class="t.timestamp ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'"
                        >
                          <Icon :name="STATUS_ICONS[t.action] || 'i-lucide-circle'" class="size-3" />
                        </div>
                        <div class="flex-1 min-w-0 pt-0.5">
                          <p class="text-xs font-bold leading-none capitalize">
                            {{ STATUS_LABELS[t.action] || t.action }}
                          </p>
                          <p class="text-[10px] text-muted-foreground mt-1">
                            By: {{ t.performedBy || 'System' }}
                          </p>
                          <p v-if="t.sentToEmail" class="text-[9px] text-primary/80 truncate font-medium">
                            To: {{ t.sentToEmail }}
                          </p>
                          <p v-if="t.message" class="text-[9px] italic text-muted-foreground mt-1 line-clamp-2">
                            "{{ t.message }}"
                          </p>
                          <p class="text-[9px] text-muted-foreground/80 mt-1">
                            {{ formatDateTime(t.timestamp) }}
                          </p>
                        </div>
                      </div>
                    </div>
                  </HoverCardContent>
                </HoverCard>
              </div>
              <span class="text-sm font-bold text-foreground leading-tight truncate">{{ displayTitle(ct.title) }}</span>
            </div>
            <div class="text-right flex flex-col items-end shrink-0 pt-0.5">
              <span class="text-[10px] text-muted-foreground uppercase font-bold tracking-wide">Created</span>
              <span class="text-xs font-medium">{{ formatDate(ct.createdAt) }}</span>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3 bg-muted/30 p-2.5 rounded-lg border border-border/40">
            <div class="flex flex-col min-w-0">
              <span class="text-[10px] text-muted-foreground uppercase font-bold mb-0.5 flex items-center gap-1"><Icon name="i-lucide-user" class="size-3 pl-0.5 text-primary" /> Customer</span>
              <span class="text-xs font-bold truncate">{{ ct.customerName || '—' }}</span>
              <span class="text-[11px] text-muted-foreground truncate">{{ ct.customerEmail || ct.customerPhone || '—' }}</span>
            </div>
            <div class="flex flex-col min-w-0">
              <span class="text-[10px] text-muted-foreground uppercase font-bold mb-0.5">Template</span>
              <span class="text-xs font-medium truncate pt-px">{{ ct.templateName || '—' }}</span>
            </div>
          </div>

          <div class="pt-2 flex justify-between gap-2 mt-0.5">
            <div class="flex gap-2 flex-1">
              <button class="flex-1 h-8 rounded-lg border bg-background font-medium focus:ring-1 hover:bg-muted text-foreground text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs" @click.stop="downloadPDF(ct)">
                <Icon name="i-lucide-file-text" class="size-3.5 text-muted-foreground" /> PDF
              </button>
              <button
                class="flex-1 h-8 rounded-lg border font-medium text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                :class="ct.status === 'sent' ? 'bg-primary text-primary-foreground border-primary/20' : 'bg-background hover:bg-muted text-foreground'"
                :disabled="sendingEmailId === ct._id"
                @click.stop="openSendEmailModal(ct)"
              >
                <Icon v-if="sendingEmailId === ct._id" name="i-lucide-loader-circle" class="size-3.5 animate-spin" />
                <Icon v-else-if="ct.status === 'sent'" name="i-lucide-mail-check" class="size-3.5" />
                <Icon v-else name="i-lucide-send" class="size-3.5" />
                Email
              </button>
            </div>
            <div class="flex gap-1.5 shrink-0">
              <button class="size-8 rounded-lg border bg-background flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors shadow-xs" @click.stop="emit('edit', ct)">
                <Icon name="i-lucide-pencil" class="size-3.5" />
              </button>
              <button class="size-8 rounded-lg border border-red-500/20 bg-red-500/5 flex items-center justify-center text-red-500 hover:bg-red-500/10 transition-colors shadow-xs" @click.stop="deleteEstimate(ct._id)">
                <Icon name="i-lucide-trash-2" class="size-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Send Email Modal -->
    <Dialog v-model:open="showSendEmailModal">
      <DialogContent class="max-w-md p-0 border-0 rounded-2xl overflow-hidden bg-background shadow-2xl">
        <div class="px-6 py-5 border-b border-border/50 bg-muted/20">
          <h2 class="text-lg font-bold flex items-center gap-2">
            <Icon name="i-lucide-mail" class="size-5 text-primary" />
            Send Estimate via Email
          </h2>
          <p class="text-sm text-muted-foreground mt-1">
            Send <strong>{{ displayTitle(sendEmailEstimate?.title) }}</strong> to client for review.
          </p>
        </div>

        <div class="p-6">
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-semibold mb-1.5">Recipient Email Address</label>
              <Input
                v-model="sendEmailAddress"
                type="email"
                placeholder="client@example.com"
                class="h-10"
                @keyup.enter="confirmSendEmail"
              />
              <p class="text-xs text-muted-foreground mt-1.5">
                They will receive a link to download this estimate document.
              </p>
            </div>
          </div>
        </div>

        <div class="px-6 py-4 border-t border-border/50 bg-muted/20 flex justify-end gap-2">
          <Button variant="outline" @click="showSendEmailModal = false">
            Cancel
          </Button>
          <Button
            :disabled="!sendEmailAddress.trim() || sendingEmailId === sendEmailEstimate?._id"
            class="min-w-[120px]"
            @click="confirmSendEmail"
          >
            <Icon v-if="sendingEmailId === sendEmailEstimate?._id" name="i-lucide-loader-circle" class="mr-2 size-4 animate-spin" />
            <Icon v-else name="i-lucide-send" class="mr-2 size-4" />
            {{ sendingEmailId === sendEmailEstimate?._id ? 'Sending...' : 'Send Estimate' }}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
