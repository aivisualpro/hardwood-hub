<script setup lang="ts">
import type { TranslationKey } from '~/composables/useLocale'
import type { NavGroup, NavLink, NavSectionTitle } from '~/types/nav'
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

// ── Shared auth state (reactive, no cookie snapshot) ─────────────────────────
const { user } = useAuth()

// ── Workspaces ────────────────────────────────────────────────────────────────
// useAsyncData is SSR-safe and deduplicated by key.
// We pass user.value?._id in the key so the fetch re-runs when the user changes.
const { data: workspacesRes, refresh: refreshWorkspaces } = await useAsyncData(
  'workspaces-list',
  () => $fetch<any>('/api/workspaces', { headers: useRequestHeaders(['cookie']) }),
  { server: false },
)

// Re-fetch workspaces whenever the user identity changes (e.g. after login)
watch(user, async (newUser) => {
  if (newUser)
    await refreshWorkspaces()
})

const allTeams = computed(() => workspacesRes.value?.data || [])

// Admin-tier positions that get wildcard access when no workspace is assigned
const ADMIN_POSITIONS = ['Super Admin', 'Admin']
const isAdminTier = computed(() => ADMIN_POSITIONS.includes(user.value?.position || ''))

// Filter workspaces to user's assigned one, if set
const userTeams = computed(() => {
  const userWs = user.value?.workspace
  if (userWs) {
    // Strict filter — don't fall back to all teams
    return allTeams.value.filter((t: any) => t._id === userWs)
  }
  return allTeams.value
})

const activeTeamId = useCookie<string>('active_workspace_id')
const activeTeam = computed({
  get() {
    const t = userTeams.value.find((t: any) => t._id === activeTeamId.value)
    if (t) return t
    if (userTeams.value[0]) return userTeams.value[0]

    // FAIL CLOSED: wildcard only for admin-tier with no assigned workspace
    const userWs = user.value?.workspace
    if (!userWs && isAdminTier.value)
      return { name: 'Admin Workspace', logo: 'i-lucide-shield-check', plan: 'Full Access', allowedMenus: ['*'] }

    // Everyone else: deny all
    return { name: 'No Access', logo: 'i-lucide-lock', plan: 'Restricted', allowedMenus: [] }
  },
  set(val: any) {
    activeTeamId.value = val._id
  },
})

function isAllowed(link?: string) {
  if (!link)
    return false
  const allowed = activeTeam.value?.allowedMenus || []
  if (allowed.includes('*'))
    return true
  return allowed.includes(link)
}

// ── Nav Counts ────────────────────────────────────────────────────────────────
const { data: navCountsRes, refresh: refreshNavCounts } = await useAsyncData(
  'nav-counts',
  () => $fetch<any>('/api/nav/counts', { headers: useRequestHeaders(['cookie']) }),
  { server: false },
)

// Re-fetch nav counts whenever user changes
watch(user, async (newUser) => {
  if (newUser)
    await refreshNavCounts()
})

const navCounts = computed<Record<string, number>>(() => navCountsRes.value?.data || {})

// Poll for badge updates every 60 seconds
let pollInterval: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  pollInterval = setInterval(refreshNavCounts, 60_000)
})
onUnmounted(() => {
  clearInterval(pollInterval)
})

// ── Filtered nav menus ────────────────────────────────────────────────────────
const filteredNavMenu = computed(() => {
  return navMenu.map(group => ({
    ...group,
    items: group.items.map((item: any) => {
      const newItem = { ...item }
      const count = navCounts.value[newItem.link]
      if (count && count > 0)
        newItem.badge = count
      return newItem
    }).filter((item: any) => isAllowed(item.link)),
  })).filter(group => group.items.length > 0)
})

const filteredNavMenuConcepts = computed(() => {
  return {
    ...navMenuConcepts,
    items: navMenuConcepts.items.map((item: any) => {
      const newItem = { ...item }
      const count = navCounts.value[newItem.link]
      if (count && count > 0)
        newItem.badge = count
      return newItem
    }).filter((item: any) => isAllowed(item.link)),
  }
})

const filteredNavMenuBottom = computed(() => {
  return navMenuBottom.map((item: any) => {
    const newItem = { ...item }
    const count = navCounts.value[newItem.link]
    if (count && count > 0)
      newItem.badge = count
    return newItem
  }).filter((item: any) => isAllowed(item.link))
})

// ── User display info ─────────────────────────────────────────────────────────
const userDisplay = computed(() => {
  const u = user.value
  let avatar = u?.profileImage || ''

  // Wipe legacy BigQuery image routes if they still exist in login cookie
  if (avatar.includes('api/bigquery'))
    avatar = ''

  return {
    name: u?.employee || 'Unknown User',
    email: u?.email || '',
    avatar,
    position: u?.position || '',
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
      <LayoutSidebarNavFooter :user="userDisplay" />
    </SidebarFooter>
    <SidebarRail />
  </Sidebar>
</template>
