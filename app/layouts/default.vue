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
        <div class="@container/main px-4 pb-4 lg:px-6 lg:pb-6 pt-0 grow">
          <slot />
        </div>
      </div>
    </SidebarInset>
  </SidebarProvider>
</template>

<style scoped>

</style>
