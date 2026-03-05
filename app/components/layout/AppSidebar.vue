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

const { data: workspacesRes } = await useFetch('/api/workspaces', { key: 'workspaces-list' })
const allTeams = computed(() => workspacesRes.value?.data || [])

const activeTeamId = useCookie<string>('active_workspace_id')
const activeTeam = computed({
  get() {
    const t = userTeams.value.find((t: any) => t._id === activeTeamId.value)
    return t || userTeams.value[0] || { name: 'Admin Workspace', logo: 'i-lucide-shield-check', plan: 'Full Access', allowedMenus: ['*'] }
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

const flattenedNavItems = computed(() => {
  return filteredNavMenu.value.flatMap(group => group.items)
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

const userCookie = useCookie<{ employee: string, email: string, position: string, profileImage: string, workspace?: string } | null>('hardwood_user')

// Filter workspaces: if the user has a workspace assigned, only show that one
const userTeams = computed(() => {
  const userWs = userCookie.value?.workspace
  if (userWs) {
    const matched = allTeams.value.filter((t: any) => t._id === userWs)
    return matched.length > 0 ? matched : allTeams.value
  }
  return allTeams.value
})

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

const conceptsOpen = ref(false)
</script>

<template>
  <Sidebar :collapsible="sidebar?.collapsible" :side="sidebar?.side" :variant="sidebar?.variant">
    <SidebarHeader>
      <LayoutSidebarNavHeader v-model="activeTeam" :teams="userTeams" />
      <Search />
    </SidebarHeader>
    <SidebarContent>
      <SidebarGroup v-for="(group, gIdx) in filteredNavMenu" :key="gIdx">
        <SidebarGroupLabel v-if="group.heading">
          {{ getHeading(group) }}
        </SidebarGroupLabel>
        <component :is="resolveNavItemComponent(item)" v-for="(item, index) in group.items" :key="index" :item="item" />
      </SidebarGroup>
      <SidebarGroup v-if="filteredNavMenuConcepts.items?.length">
        <Collapsible v-model:open="conceptsOpen">
          <CollapsibleTrigger as-child>
            <SidebarGroupLabel class="cursor-pointer hover:text-foreground transition-colors select-none group/concepts">
              {{ getHeading(filteredNavMenuConcepts) }}
              <Icon 
                name="i-lucide-chevron-right" 
                class="ml-auto size-3.5 text-muted-foreground/60 transition-transform duration-200" 
                :class="conceptsOpen ? 'rotate-90' : ''" 
              />
            </SidebarGroupLabel>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <component :is="resolveNavItemComponent(item)" v-for="(item, index) in filteredNavMenuConcepts.items" :key="index" :item="item" />
          </CollapsibleContent>
        </Collapsible>
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
