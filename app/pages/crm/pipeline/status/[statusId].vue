<script setup lang="ts">
// This route renders the same pipeline page with a pre-selected status filter.
// URL: /crm/pipeline/status/:statusId
definePageMeta({ key: route => `pipeline-status-${route.params.statusId}` })

const route = useRoute()
const statusId = route.params.statusId as string

// Redirect to the main pipeline page with status query
navigateTo(`/crm/pipeline?status=${statusId}`, { replace: true })
</script>

<template>
  <div />
</template>
