<script setup lang="ts">
definePageMeta({ layout: false, auth: false, colorMode: 'light' })

const route = useRoute()
const token = route.params.token as string

const loading = ref(true)
const submitting = ref(false)
const contractData = ref<any>(null)
const error = ref('')
const signed = ref(false)
const signature = ref('')
const clientValues = ref<Record<string, string>>({})

// Inline fields and Modal state
const renderedContractHtml = ref('')
const isSigModalOpen = ref(false)
const activeSigKey = ref('')
const activeSigLabel = ref('')
const tempSigValue = ref('')

async function fetchContract() {
  loading.value = true
  error.value = ''
  try {
    const res = await $fetch<{ success: boolean, data: any }>(`/api/contracts/sign/${token}`)
    contractData.value = res.data
    
    // Initialize client values if variables exist
    if (res.data.clientVariables) {
      for (const v of res.data.clientVariables) {
        clientValues.value[v.key] = res.data.variableValues?.[v.key] || v.defaultValue || ''
      }
    }

    if (res.data.alreadySigned) {
      signed.value = true
    }

    generateContractHtml()
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || 'Failed to load contract'
  } finally {
    loading.value = false
  }
}

/**
 * Build the contract HTML once. We do NOT use a computed property bound to clientValues,
 * because typing in the inputs would trigger a full v-html re-render and lose input focus!
 */
function generateContractHtml() {
  if (!contractData.value?.content) {
    renderedContractHtml.value = ''
    return
  }
  let html = contractData.value.content as string
  const vars = contractData.value.clientVariables as any[] | undefined
  if (!vars?.length) {
    renderedContractHtml.value = html
    return
  }

  for (const v of vars) {
    const escaped = v.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = new RegExp(`\\{\\{\\s*${escaped}\\s*\\}\\}`, 'g')
    const label = (v.label || v.key).replace(/"/g, '&quot;')

    let replacement: string
    if (v.type === 'signature') {
      const currentSig = clientValues.value[v.key]
      if (currentSig && currentSig.startsWith('data:image')) {
        replacement = `<img src="${currentSig}" class="inline-sig-image" data-var-key="${v.key}" data-var-label="${label}" alt="${label} Signature" title="Click to resign" />`
      } else {
        const reqClass = v.required ? 'required-sig' : ''
        replacement = `<button type="button" class="inline-sig-button ${reqClass}" data-var-key="${v.key}" data-var-label="${label}">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-1.5"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>
          Click to sign ${v.required ? '*' : ''}
        </button>`
      }
    } else {
      const inputType = v.type === 'date' ? 'date' : v.type === 'number' ? 'number' : 'text'
      const prefix = v.type === 'currency' ? '<span class="inline-field-prefix">$</span>' : ''
      const placeholder = v.type === 'date' ? '' : label
      const val = (clientValues.value[v.key] || '').replace(/"/g, '&quot;')
      const req = v.required ? 'required' : ''
      replacement = `<span class="inline-field-wrapper">${prefix}<input type="${inputType}" class="inline-client-field" data-var-key="${v.key}" placeholder="${placeholder}" value="${val}" ${req} /></span>`
    }

    html = html.replace(pattern, replacement)
  }
  renderedContractHtml.value = html
}
function onContractInput(e: Event) {
  const target = e.target as HTMLElement
  if (target?.classList?.contains('inline-client-field')) {
    const key = target.getAttribute('data-var-key')
    if (key) {
      clientValues.value[key] = (target as HTMLInputElement).value
    }
  }
}

function onContractClick(e: MouseEvent) {
  const target = (e.target as HTMLElement).closest('.inline-sig-button, .inline-sig-image')
  if (target) {
    const key = target.getAttribute('data-var-key')
    const label = target.getAttribute('data-var-label')
    if (key) {
      activeSigKey.value = key
      activeSigLabel.value = label || key
      tempSigValue.value = clientValues.value[key] || ''
      isSigModalOpen.value = true
    }
  }
}

function saveInlineSignature() {
  if (activeSigKey.value) {
    clientValues.value[activeSigKey.value] = tempSigValue.value
    // Re-render HTML so the button turns into the signature image
    generateContractHtml()
  }
  isSigModalOpen.value = false
}

async function submitSignature() {
  if (!signature.value) return
  
  // Validate required client variables
  if (contractData.value?.clientVariables) {
    for (const v of contractData.value.clientVariables) {
      if (v.required && !clientValues.value[v.key]) {
        alert(`Please fill out the required field: ${v.label || v.key}`)
        return
      }
    }
  }

  submitting.value = true
  try {
    await $fetch(`/api/contracts/sign/${token}`, {
      method: 'POST',
      body: { 
        signature: signature.value,
        clientValues: clientValues.value
      },
    })
    signed.value = true
  } catch (e: any) {
    error.value = e?.data?.message || 'Failed to submit signature'
  } finally {
    submitting.value = false
  }
}

onMounted(fetchContract)
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
    <!-- Loading -->
    <div v-if="loading" class="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div class="mb-8 flex items-start justify-between gap-4 animate-pulse">
        <div>
          <div class="flex items-center gap-2 mb-3">
            <div class="size-8 rounded-lg bg-slate-200"></div>
            <div class="h-3 w-32 bg-slate-200 rounded"></div>
          </div>
          <div class="h-6 sm:h-8 w-64 sm:w-96 bg-slate-200 rounded mb-3"></div>
          <div class="h-4 w-48 bg-slate-200 rounded"></div>
        </div>
        <div class="h-16 sm:h-20 w-32 sm:w-48 bg-slate-200 rounded"></div>
      </div>
      <div class="bg-white/50 rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-8 p-6 sm:p-8 animate-pulse">
        <div class="space-y-4">
          <div class="h-4 w-full bg-slate-100 rounded"></div>
          <div class="h-4 w-[90%] bg-slate-100 rounded"></div>
          <div class="h-4 w-[95%] bg-slate-100 rounded"></div>
          <div class="h-4 w-[80%] bg-slate-100 rounded"></div>
          <div class="w-full h-px bg-slate-100 my-6"></div>
          <div class="h-4 w-full bg-slate-100 rounded"></div>
          <div class="h-4 w-[85%] bg-slate-100 rounded"></div>
          <div class="h-4 w-[75%] bg-slate-100 rounded"></div>
        </div>
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="error && !contractData" class="flex items-center justify-center min-h-screen px-4">
      <div class="max-w-md w-full text-center">
        <div class="size-16 mx-auto mb-4 rounded-2xl bg-red-50 flex items-center justify-center">
          <svg class="size-8 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        </div>
        <h1 class="text-xl font-bold text-slate-900 mb-2">Unable to Load Contract</h1>
        <p class="text-sm text-slate-500">{{ error }}</p>
      </div>
    </div>

    <!-- Success -->
    <div v-else-if="signed" class="flex items-center justify-center min-h-screen px-4">
      <div class="max-w-md w-full text-center">
        <div class="size-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-xl shadow-emerald-500/25">
          <svg class="size-10 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h1 class="text-2xl font-bold text-slate-900 mb-2">Contract Signed!</h1>
        <p class="text-sm text-slate-500 mb-6">
          Thank you, <strong>{{ contractData?.customerName }}</strong>. Your signature has been recorded for 
          <strong>{{ contractData?.title }}</strong>.
        </p>
        <p class="text-xs text-slate-400">You may close this page.</p>
      </div>
    </div>

    <!-- Contract View + Signing -->
    <div v-else-if="contractData" class="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">

      <!-- Document View -->
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-8">
        
        <!-- Letterhead Header -->
        <div class="p-6 sm:p-10 border-b-2 border-emerald-900 flex flex-col sm:flex-row justify-between items-start gap-8 bg-white">
          <div class="shrink-0 flex items-center self-stretch h-28">
            <template v-if="contractData.company?.logo">
              <img :src="contractData.company.logo" alt="Company Logo" class="max-h-28 max-w-[320px] object-contain object-left" />
            </template>
            <template v-else>
              <h1 class="text-3xl font-black text-slate-900" :style="{ color: contractData.company?.brandColor || '#065f46' }">{{ contractData.company?.name || 'Company Name' }}</h1>
            </template>
          </div>
          
          <div class="text-right text-[13px] text-amber-900/80 leading-relaxed font-bold font-sans self-center">
            <div class="text-lg font-black mb-1" :style="{ color: contractData.company?.brandColor || '#84cc16' }">
              {{ contractData.company?.name || 'Company Name' }}
            </div>
            <div>{{ contractData.company?.address || 'Address' }}</div>
            <div>{{ contractData.company?.city || 'City' }}, {{ contractData.company?.state || 'State' }} {{ contractData.company?.zip || 'Zip' }}</div>
            <div v-if="contractData.company?.phone1 || contractData.company?.phone">Phone: {{ contractData.company?.phone1 || contractData.company?.phone }}</div>
            <div v-if="contractData.company?.phone2">Phone: {{ contractData.company?.phone2 }}</div>
            <div class="text-amber-900/90">{{ contractData.company?.website?.replace(/^https?:\/\//, '') || 'Website' }}</div>
            <div class="text-amber-900/90">{{ contractData.company?.email || 'Email' }}</div>
            <div v-if="contractData.company?.licenseNumber">Builder's License Number: {{ contractData.company?.licenseNumber }}</div>
          </div>
        </div>

        <!-- Contract Title -->
        <div class="px-6 sm:px-10 pt-8 pb-4 bg-white flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
          <div>
            <h2 class="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">{{ contractData.title }}</h2>
          </div>
          <div class="text-right shrink-0">
             <div class="inline-flex px-3 py-1 bg-emerald-100 text-emerald-800 rounded font-bold uppercase tracking-wider text-[10px] mb-2">Contract For Signature</div>
             <p class="text-sm font-bold text-slate-500">Document #{{ contractData.contractNumber }}</p>
          </div>
        </div>

        <!-- Contract Content — client variables rendered INLINE -->
        <div
          class="contract-content px-6 sm:px-10 pb-8 text-slate-800 font-medium"
          v-html="renderedContractHtml"
          @input="onContractInput"
          @click="onContractClick"
        />



        <!-- Contractor Signature -->
        <div class="px-6 sm:px-10 pb-12 pt-4 flex justify-end">
           <div class="w-full sm:w-1/2 flex flex-col items-start relative">
              <div class="h-14 w-full flex items-end relative -mb-1">
                 <img v-if="contractData.company?.signature" :src="contractData.company.signature" class="max-h-16 object-contain z-10 block" />
              </div>
              <div class="border-t-[1.5px] border-slate-900 w-full pt-2 flex justify-between">
                 <p class="text-xs font-bold text-slate-900 font-sans">Contractor's Signature</p>
                 <div class="text-xs font-medium text-slate-800 tabular-nums">Date: {{ new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric'}) }}</div>
              </div>
           </div>
        </div>
      </div>

      <!-- Client Signature Section -->
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="px-6 sm:px-8 py-5 border-b border-slate-100 bg-slate-50/50">
          <h2 class="text-base font-bold text-slate-900 flex items-center gap-2">
            <svg class="size-5 text-emerald-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
            Please Sign Below
          </h2>
          <p class="text-xs text-slate-500 mt-1">Draw your signature in the box below to sign this contract.</p>
        </div>
        <div class="p-6 sm:p-8">
          <SignaturePad v-model="signature" class="w-full bg-white border-2 border-dashed border-slate-200 rounded-xl" style="min-height: 160px;" />
          <div class="flex items-center justify-between mt-6 pt-6 border-t border-slate-100">
            <p class="text-xs text-slate-400">
              By signing, you agree to the terms outlined in this contract.
            </p>
            <button
              :disabled="!signature || submitting"
              class="inline-flex items-center gap-2 h-11 px-8 rounded-xl text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              :class="signature ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 hover:scale-[1.02]' : 'bg-slate-100 text-slate-400'"
              @click="submitSignature"
            >
              <svg v-if="submitting" class="size-4 animate-spin" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              <svg v-else class="size-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              {{ submitting ? 'Submitting...' : 'Submit Signature' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="text-center mt-8">
        <p class="text-xs text-slate-400">
          {{ contractData.company?.name || '' }} · {{ contractData.company?.phone1 || '' }} · {{ contractData.company?.email || '' }}
        </p>
      </div>
    </div>

    <!-- Inline Signature Modal -->
    <Teleport to="body">
      <div v-if="isSigModalOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
          <div class="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 class="font-bold text-slate-900">Sign: {{ activeSigLabel }}</h3>
            <button @click="isSigModalOpen = false" class="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors">
              <svg class="size-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div class="p-6">
            <SignaturePad v-model="tempSigValue" class="w-full bg-white border-2 border-dashed border-slate-200 rounded-xl" style="height: 200px;" />
          </div>
          <div class="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
            <button @click="isSigModalOpen = false" class="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-lg transition-colors">Cancel</button>
            <button @click="saveInlineSignature" class="px-5 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors" :disabled="!tempSigValue">
              Save Signature
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.contract-content :deep(p) {
  font-size: 0.9rem;
  line-height: 1.75;
  margin-bottom: 0.85rem;
  color: #1e293b;
}

.contract-content :deep(h1),
.contract-content :deep(h2),
.contract-content :deep(h3),
.contract-content :deep(h4) {
  font-weight: 700;
  color: #0f172a;
  margin-top: 1.5rem;
  margin-bottom: 0.5rem;
  line-height: 1.3;
}

.contract-content :deep(h1) { font-size: 1.4rem; }
.contract-content :deep(h2) { font-size: 1.2rem; }
.contract-content :deep(h3) { font-size: 1rem; }

.contract-content :deep(strong) {
  font-weight: 700;
  color: #0f172a;
}

.contract-content :deep(ul),
.contract-content :deep(ol) {
  padding-left: 1.5rem;
  margin-bottom: 0.85rem;
}

.contract-content :deep(ul) { list-style-type: disc; }
.contract-content :deep(ol) { list-style-type: decimal; }

.contract-content :deep(li) {
  font-size: 0.9rem;
  line-height: 1.7;
  color: #1e293b;
  margin-bottom: 0.25rem;
}

.contract-content :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
  font-size: 0.875rem;
}

.contract-content :deep(th),
.contract-content :deep(td) {
  border: 1px solid #e2e8f0;
  padding: 0.5rem 0.75rem;
  text-align: left;
}

.contract-content :deep(th) {
  background: #f8fafc;
  font-weight: 600;
}

.contract-content :deep(a) {
  color: #059669;
  text-decoration: underline;
}

.contract-content :deep(blockquote) {
  border-left: 4px solid #10b981;
  padding: 0.5rem 1rem;
  margin: 1rem 0;
  font-style: italic;
  color: #475569;
  background: #f0fdf4;
  border-radius: 0 0.5rem 0.5rem 0;
}

.contract-content :deep(hr) {
  border-top: 1.5px solid #e2e8f0;
  margin: 1.25rem 0;
}

/* ─── Inline Client Variable Fields ─── */
.contract-content :deep(.inline-field-wrapper) {
  display: inline-flex;
  align-items: center;
  position: relative;
}

.contract-content :deep(.inline-field-prefix) {
  position: absolute;
  left: 4px;
  font-size: 0.85rem;
  font-weight: 600;
  color: #64748b;
  z-index: 1;
  pointer-events: none;
}

.contract-content :deep(.inline-client-field) {
  display: inline-block;
  min-width: 160px;
  max-width: 320px;
  font-size: 0.875rem;
  font-weight: 600;
  color: #0f172a;
  background: #f0fdf4;
  border: none;
  border-bottom: 2px solid #10b981;
  padding: 3px 6px;
  margin: 0 2px;
  outline: none;
  transition: all 0.15s ease;
  font-family: inherit;
  border-radius: 2px 2px 0 0;
}

.contract-content :deep(.inline-client-field:focus) {
  background: #ecfdf5;
  border-bottom-color: #059669;
  box-shadow: 0 2px 0 0 #059669;
}

.contract-content :deep(.inline-client-field::placeholder) {
  color: #10b981;
  font-weight: 500;
  font-style: italic;
  opacity: 0.7;
}

.contract-content :deep(.inline-client-field[type="date"]) {
  min-width: 140px;
}

.contract-content :deep(.inline-field-wrapper:has(.inline-field-prefix) .inline-client-field) {
  padding-left: 18px;
}

/* ─── Inline Signature Elements ─── */
.contract-content :deep(.inline-sig-button) {
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
  padding: 4px 12px;
  margin: 0 4px;
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 700;
  color: #475569;
  cursor: pointer;
  transition: all 0.2s ease;
}

.contract-content :deep(.inline-sig-button:hover) {
  background: #f0fdf4;
  border-color: #10b981;
  color: #059669;
  transform: translateY(-1px);
}

.contract-content :deep(.inline-sig-button.required-sig) {
  border-color: #fca5a5;
  color: #ef4444;
  background: #fef2f2;
}

.contract-content :deep(.inline-sig-button.required-sig:hover) {
  border-color: #ef4444;
}

.contract-content :deep(.inline-sig-image) {
  display: inline-block;
  vertical-align: middle;
  max-height: 48px;
  max-width: 160px;
  object-fit: contain;
  margin: 0 4px;
  border-bottom: 1.5px solid #10b981;
  cursor: pointer;
  padding-bottom: 2px;
  transition: opacity 0.2s ease;
}

.contract-content :deep(.inline-sig-image:hover) {
  opacity: 0.8;
}

.contract-content :deep(.inline-sig-field) {
  display: inline-block;
  min-width: 200px;
  height: 3px;
  border-bottom: 2px dashed #10b981;
  margin: 0 4px;
  vertical-align: middle;
}
</style>
