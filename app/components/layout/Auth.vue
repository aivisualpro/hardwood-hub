<script setup lang="ts">
defineProps<{
  reverse?: boolean
}>()
</script>

<template>
  <div
    class="relative flex items-center justify-center px-4 h-dvh lg:max-w-none lg:px-0"
    :class="{ 'flex-row-reverse': reverse }"
  >
    <div class="relative hidden h-full flex-[2] flex-col p-10 text-white lg:flex dark:border-r overflow-hidden">
      <img src="/hardwood image.png" alt="" class="absolute inset-0 w-full h-full object-cover object-center" />
      <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
      <div class="relative z-20 mt-auto">
        <blockquote class="space-y-2">
          <p class="text-lg">
            &ldquo;Manage employee skills, track performance across categories, and streamline workforce development — all from one powerful, intuitive platform.&rdquo;
          </p>
        </blockquote>
      </div>
    </div>
    <div class="mx-auto flex-[3] lg:p-16">
      <slot />
    </div>
  </div>
</template>
