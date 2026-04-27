<script setup lang="ts">
import { toast } from 'vue-sonner'

const props = defineProps<{
  contracts: any[]
  templates: any[]
  companyProfile: any
  isLoading?: boolean
}>()

const emit = defineEmits<{
  refresh: []
  edit: [contract: any]
}>()

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-zinc-500/15 text-zinc-500 border-zinc-500/30',
  pending: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  sent: 'bg-blue-500/15 text-blue-500 border-blue-500/30',
  signed: 'bg-primary/15 text-primary border-primary/30',
  completed: 'bg-green-500/15 text-green-600 border-green-500/30',
  cancelled: 'bg-red-500/15 text-red-500 border-red-500/30',
}

function formatDate(d: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Actions ─────────────────────────────────────────────

async function deleteContract(id: string) {
  toast.warning('Delete Contract?', {
    description: 'Are you sure you want to delete this contract? This action cannot be undone.',
    action: {
      label: 'Delete',
      onClick: async () => {
        try {
          await $fetch(`/api/contracts/detail/${id}`, { method: 'DELETE' })
          toast.success('Contract deleted')
          emit('refresh')
        } catch (e: any) {
          toast.error('Delete failed', { description: e?.message })
        }
      }
    },
    cancel: {
      label: 'Cancel',
      onClick: () => {}
    }
  })
}

const sendingEmailId = ref<string | null>(null)
const showSendEmailModal = ref(false)
const sendEmailContract = ref<any>(null)
const sendEmailAddress = ref('')

function openSendEmailModal(ct: any) {
  sendEmailContract.value = ct
  sendEmailAddress.value = ct.customerEmail || ''
  showSendEmailModal.value = true
}

async function confirmSendEmail() {
  const ct = sendEmailContract.value
  if (!ct) return
  if (!sendEmailAddress.value?.trim()) {
    toast.error('Please enter an email address')
    return
  }
  sendingEmailId.value = ct._id
  try {
    const res = await $fetch<{ success: boolean, message: string }>('/api/contracts/send-email', {
      method: 'POST',
      body: { contractId: ct._id, overrideEmail: sendEmailAddress.value.trim() },
    })
    toast.success('Email Sent!', { description: res.message })
    showSendEmailModal.value = false
    emit('refresh')
  } catch (e: any) {
    toast.error('Failed to send email', { description: e?.data?.message || e?.message })
  } finally {
    sendingEmailId.value = null
  }
}

async function downloadPDF(ct: any) {
  toast.loading('Generating Contract PDF...')

  try {
    const response = await fetch(`/api/contracts/download-pdf/${ct._id}`, {
      method: 'GET',
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(text || `Server returned ${response.status}`)
    }

    const contentType = response.headers.get('content-type') || ''

    // Large PDFs are returned as JSON with a Cloudinary URL (avoids CORS
    // problems that come from 302-redirecting to Cloudinary directly).
    if (contentType.includes('application/json')) {
      const data = await response.json() as { downloadUrl?: string; filename?: string }
      if (!data?.downloadUrl) {
        throw new Error('Server returned JSON without a downloadUrl')
      }

      // The HTML5 `download` attribute is ignored for cross-origin URLs, so
      // we rely on Cloudinary's `fl_attachment` flag in the URL to make the
      // server send Content-Disposition: attachment.
      // Re-fetching the file as a blob and creating an object URL avoids any
      // popup-blocker / cross-origin issues entirely — works in all browsers.
      toast.loading('Fetching large PDF...')
      const fileRes = await fetch(data.downloadUrl)
      if (!fileRes.ok) {
        throw new Error(`Failed to fetch PDF from Cloudinary: ${fileRes.status}`)
      }
      const fileBlob = await fileRes.blob()
      const fileObjUrl = URL.createObjectURL(fileBlob)

      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = fileObjUrl
      a.download = data.filename || `Contract_${ct.contractNumber}.pdf`
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

    // Small PDFs come back as a normal binary blob.
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.style.display = 'none'
    a.href = url
    a.download = `Contract_${ct.contractNumber}.pdf`
    document.body.appendChild(a)
    a.click()

    setTimeout(() => {
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.dismiss()
      toast.success('PDF downloaded successfully')
    }, 600)
  } catch (err: any) {
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
    
    <div v-else-if="!contracts?.length" class="flex flex-col items-center justify-center py-12 text-center border bg-card rounded-xl border-dashed">
      <Icon name="i-lucide-file-signature" class="size-8 text-muted-foreground mb-4" />
      <h3 class="font-bold text-lg mb-1">No contracts found</h3>
      <p class="text-sm text-muted-foreground mb-4">Get started by creating a new contract.</p>
    </div>

    <!-- Contracts Table -->
    <div v-else class="rounded-xl border border-border/50 bg-card overflow-hidden w-full">
      <!-- Desktop Table -->
      <div class="hidden lg:block overflow-x-auto">
        <table class="w-full text-left min-w-max">
          <thead>
            <tr class="border-b bg-muted/30">
              <th class="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Contract #</th>
              <th class="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Title</th>
              <th class="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Customer</th>
              <th class="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Email</th>
              <th class="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Phone</th>
              <th class="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Template</th>
              <th class="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Status</th>
              <th class="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Created</th>
              <th class="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-32 text-right" />
            </tr>
          </thead>
          <tbody class="divide-y divide-border/30">
            <tr
              v-for="ct in contracts"
              :key="ct._id"
              class="group hover:bg-muted/10 transition-colors"
            >
              <td class="px-4 py-3">
                <span class="text-xs font-mono font-bold text-primary">{{ ct.contractNumber }}</span>
              </td>
              <td class="px-4 py-3">
                <span class="text-sm font-semibold">{{ ct.title }}</span>
              </td>
              <td class="px-4 py-3">
                <div class="flex items-center gap-2">
                  <div class="size-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon name="i-lucide-user" class="size-3.5 text-primary" />
                  </div>
                  <span class="text-xs font-semibold">{{ ct.customerName || '—' }}</span>
                </div>
              </td>
              <td class="px-4 py-3">
                <span class="text-xs font-medium">{{ ct.customerEmail || '—' }}</span>
              </td>
              <td class="px-4 py-3">
                <span class="text-xs text-muted-foreground">{{ ct.customerPhone || '—' }}</span>
              </td>
              <td class="px-4 py-3">
                <span class="text-xs text-muted-foreground">{{ ct.templateName || '—' }}</span>
              </td>
              <td class="px-4 py-3">
                <HoverCard :open-delay="100" :close-delay="100">
                  <HoverCardTrigger as-child>
                    <span
                      class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold capitalize border cursor-help transition-transform hover:scale-105"
                      :class="STATUS_COLORS[ct.status] || STATUS_COLORS.draft"
                    >
                      {{ ct.status }}
                    </span>
                  </HoverCardTrigger>
                  <HoverCardContent class="w-64 p-4 z-[100] bg-background border border-primary/50 shadow-xl shadow-primary/5 rounded-xl" :side="'bottom'" :align="'start'">
                    <div class="mb-4">
                      <h4 class="text-sm font-bold leading-none">Contract Timeline</h4>
                    </div>
                    <div class="space-y-4 relative">
                      <!-- Timeline vertical line (Progress Bar) -->
                      <div class="absolute left-[11px] top-2 bottom-3 w-[2px] bg-muted/60 rounded-full"></div>
                      <div class="absolute left-[11px] top-2 w-[2px] bg-primary rounded-full transition-all duration-500"
                           :class="ct.customerSignatureDate ? 'bottom-3' : ct.sentAt ? 'bottom-[50%]' : 'h-0'"></div>

                      <!-- Created Node -->
                      <div class="flex items-start gap-4 relative z-10 w-full" :class="{ 'opacity-100': ct.createdAt, 'opacity-40': !ct.createdAt }">
                        <div class="size-6 rounded-full flex items-center justify-center shrink-0 border-[3px] border-background transition-colors shadow-sm"
                          :class="ct.createdAt ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'">
                          <Icon :name="ct.createdAt ? 'i-lucide-check' : 'i-lucide-file-plus'" class="size-3" />
                        </div>
                        <div class="flex-1 min-w-0 pt-0.5">
                          <p class="text-xs font-bold leading-none" :class="{ 'text-muted-foreground': !ct.createdAt }">Draft Created</p>
                          <p class="text-[10px] text-muted-foreground mt-1.5">{{ formatDate(ct.createdAt) }}</p>
                        </div>
                      </div>

                      <!-- Sent Node -->
                      <div class="flex items-start gap-4 relative z-10 w-full" :class="{ 'opacity-100': ct.sentAt, 'opacity-40': !ct.sentAt }">
                        <div class="size-6 rounded-full flex items-center justify-center shrink-0 border-[3px] border-background transition-colors shadow-sm"
                          :class="ct.sentAt ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'">
                          <Icon :name="ct.sentAt ? 'i-lucide-check' : 'i-lucide-send'" class="size-3" />
                        </div>
                        <div class="flex-1 min-w-0 pt-0.5">
                          <p class="text-xs font-bold leading-none" :class="{ 'text-muted-foreground': !ct.sentAt }">Sent for Signature</p>
                          <p class="text-[10px] text-muted-foreground mt-1.5">{{ ct.sentAt ? formatDate(ct.sentAt) : 'Pending' }}</p>
                        </div>
                      </div>

                      <!-- Signed Node -->
                      <div class="flex items-start gap-4 relative z-10 w-full" :class="{ 'opacity-100': ct.customerSignatureDate, 'opacity-40': !ct.customerSignatureDate }">
                        <div class="size-6 rounded-full flex items-center justify-center shrink-0 border-[3px] border-background transition-colors shadow-sm"
                          :class="ct.customerSignatureDate ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'">
                          <Icon :name="ct.customerSignatureDate ? 'i-lucide-check' : 'i-lucide-pen-line'" class="size-3" />
                        </div>
                        <div class="flex-1 min-w-0 pt-0.5">
                          <p class="text-xs font-bold leading-none" :class="{ 'text-muted-foreground': !ct.customerSignatureDate }">Client Signed</p>
                          <p class="text-[10px] text-muted-foreground mt-1.5">{{ ct.customerSignatureDate ? formatDate(ct.customerSignatureDate) : 'Awaiting Signature' }}</p>
                        </div>
                      </div>
                    </div>
                  </HoverCardContent>
                </HoverCard>
              </td>
              <td class="px-4 py-3">
                <span class="text-xs text-muted-foreground tabular-nums">{{ formatDate(ct.createdAt) }}</span>
              </td>
              <td class="px-4 py-3 text-right sticky right-0 bg-card group-hover:bg-muted/10 transition-colors">
                <div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button class="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title="Download PDF" @click.stop="downloadPDF(ct)">
                    <Icon name="i-lucide-download" class="size-3.5" />
                  </button>
                  <button
                    class="size-7 rounded-md flex items-center justify-center transition-colors"
                    :class="ct.status === 'sent' || ct.status === 'signed'
                      ? 'text-primary hover:bg-primary/10'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'"
                    :title="ct.status === 'signed' ? 'Already signed' : ct.status === 'sent' ? 'Resend email' : 'Send to client for signing'"
                    :disabled="sendingEmailId === ct._id"
                    @click.stop="openSendEmailModal(ct)"
                  >
                    <Icon v-if="sendingEmailId === ct._id" name="i-lucide-loader-circle" class="size-3.5 animate-spin" />
                    <Icon v-else-if="ct.status === 'signed'" name="i-lucide-mail-check" class="size-3.5" />
                    <Icon v-else-if="ct.status === 'sent'" name="i-lucide-mail-check" class="size-3.5" />
                    <Icon v-else name="i-lucide-send" class="size-3.5" />
                  </button>
                  <button class="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" title="Edit" @click.stop="emit('edit', ct)">
                    <Icon name="i-lucide-pencil" class="size-3.5" />
                  </button>
                  <button class="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" title="Delete" @click.stop="deleteContract(ct._id)">
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
        <div v-for="ct in contracts" :key="ct._id" class="border border-border/60 rounded-xl p-3.5 bg-card shadow-sm flex flex-col gap-3 relative">
          <div class="flex items-start justify-between gap-3">
            <div class="flex flex-col min-w-0 flex-1">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-[11px] font-mono font-bold text-primary">{{ ct.contractNumber }}</span>
                <HoverCard :open-delay="100" :close-delay="100">
                  <HoverCardTrigger as-child>
                    <span
                      class="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold capitalize border cursor-help"
                      :class="STATUS_COLORS[ct.status] || STATUS_COLORS.draft"
                    >
                      {{ ct.status }}
                    </span>
                  </HoverCardTrigger>
                  <HoverCardContent class="w-64 p-4 z-[100] bg-background border border-primary/50 shadow-xl rounded-xl" :side="'bottom'" :align="'start'">
                    <div class="mb-4">
                      <h4 class="text-sm font-bold leading-none">Contract Timeline</h4>
                    </div>
                    <div class="space-y-4 relative">
                      <div class="absolute left-[11px] top-2 bottom-3 w-[2px] bg-muted/60 rounded-full"></div>
                      <div class="absolute left-[11px] top-2 w-[2px] bg-primary rounded-full transition-all duration-500"
                           :class="ct.customerSignatureDate ? 'bottom-3' : ct.sentAt ? 'bottom-[50%]' : 'h-0'"></div>
                      <div class="flex items-start gap-4 relative z-10 w-full">
                        <div class="size-6 rounded-full flex items-center justify-center shrink-0 border-[3px] border-background bg-zinc-200 text-zinc-500 shadow-sm">
                          <Icon name="i-lucide-file-plus" class="size-3" />
                        </div>
                        <div class="flex-1 min-w-0 pt-0.5">
                          <p class="text-xs font-bold leading-none">Draft Created</p>
                          <p class="text-[10px] text-muted-foreground mt-1.5">{{ formatDate(ct.createdAt) }}</p>
                        </div>
                      </div>
                      <div class="flex items-start gap-4 relative z-10 w-full">
                        <div class="size-6 rounded-full flex items-center justify-center shrink-0 border-[3px] border-background shadow-sm"
                          :class="ct.sentAt ? 'bg-blue-500 text-white' : 'bg-muted text-muted-foreground'">
                          <Icon :name="ct.sentAt ? 'i-lucide-send' : 'i-lucide-clock'" class="size-3" />
                        </div>
                        <div class="flex-1 min-w-0 pt-0.5">
                          <p class="text-xs font-bold leading-none" :class="{ 'text-muted-foreground': !ct.sentAt }">Sent for Signature</p>
                          <p class="text-[10px] text-muted-foreground mt-1.5">{{ ct.sentAt ? formatDate(ct.sentAt) : 'Pending' }}</p>
                        </div>
                      </div>
                      <div class="flex items-start gap-4 relative z-10 w-full">
                        <div class="size-6 rounded-full flex items-center justify-center shrink-0 border-[3px] border-background shadow-sm"
                          :class="ct.customerSignatureDate ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'">
                          <Icon :name="ct.customerSignatureDate ? 'i-lucide-check-check' : 'i-lucide-pen-line'" class="size-3" />
                        </div>
                        <div class="flex-1 min-w-0 pt-0.5">
                          <p class="text-xs font-bold leading-none" :class="{ 'text-muted-foreground': !ct.customerSignatureDate }">Client Signed</p>
                          <p class="text-[10px] text-muted-foreground mt-1.5">{{ ct.customerSignatureDate ? formatDate(ct.customerSignatureDate) : 'Awaiting Signature' }}</p>
                        </div>
                      </div>
                    </div>
                  </HoverCardContent>
                </HoverCard>
              </div>
              <span class="text-sm font-bold text-foreground leading-tight truncate">{{ ct.title }}</span>
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
                :class="ct.status === 'sent' || ct.status === 'signed' ? 'bg-primary text-primary-foreground border-primary/20' : 'bg-background hover:bg-muted text-foreground'"
                :disabled="sendingEmailId === ct._id"
                @click.stop="openSendEmailModal(ct)"
              >
                <Icon v-if="sendingEmailId === ct._id" name="i-lucide-loader-circle" class="size-3.5 animate-spin" />
                <Icon v-else-if="ct.status === 'signed'" name="i-lucide-check-circle-2" class="size-3.5" />
                <Icon v-else-if="ct.status === 'sent'" name="i-lucide-mail-check" class="size-3.5" />
                <Icon v-else name="i-lucide-send" class="size-3.5" />
                Email
              </button>
            </div>
            <div class="flex gap-1.5 shrink-0">
              <button class="size-8 rounded-lg border bg-background flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors shadow-xs" @click.stop="emit('edit', ct)">
                <Icon name="i-lucide-pencil" class="size-3.5" />
              </button>
              <button class="size-8 rounded-lg border border-red-500/20 bg-red-500/5 flex items-center justify-center text-red-500 hover:bg-red-500/10 transition-colors shadow-xs" @click.stop="deleteContract(ct._id)">
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
            Send Contract via Email
          </h2>
          <p class="text-sm text-muted-foreground mt-1">
            Send <strong>{{ sendEmailContract?.title }}</strong> to client for electronic signature.
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
                They will receive a secure link to review and electronically sign this document.
              </p>
            </div>
          </div>
        </div>

        <div class="px-6 py-4 border-t border-border/50 bg-muted/20 flex justify-end gap-2">
          <Button variant="outline" @click="showSendEmailModal = false">Cancel</Button>
          <Button
            :disabled="!sendEmailAddress.trim() || sendingEmailId === sendEmailContract?._id"
            @click="confirmSendEmail"
            class="min-w-[120px]"
          >
            <Icon v-if="sendingEmailId === sendEmailContract?._id" name="i-lucide-loader-circle" class="mr-2 size-4 animate-spin" />
            <Icon v-else name="i-lucide-send" class="mr-2 size-4" />
            {{ sendingEmailId === sendEmailContract?._id ? 'Sending...' : 'Send Contract' }}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
