<script setup lang="ts">
import type { NavMenu } from '~/types/nav'
import { navMenu, navMenuConcepts, navMenuBottom } from '@/constants/menus'

const { metaSymbol } = useShortcuts()
const { t } = useLocale()

const openCommand = ref(false)
const router = useRouter()

defineShortcuts({
  Meta_K: () => openCommand.value = true,
})

// Build a flat list of all navigable menu items from all menu sources
const allMenuItems = computed(() => {
  const items: { title: string, icon: string, link: string, group: string }[] = []

  // Main nav menus (Admin, Apps, etc.)
  for (const menu of navMenu) {
    const groupLabel = menu.heading || 'Navigation'
    for (const item of menu.items) {
      if ('link' in item && item.link) {
        items.push({
          title: item.title,
          icon: item.icon || 'i-lucide-circle',
          link: item.link,
          group: groupLabel,
        })
      }
    }
  }

  // Concepts menu
  if (navMenuConcepts?.items) {
    for (const item of navMenuConcepts.items) {
      if ('link' in item && item.link) {
        items.push({
          title: item.title,
          icon: item.icon || 'i-lucide-circle',
          link: item.link,
          group: navMenuConcepts.heading || 'Concepts',
        })
      }
    }
  }

  // Bottom menu (Settings)
  for (const item of navMenuBottom) {
    if ('link' in item && item.link) {
      items.push({
        title: item.title,
        icon: item.icon || 'i-lucide-circle',
        link: item.link,
        group: 'Settings',
      })
    }
  }

  return items
})

// Group items by their group label
const groupedMenuItems = computed(() => {
  const groups: Record<string, typeof allMenuItems.value> = {}
  for (const item of allMenuItems.value) {
    ;(groups[item.group] ??= []).push(item)
  }
  return groups
})

function handleSelectLink(link: string) {
  router.push(link)
  openCommand.value = false
}
</script>

<template>
  <SidebarMenuButton as-child :tooltip="t('common.search')">
    <Button variant="outline" size="sm" class="text-xs" @click="openCommand = !openCommand">
      <Icon name="i-lucide-search" />
      <span class="font-normal group-data-[collapsible=icon]:hidden">{{ t('common.search') }}</span>
      <div class="ml-auto flex items-center space-x-0.5 group-data-[collapsible=icon]:hidden">
        <Kbd>{{ metaSymbol }}</Kbd>
        <Kbd>K</Kbd>
      </div>
    </Button>
  </SidebarMenuButton>

  <CommandDialog v-model:open="openCommand">
    <CommandInput :placeholder="t('common.search') + '...'" />
    <CommandList>
      <CommandEmpty>{{ t('common.noResults') }}</CommandEmpty>
      <template v-for="(items, group) in groupedMenuItems" :key="group">
        <CommandGroup :heading="group">
          <CommandItem
            v-for="item in items"
            :key="item.link"
            :value="item.title"
            class="gap-2"
            @select="handleSelectLink(item.link)"
          >
            <Icon :name="item.icon" class="size-4 text-muted-foreground" />
            {{ item.title }}
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
      </template>
    </CommandList>
  </CommandDialog>
</template>
