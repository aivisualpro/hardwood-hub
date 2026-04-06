<script setup lang="ts">
definePageMeta({ layout: false, auth: false })

const route = useRoute()
const token = route.params.token as string

const loading = ref(true)
const submitting = ref(false)
const contractData = ref<any>(null)
const error = ref('')
const signed = ref(false)
const signature = ref('')

async function fetchContract() {
  loading.value = true
  error.value = ''
  try {
    const res = await $fetch<{ success: boolean, data: any }>(`/api/contracts/sign/${token}`)
    contractData.value = res.data
    if (res.data.alreadySigned) {
      signed.value = true
    }
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || 'Failed to load contract'
  } finally {
    loading.value = false
  }
}

async function submitSignature() {
  if (!signature.value) return
  submitting.value = true
  try {
    await $fetch(`/api/contracts/sign/${token}`, {
      method: 'POST',
      body: { signature: signature.value },
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

    <!-- Success (Already signed or just signed) -->
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

      <!-- Header -->
      <div class="mb-8 flex items-start justify-between gap-4">
        <div>
          <div class="flex items-center gap-2 mb-2">
            <div class="size-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <svg class="size-4 text-emerald-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>
            </div>
            <span class="text-xs font-bold text-emerald-600 uppercase tracking-wider">Contract for Signature</span>
          </div>
          <h1 class="text-xl sm:text-2xl font-bold text-slate-900">{{ contractData.title }}</h1>
          <p class="text-sm text-slate-500 mt-1">
            {{ contractData.contractNumber }} · {{ new Date(contractData.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) }}
          </p>
        </div>
        <div v-if="contractData.company?.logo" class="shrink-0">
          <img :src="contractData.company.logo" alt="Company Logo" class="h-16 sm:h-20 max-w-[200px] object-contain" />
        </div>
      </div>

      <!-- Contract Content -->
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-8">
        <div class="p-6 sm:p-8 prose prose-sm prose-slate max-w-none" v-html="contractData.content" />
      </div>

      <!-- Signature Section -->
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
  </div>
</template>
