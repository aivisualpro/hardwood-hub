<script setup lang="ts">
</script>

<template>
  <SidebarProvider>
    <LayoutAppSidebar />
    <SidebarInset>
      <LayoutHeader />
      <div
        class="@container/main flex-1 min-h-0 overflow-y-auto overscroll-contain
               p-4
               [scrollbar-gutter:stable]
               pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <slot />
      </div>
    </SidebarInset>
    <TimeClock />
  </SidebarProvider>
</template>
