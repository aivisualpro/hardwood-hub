import type { NavMenu, NavMenuItems } from '~/types/nav'

export const navMenu: NavMenu[] = [
  {
    heading: 'General',
    headingKey: 'nav.general',
    items: [
      {
        title: 'Dashboard',
        titleKey: 'nav.dashboard',
        icon: 'i-lucide-layout-dashboard',
        link: '/',
      },
      {
        title: 'Email',
        titleKey: 'nav.email',
        icon: 'i-lucide-mail',
        link: '/email',
      },
    ],
  },
  {
    heading: 'Apps',
    headingKey: 'nav.apps',
    items: [
      {
        title: 'Kanban Board',
        titleKey: 'nav.kanbanBoard',
        icon: 'i-lucide-kanban',
        link: '/kanban',
      },
    ],
  },
  {
    heading: 'Sales & Commerce',
    headingKey: 'nav.salesCommerce',
    items: [
      {
        title: 'Quotes',
        titleKey: 'nav.quotes',
        icon: 'i-lucide-file-text',
        link: '/sales/quotes',
      },
      {
        title: 'Invoices',
        titleKey: 'nav.invoices',
        icon: 'i-lucide-receipt',
        link: '/sales/invoices',
      },
      {
        title: 'Orders',
        titleKey: 'nav.orders',
        icon: 'i-lucide-shopping-cart',
        link: '/sales/orders',
      },
      {
        title: 'Products',
        titleKey: 'nav.products',
        icon: 'i-lucide-package',
        link: '/sales/products',
      },
      {
        title: 'Customers',
        titleKey: 'nav.customers',
        icon: 'i-lucide-users',
        link: '/sales/customers',
      },
    ],
  },
  {
    heading: 'Reports',
    headingKey: 'nav.reports',
    items: [
      {
        title: 'Sales Reports',
        titleKey: 'nav.salesReports',
        icon: 'i-lucide-trending-up',
        link: '/reports/sales',
      },
      {
        title: 'Financial Reports',
        titleKey: 'nav.financialReports',
        icon: 'i-lucide-pie-chart',
        link: '/reports/financial',
      },
      {
        title: 'HR Reports',
        titleKey: 'nav.hrReports',
        icon: 'i-lucide-file-bar-chart',
        link: '/reports/hr',
      },
    ],
  },
]

export const navMenuBottom: NavMenuItems = []
