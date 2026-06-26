<script setup lang="ts">
definePageMeta({ layout: false })

const route = useRoute()
const token = route.params.token as string

// State
const loading = ref(true)
const submitting = ref(false)
const estimate = ref<any>(null)
const company = ref<any>({})
const alreadyResponded = ref(false)
const existingResponse = ref<any>(null)
const submitted = ref(false)
const submittedAction = ref('')
const error = ref('')

// The action pre-selected from query param
const preselectedAction = (route.query.action as string) || ''
const selectedAction = ref<'approved' | 'change_request' | 'declined' | ''>('')
const changeMessage = ref('')

// Fetch estimate data
async function fetchEstimate() {
  loading.value = true
  error.value = ''
  try {
    const res = await $fetch<{ success: boolean, data: any }>(`/api/public/estimate-response/${token}`)
    estimate.value = res.data
    company.value = res.data.company || {}
    alreadyResponded.value = res.data.alreadyResponded || false
    existingResponse.value = res.data.clientResponse || null

    // If action came from query and not already responded, pre-select it
    if (!alreadyResponded.value && preselectedAction) {
      const mapped: Record<string, string> = {
        approve: 'approved',
        change_request: 'change_request',
        decline: 'declined',
      }
      selectedAction.value = (mapped[preselectedAction] || '') as any
    }
  }
  catch (e: any) {
    error.value = e?.data?.message || e?.message || 'Failed to load estimate'
  }
  finally {
    loading.value = false
  }
}

async function submitResponse() {
  if (!selectedAction.value) return
  if (selectedAction.value === 'change_request' && !changeMessage.value.trim()) {
    error.value = 'Please describe the changes you would like.'
    return
  }

  submitting.value = true
  error.value = ''
  try {
    const res = await $fetch<{ success: boolean, message: string, alreadyResponded?: boolean }>(`/api/public/estimate-response/${token}`, {
      method: 'POST',
      body: {
        action: selectedAction.value,
        message: changeMessage.value.trim(),
      },
    })
    if (res.alreadyResponded) {
      alreadyResponded.value = true
      return
    }
    submitted.value = true
    submittedAction.value = selectedAction.value
  }
  catch (e: any) {
    error.value = e?.data?.message || e?.message || 'Failed to submit response'
  }
  finally {
    submitting.value = false
  }
}

function formatDate(d: string) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const actionLabels: Record<string, string> = {
  approved: 'Approved',
  change_request: 'Change Request',
  declined: 'Declined',
}

const actionColors: Record<string, string> = {
  approved: '#059669',
  change_request: '#d97706',
  declined: '#dc2626',
}

onMounted(fetchEstimate)
</script>

<template>
  <div
    class="min-h-dvh flex items-center justify-center p-4 sm:p-8"
    :style="{ background: `linear-gradient(135deg, ${company.brandColor || '#84CC16'}12 0%, #f8fafc 50%, ${company.brandColor || '#84CC16'}08 100%)` }"
  >
    <div class="w-full max-w-lg">
      <!-- Loading -->
      <div v-if="loading" class="text-center py-20">
        <div
          class="size-10 border-[3px] border-t-transparent rounded-full animate-spin mx-auto mb-4"
          :style="{ borderColor: `${company.brandColor || '#84CC16'}40`, borderTopColor: 'transparent' }"
        />
        <p class="text-sm text-gray-500 font-medium">
          Loading estimate...
        </p>
      </div>

      <!-- Error -->
      <div v-else-if="error && !estimate" class="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 text-center">
        <div class="size-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <svg class="size-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h2 class="text-lg font-bold text-gray-900 mb-2">
          Unable to Load
        </h2>
        <p class="text-sm text-gray-500">
          {{ error }}
        </p>
      </div>

      <!-- Already Responded -->
      <div v-else-if="alreadyResponded && !submitted" class="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <!-- Company Header -->
        <div class="px-6 pt-6 pb-4 border-b border-gray-100 text-center">
          <img
            v-if="company.logo"
            :src="company.logo"
            alt="Company Logo"
            class="h-12 object-contain mx-auto mb-3"
          >
          <h1 class="text-lg font-bold text-gray-900">
            {{ estimate?.title }}
          </h1>
          <p class="text-xs text-gray-400 mt-1">
            Estimate #{{ estimate?.estimateNumber }}
          </p>
        </div>
        <div class="p-8 text-center">
          <div class="size-16 rounded-full flex items-center justify-center mx-auto mb-4" :style="{ backgroundColor: `${actionColors[existingResponse?.action] || '#059669'}15` }">
            <svg v-if="existingResponse?.action === 'approved'" class="size-7" :style="{ color: actionColors.approved }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
            </svg>
            <svg v-else-if="existingResponse?.action === 'change_request'" class="size-7" :style="{ color: actionColors.change_request }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <svg v-else class="size-7" :style="{ color: actionColors.declined }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 class="text-lg font-bold text-gray-900 mb-1">
            Response Already Submitted
          </h2>
          <p class="text-sm text-gray-500 mb-3">
            You responded with <strong :style="{ color: actionColors[existingResponse?.action] }">{{ actionLabels[existingResponse?.action] || existingResponse?.action }}</strong>
            on {{ formatDate(existingResponse?.respondedAt) }}.
          </p>
          <p v-if="existingResponse?.message" class="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 mt-3 text-left italic">
            "{{ existingResponse.message }}"
          </p>
        </div>
      </div>

      <!-- Success State -->
      <div v-else-if="submitted" class="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div class="px-6 pt-6 pb-4 border-b border-gray-100 text-center">
          <img
            v-if="company.logo"
            :src="company.logo"
            alt="Company Logo"
            class="h-12 object-contain mx-auto mb-3"
          >
        </div>
        <div class="p-8 text-center">
          <div
            class="size-20 rounded-full flex items-center justify-center mx-auto mb-5"
            :style="{ backgroundColor: `${actionColors[submittedAction] || '#059669'}12` }"
          >
            <svg v-if="submittedAction === 'approved'" class="size-9" :style="{ color: actionColors.approved }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
            </svg>
            <svg v-else-if="submittedAction === 'change_request'" class="size-9" :style="{ color: actionColors.change_request }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <svg v-else class="size-9" :style="{ color: actionColors.declined }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 class="text-xl font-bold text-gray-900 mb-2">
            {{ submittedAction === 'approved' ? 'Estimate Approved!' : submittedAction === 'change_request' ? 'Change Request Sent!' : 'Response Recorded' }}
          </h2>
          <p class="text-sm text-gray-500 leading-relaxed">
            {{ submittedAction === 'approved'
              ? `Thank you for approving the estimate. ${company.name || 'We'} will be in touch shortly to move forward.`
              : submittedAction === 'change_request'
                ? `Your requested changes have been sent to ${company.name || 'the team'}. They will review and get back to you.`
                : `Your response has been recorded. Thank you for your time.` }}
          </p>
          <div class="mt-6 pt-5 border-t border-gray-100">
            <p class="text-xs text-gray-400">
              {{ company.name || '' }} · {{ company.phone1 || '' }} · {{ company.email || '' }}
            </p>
          </div>
        </div>
      </div>

      <!-- Response Form -->
      <div v-else-if="estimate" class="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <!-- Company Header -->
        <div class="px-6 pt-6 pb-4 border-b border-gray-100 text-center">
          <img
            v-if="company.logo"
            :src="company.logo"
            alt="Company Logo"
            class="h-14 object-contain mx-auto mb-3"
          >
          <h1 class="text-lg font-bold text-gray-900">
            {{ estimate.title }}
          </h1>
          <p class="text-xs text-gray-400 mt-1">
            Estimate #{{ estimate.estimateNumber }} · {{ formatDate(estimate.createdAt) }}
          </p>
          <p v-if="estimate.customerName" class="text-sm text-gray-600 font-medium mt-2">
            Prepared for <strong>{{ estimate.customerName }}</strong>
          </p>
        </div>

        <div class="p-6">
          <p class="text-sm text-gray-600 mb-5 text-center">
            Please review the estimate and choose one of the options below:
          </p>

          <!-- Error inline -->
          <div v-if="error" class="mb-4 p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600 font-medium">
            {{ error }}
          </div>

          <!-- Action Buttons -->
          <div class="space-y-3">
            <!-- Approve -->
            <button
              class="w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left group"
              :class="selectedAction === 'approved'
                ? 'border-emerald-500 bg-emerald-50 shadow-lg shadow-emerald-500/10'
                : 'border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/50'"
              @click="selectedAction = 'approved'; error = ''"
            >
              <div
                class="size-11 rounded-xl flex items-center justify-center shrink-0 transition-colors"
                :class="selectedAction === 'approved' ? 'bg-emerald-500 text-white' : 'bg-emerald-100 text-emerald-600'"
              >
                <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div class="flex-1">
                <p class="text-sm font-bold" :class="selectedAction === 'approved' ? 'text-emerald-700' : 'text-gray-900'">
                  Approve Estimate
                </p>
                <p class="text-xs text-gray-500 mt-0.5">
                  I agree with the scope and pricing
                </p>
              </div>
              <div
                class="size-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all"
                :class="selectedAction === 'approved' ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'"
              >
                <svg v-if="selectedAction === 'approved'" class="size-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </button>

            <!-- Change Request -->
            <button
              class="w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left group"
              :class="selectedAction === 'change_request'
                ? 'border-amber-500 bg-amber-50 shadow-lg shadow-amber-500/10'
                : 'border-gray-200 hover:border-amber-300 hover:bg-amber-50/50'"
              @click="selectedAction = 'change_request'; error = ''"
            >
              <div
                class="size-11 rounded-xl flex items-center justify-center shrink-0 transition-colors"
                :class="selectedAction === 'change_request' ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-600'"
              >
                <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <div class="flex-1">
                <p class="text-sm font-bold" :class="selectedAction === 'change_request' ? 'text-amber-700' : 'text-gray-900'">
                  Request Changes
                </p>
                <p class="text-xs text-gray-500 mt-0.5">
                  I'd like some modifications to the estimate
                </p>
              </div>
              <div
                class="size-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all"
                :class="selectedAction === 'change_request' ? 'border-amber-500 bg-amber-500' : 'border-gray-300'"
              >
                <svg v-if="selectedAction === 'change_request'" class="size-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </button>

            <!-- Change Request Textarea -->
            <div v-if="selectedAction === 'change_request'" class="pl-4 border-l-2 border-amber-300 ml-4">
              <label class="block text-xs font-semibold text-gray-700 mb-1.5">
                What changes would you like?
              </label>
              <textarea
                v-model="changeMessage"
                rows="4"
                placeholder="Please describe the changes you'd like to make to this estimate..."
                class="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400 transition-all resize-y bg-white"
              />
            </div>

            <!-- Decline -->
            <button
              class="w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left group"
              :class="selectedAction === 'declined'
                ? 'border-red-500 bg-red-50 shadow-lg shadow-red-500/10'
                : 'border-gray-200 hover:border-red-300 hover:bg-red-50/50'"
              @click="selectedAction = 'declined'; error = ''"
            >
              <div
                class="size-11 rounded-xl flex items-center justify-center shrink-0 transition-colors"
                :class="selectedAction === 'declined' ? 'bg-red-500 text-white' : 'bg-red-100 text-red-600'"
              >
                <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div class="flex-1">
                <p class="text-sm font-bold" :class="selectedAction === 'declined' ? 'text-red-700' : 'text-gray-900'">
                  Decline Estimate
                </p>
                <p class="text-xs text-gray-500 mt-0.5">
                  I'm not interested at this time
                </p>
              </div>
              <div
                class="size-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all"
                :class="selectedAction === 'declined' ? 'border-red-500 bg-red-500' : 'border-gray-300'"
              >
                <svg v-if="selectedAction === 'declined'" class="size-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </button>
          </div>

          <!-- Submit Button -->
          <button
            v-if="selectedAction"
            class="w-full mt-5 py-3 px-6 rounded-xl font-bold text-white text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            :style="{
              backgroundColor: actionColors[selectedAction] || '#059669',
              boxShadow: `0 8px 24px ${actionColors[selectedAction] || '#059669'}30`,
            }"
            :disabled="submitting || (selectedAction === 'change_request' && !changeMessage.trim())"
            @click="submitResponse"
          >
            <span v-if="submitting" class="flex items-center justify-center gap-2">
              <svg class="size-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Submitting...
            </span>
            <span v-else>
              {{ selectedAction === 'approved' ? 'Confirm Approval' : selectedAction === 'change_request' ? 'Submit Change Request' : 'Confirm Decline' }}
            </span>
          </button>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-gray-100 bg-gray-50/50 text-center">
          <p class="text-[11px] text-gray-400">
            {{ company.name || '' }} · {{ company.phone1 || '' }} · {{ company.email || '' }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
