export interface NavLink {
  title: string
  titleKey?: string
  link: string
  icon?: string
  new?: boolean
  badge?: number | string
}

export interface NavSectionTitle {
  heading: string
  headingKey?: string
}

export interface NavGroup {
  title: string
  titleKey?: string
  icon?: string
  new?: boolean
  children: NavLink[]
}

export interface NavMenu {
  heading: string
  headingKey?: string
  items: NavMenuItems
}

export declare type NavMenuItems = (NavLink | NavGroup | NavSectionTitle)[]

