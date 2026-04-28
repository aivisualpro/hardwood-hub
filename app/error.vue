<script setup>
const props = defineProps({
  error: Object,
})

const { theme } = useAppSettings()

useHead({
  bodyAttrs: {
    class: computed(() => `color-${theme.value?.color || 'default'} theme-${theme.value?.type || 'default'}`),
  },
})

const statusCode = computed(() => props.error?.statusCode || 500)
const statusMessage = computed(() => {
  if (statusCode.value === 404) return 'Page Not Found'
  if (statusCode.value === 401) return 'Unauthorized'
  if (statusCode.value === 403) return 'Forbidden'
  if (statusCode.value === 500) return 'Server Error'
  return props.error?.statusMessage || 'Something Went Wrong'
})

const description = computed(() => {
  if (statusCode.value === 404) return 'The page you\'re looking for does not exist or might have been removed.'
  if (statusCode.value === 500) return 'An unexpected error occurred on the server. Please try again.'
  return props.error?.message || 'An unexpected error occurred.'
})

function handleGoBack() {
  clearError({ redirect: '/' })
}

function handleGoHome() {
  clearError({ redirect: '/' })
}
</script>

<template>
  <div class="h-svh">
    <div class="m-auto h-full w-full flex flex-col items-center justify-center gap-2">
      <h1 class="text-[7rem] font-bold leading-tight">
        {{ statusCode }}
      </h1>
      <span class="font-medium">{{ statusMessage }}</span>
      <p class="text-center text-muted-foreground max-w-md px-4">
        {{ description }}
      </p>
      <div class="mt-6 flex gap-4">
        <Button variant="outline" @click="handleGoBack">
          Go Back
        </Button>
        <Button @click="handleGoHome">
          Back to Home
        </Button>
      </div>
    </div>
  </div>
</template>

<style scoped>

</style>
