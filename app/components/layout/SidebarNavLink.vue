<script setup lang="ts">
import type { SidebarMenuButtonVariants } from '~/components/ui/sidebar'
import type { NavLink } from '~/types/nav'
import type { TranslationKey } from '~/composables/useLocale'
import { useSidebar } from '~/components/ui/sidebar'

const props = withDefaults(defineProps<{
  item: NavLink
  size?: SidebarMenuButtonVariants['size']
}>(), {
  size: 'default',
})

const { setOpenMobile } = useSidebar()
const { t } = useLocale()

const displayTitle = computed(() =>
  props.item.titleKey ? t(props.item.titleKey as TranslationKey) : props.item.title,
)
</script>

<template>
  <SidebarMenu>
    <SidebarMenuItem>
      <SidebarMenuButton as-child :tooltip="displayTitle" :size="size" :data-active="item.link === $route.path">
        <NuxtLink :to="item.link" @click="setOpenMobile(false)">
          <Icon :name="item.icon || ''" />
          <span>{{ displayTitle }}</span>
          <span v-if="item.new" class="rounded-md bg-[#adfa1d] px-1.5 py-0.5 text-xs text-black leading-none no-underline group-hover:no-underline">
            New
          </span>
          <span v-if="item.badge" class="ml-auto rounded-full bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground leading-none font-bold">
            {{ item.badge }}
          </span>
        </NuxtLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  </SidebarMenu>
</template>
