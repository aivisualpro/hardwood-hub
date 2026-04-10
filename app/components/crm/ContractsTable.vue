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
  if (!confirm('Are you sure you want to delete this contract?')) return
  try {
    await $fetch(`/api/contracts/detail/${id}`, { method: 'DELETE' })
    toast.success('Contract deleted')
    emit('refresh')
  } catch (e: any) {
    toast.error('Delete failed', { description: e?.message })
  }
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
  
  // 1. Merge the template content with the variables
  let mergedHTML = ct.content || ''
  
  if (ct.variableValues) {
    const t = props.templates.find((tt: any) => tt._id === ct.templateId) || {} as any
    for (const [key, val] of Object.entries<string>(ct.variableValues)) {
       const vDef = t?.variables?.find((v: any) => v.key === key)
       const isSig = vDef?.type === 'signature'
       
       let mergedVal = String(val || '')
       if (isSig && val) {
         mergedVal = `<img src="${val}" alt="Signature" style="max-height: 80px; object-fit: contain; vertical-align: middle;" />`
       }

       const re = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g')
       mergedHTML = mergedHTML.replace(re, mergedVal)
    }
  }

  const sysPrintDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  mergedHTML = mergedHTML.replace(/\{\{\s*printDate\s*\}\}/g, sysPrintDate)
  mergedHTML = mergedHTML.replace(/\{\{\s*company_name\s*\}\}/g, props.companyProfile?.name || '')

  mergedHTML = mergedHTML.replace(/<table[\s\S]*?<\/table>/gi, (tableHTML: string) => {
    if (tableHTML.includes('Signature') && tableHTML.includes('____')) return ''
    return tableHTML
  })
  mergedHTML = mergedHTML.replace(/\{\{\s*companySignature\s*\}\}/g, '')
  mergedHTML = mergedHTML.replace(/\{\{\s*company_signature\s*\}\}/g, '')
  mergedHTML = mergedHTML.replace(/\{\{\s*customerSignature\s*\}\}/g, '')
  mergedHTML = mergedHTML.replace(/\{\{\s*customerSignatureDate\s*\}\}/g, '')

  // Render variables text out of template boxes
  mergedHTML = mergedHTML.replace(/<span[^>]*class="[^"]*template-variable[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '$1')
  // Strip lines
  mergedHTML = mergedHTML.replace(/<hr\s*\/?>/gi, '')

  if (ct.customerSignature) {
     mergedHTML += `
      <div style="margin-top: 60px;">
        <div style="margin-bottom: 40px; width: 100%; max-width: 480px;">
          <div style="height: 64px;">
            <img src="${ct.customerSignature}" style="max-height: 64px; max-width: 100%; object-fit: contain; object-position: left bottom; margin: 0; display: block;" />
          </div>
          <div style="border-top: 1.5px solid #111827; margin-top: 4px; padding-top: 8px;">
            <div style="float: left; font-size: 15px; font-weight: 700; color: #111827; font-family: Helvetica, Arial, sans-serif; letter-spacing: -0.01em;">
              Client's Signature
            </div>
            <div style="float: right; font-size: 14px; font-weight: 400; color: #111827; font-family: Helvetica, Arial, sans-serif;">
              Date: ${ct.customerSignatureDate ? formatDate(ct.customerSignatureDate) : sysPrintDate}
            </div>
            <div style="clear: both;"></div>
          </div>
        </div>

        <div style="width: 100%; max-width: 480px;">
          <div style="height: 64px;">
            ${props.companyProfile?.signature ? `<img src="${props.companyProfile.signature}" style="max-height: 64px; max-width: 100%; object-fit: contain; object-position: left bottom; margin: 0; display: block;" />` : ``}
          </div>
          <div style="border-top: 1.5px solid #111827; margin-top: 4px; padding-top: 8px;">
            <div style="float: left; font-size: 15px; font-weight: 700; color: #111827; font-family: Helvetica, Arial, sans-serif; letter-spacing: -0.01em;">
              Contractor's Signature
            </div>
            <div style="float: right; font-size: 14px; font-weight: 400; color: #111827; font-family: Helvetica, Arial, sans-serif;">
              Date: ${sysPrintDate}
            </div>
            <div style="clear: both;"></div>
          </div>
        </div>
      </div>
     `
  }

  const printDate = new Date().toLocaleString()

  const docHTML = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Contract - ${ct.contractNumber}</title>
        <style>
          @page { margin: 20mm; size: letter; }
          body { 
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; 
            color: #111827; 
            line-height: 1.6;
            padding: 0;
            margin: 0;
            max-width: 800px;
            margin: 0 auto;
          }
          
          /* ── Letterhead ── */
          .letterhead {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            margin-bottom: 24px;
            padding-bottom: 24px;
            border-bottom: 2.5px solid ${props.companyProfile?.brandColor || '#1e3a8a'};
          }
          .letterhead img {
            max-height: 90px;
            max-width: 280px;
            object-fit: contain;
          }
          .letterhead-info {
            text-align: right;
            font-size: 11px;
            color: #4b5563;
          }
          .letterhead-info h2 {
            margin: 0 0 6px 0;
            font-size: 18px;
            font-weight: 800;
            color: ${props.companyProfile?.brandColor || '#1e3a8a'};
            letter-spacing: -0.02em;
          }
          .letterhead-info p {
            margin: 0 0 3px 0;
            font-weight: 500;
          }

          /* ── Main Content ── */
          .content {
            font-size: 13px;
          }
          .content h1, .content h2, .content h3 {
            color: #111827;
            margin-top: 1.5em;
            margin-bottom: 0.5em;
            font-weight: 700;
            letter-spacing: -0.01em;
          }
          .content p {
            margin-bottom: 1em;
          }
          
          /* ── Tables ── */
          table { width: 100%; border-collapse: collapse; margin: 1.5em 0; }
          th, td { border: 1px solid #d1d5db; padding: 10px 12px; text-align: left; font-size: 12px; }
          th { background: #f9fafb; font-weight: 600; color: #374151; }

          /* ── Footer ── */
          .doc-footer {
            margin-top: 48px;
            padding-top: 16px;
            border-top: 1.5px solid #d1d5db;
            font-size: 10px;
            color: #9ca3af;
            text-align: center;
            font-family: 'Helvetica Neue', Arial, sans-serif;
          }

          @media print {
            body { padding: 24px 36px; }
          }
        </style>
      </head>
      <body>
        <div class="letterhead">
          <div>
            ${props.companyProfile?.logo ? `<img src="${props.companyProfile.logo}" />` : ''}
          </div>
          <div class="letterhead-info">
            <h2>${props.companyProfile?.name || ''}</h2>
            <p>${props.companyProfile?.address || ''}</p>
            <p>${props.companyProfile?.city || ''}, ${props.companyProfile?.state || ''} ${props.companyProfile?.zip || ''}</p>
            <p>${props.companyProfile?.phone1 || ''}</p>
            <p>${props.companyProfile?.email || ''}</p>
            <p>${props.companyProfile?.website?.replace(/^https?:\/\//, '') || ''}</p>
            <p>License: ${props.companyProfile?.licenseNumber || ''}</p>
          </div>
        </div>
        <div class="content">
          ${mergedHTML}
        </div>

        <div class="doc-footer">
          ${props.companyProfile?.name || ''} &middot; Generated ${printDate} &middot; Contract #${ct.contractNumber || ''}
        </div>
      </body>
    </html>
  `

  // 3. Create a hidden iframe
  const iframe = document.createElement('iframe')
  iframe.style.position = 'absolute'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = 'none'
  document.body.appendChild(iframe)

  // 4. Write string to iframe document
  const doc = iframe.contentWindow?.document
  if (doc) {
    doc.open()
    doc.write(docHTML)
    doc.close()

    // 5. Trigger print after images load
    setTimeout(() => {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
      setTimeout(() => {
        document.body.removeChild(iframe)
        toast.dismiss()
        toast.success('Print dialog opened')
      }, 1000)
    }, 500) // Small delay to allow images to load
  } else {
    toast.error('Could not generate PDF')
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
      <div class="overflow-x-auto">
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
                      <!-- Timeline vertical line -->
                      <div class="absolute left-[11px] top-2 bottom-3 w-px bg-border/80"></div>

                      <!-- Created Node -->
                      <div class="flex items-start gap-4 relative z-10 w-full">
                        <div class="size-6 rounded-full flex items-center justify-center shrink-0 border-[3px] border-background bg-zinc-200 dark:bg-zinc-800 text-zinc-500 shadow-sm">
                          <Icon name="i-lucide-file-plus" class="size-3" />
                        </div>
                        <div class="flex-1 min-w-0 pt-0.5">
                          <p class="text-xs font-bold leading-none">Draft Created</p>
                          <p class="text-[10px] text-muted-foreground mt-1.5">{{ formatDate(ct.createdAt) }}</p>
                        </div>
                      </div>

                      <!-- Sent Node -->
                      <div class="flex items-start gap-4 relative z-10 w-full">
                        <div class="size-6 rounded-full flex items-center justify-center shrink-0 border-[3px] border-background transition-colors shadow-sm"
                          :class="ct.sentAt ? 'bg-blue-500 text-white' : 'bg-muted text-muted-foreground'">
                          <Icon :name="ct.sentAt ? 'i-lucide-send' : 'i-lucide-clock'" class="size-3" />
                        </div>
                        <div class="flex-1 min-w-0 pt-0.5">
                          <p class="text-xs font-bold leading-none" :class="{ 'text-muted-foreground': !ct.sentAt }">Sent for Signature</p>
                          <p class="text-[10px] text-muted-foreground mt-1.5">{{ ct.sentAt ? formatDate(ct.sentAt) : 'Pending' }}</p>
                        </div>
                      </div>

                      <!-- Signed Node -->
                      <div class="flex items-start gap-4 relative z-10 w-full">
                        <div class="size-6 rounded-full flex items-center justify-center shrink-0 border-[3px] border-background transition-colors shadow-sm"
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
                      ? 'text-emerald-500 hover:bg-emerald-500/10'
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
    </div>

    <!-- Send Email Modal -->
    <Dialog v-model:open="showSendEmailModal">
      <DialogContent class="max-w-md p-0 border-0 rounded-2xl overflow-hidden bg-background shadow-2xl">
        <div class="px-6 py-5 border-b border-border/50 bg-muted/20">
          <h2 class="text-lg font-bold flex items-center gap-2">
            <Icon name="i-lucide-mail" class="size-5 text-emerald-500" />
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
