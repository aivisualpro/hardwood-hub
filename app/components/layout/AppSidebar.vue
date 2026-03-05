<script setup lang="ts">
import type { NavGroup, NavLink, NavSectionTitle } from '~/types/nav'
import type { TranslationKey } from '~/composables/useLocale'
import { navMenu, navMenuBottom, navMenuConcepts } from '~/constants/menus'

function resolveNavItemComponent(item: NavLink | NavGroup | NavSectionTitle): any {
  if ('children' in item)
    return resolveComponent('LayoutSidebarNavGroup')

  return resolveComponent('LayoutSidebarNavLink')
}

const { t } = useLocale()

function getHeading(nav: { heading: string, headingKey?: string }) {
  return nav.headingKey ? t(nav.headingKey as TranslationKey) : nav.heading
}

const { data: workspacesRes } = await useFetch('/api/workspaces')
const teams = computed(() => workspacesRes.value?.data || [])

const activeTeamId = useCookie<string>('active_workspace_id')
const activeTeam = computed({
  get() {
    const t = teams.value.find((t: any) => t._id === activeTeamId.value)
    return t || teams.value[0] || { name: 'Admin Workspace', logo: 'i-lucide-shield-check', plan: 'Full Access', allowedMenus: ['*'] }
  },
  set(val: any) {
    activeTeamId.value = val._id
  }
})

function isAllowed(link?: string) {
  if (!link) return false
  const allowed = activeTeam.value?.allowedMenus || []
  if (allowed.includes('*')) return true
  return allowed.includes(link)
}

const filteredNavMenu = computed(() => {
  return navMenu.map(group => ({
    ...group,
    items: group.items.filter((item: any) => isAllowed(item.link))
  })).filter(group => group.items.length > 0)
})

const filteredNavMenuConcepts = computed(() => {
  return {
    ...navMenuConcepts,
    items: navMenuConcepts.items.filter((item: any) => isAllowed(item.link))
  }
})

const filteredNavMenuBottom = computed(() => {
  return navMenuBottom.filter((item: any) => isAllowed(item.link))
})

const userCookie = useCookie<{ employee: string, email: string, position: string, profileImage: string } | null>('hardwood_user')

const user = computed(() => {
  const u = userCookie.value
  return {
    name: u?.employee || 'Unknown User',
    email: u?.email || '',
    avatar: u?.profileImage || '',
    position: u?.position || ''
  }
})

const { sidebar } = useAppSettings()
</script>

<template>
  <Sidebar :collapsible="sidebar?.collapsible" :side="sidebar?.side" :variant="sidebar?.variant">
    <SidebarHeader>
      <LayoutSidebarNavHeader v-model="activeTeam" :teams="teams" />
      <Search />
    </SidebarHeader>
    <SidebarContent>
      <SidebarGroup v-for="(nav, indexGroup) in filteredNavMenu" :key="indexGroup">
        <SidebarGroupLabel v-if="nav.heading">
          {{ getHeading(nav) }}
        </SidebarGroupLabel>
        <component :is="resolveNavItemComponent(item)" v-for="(item, index) in nav.items" :key="index" :item="item" />
      </SidebarGroup>
      <SidebarGroup v-if="filteredNavMenuConcepts.items?.length" class="mt-auto">
        <SidebarGroupLabel v-if="filteredNavMenuConcepts.heading">
          {{ getHeading(filteredNavMenuConcepts) }}
        </SidebarGroupLabel>
        <component :is="resolveNavItemComponent(item)" v-for="(item, index) in filteredNavMenuConcepts.items" :key="index" :item="item" />
      </SidebarGroup>
      <SidebarGroup v-if="filteredNavMenuBottom.length">
        <component :is="resolveNavItemComponent(item)" v-for="(item, index) in filteredNavMenuBottom" :key="index" :item="item" size="sm" />
      </SidebarGroup>
    </SidebarContent>
    <SidebarFooter>
      <LayoutSidebarNavFooter :user="user" />
    </SidebarFooter>
    <SidebarRail />
  </Sidebar>
</template>
