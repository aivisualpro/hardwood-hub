<script setup lang="ts">
useHead({
  htmlAttrs: { class: 'h-screen overflow-hidden' },
  bodyAttrs: { class: 'h-screen overflow-hidden' }
})
</script>

<template>
  <SidebarProvider>
    <LayoutAppSidebar />
    <SidebarInset>
      <LayoutHeader />
      <div class="flex flex-col flex-1 min-h-0">
        <div class="@container/main p-4 lg:p-6 grow">
          <slot />
        </div>
      </div>
    </SidebarInset>
  </SidebarProvider>
</template>

<style scoped>

</style>
