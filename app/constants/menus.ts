import type { NavMenu, NavMenuItems } from '~/types/nav'

export const navMenu: NavMenu[] = [
  {
    heading: 'Admin',
    headingKey: 'nav.admin',
    items: [
      {
        title: 'Dashboard',
        titleKey: 'nav.dashboard',
        icon: 'i-lucide-layout-dashboard',
        link: '/admin/dashboard',
      },
      {
        title: 'Category Tree',
        icon: 'i-lucide-git-merge',
        link: '/admin/category-tree',
      },
      {
        title: 'Skills',
        icon: 'i-lucide-graduation-cap',
        link: '/admin/skills',
      },
      {
        title: 'Activities',
        icon: 'i-lucide-activity',
        link: '/admin/activities',
      },
      {
        title: 'General Settings',
        icon: 'i-lucide-settings',
        link: '/admin/general-settings',
      },
    ],
  },
  {
    heading: 'HR',
    items: [
      {
        title: 'Employees',
        titleKey: 'nav.employees',
        icon: 'i-lucide-users',
        link: '/hr/employees',
      },
      {
        title: 'Employee Performance',
        icon: 'i-lucide-bar-chart-3',
        link: '/hr/employee-performance',
      },
      {
        title: 'Bonus Report',
        icon: 'i-lucide-trophy',
        link: '/hr/employees-bonus-report',
      },
    ],
  },
  {
    heading: 'Project Management',
    items: [
      {
        title: 'Tasks',
        titleKey: 'nav.tasks',
        icon: 'i-lucide-kanban',
        link: '/tasks',
      },
      {
        title: 'Project Communication',
        icon: 'i-lucide-message-square',
        link: '/project-communication',
      },
      {
        title: 'Daily Production Report',
        icon: 'i-lucide-clipboard-list',
        link: '/daily-production',
      },
    ],
  },
  {
    heading: 'CRM',
    items: [
      {
        title: 'Customers',
        icon: 'i-lucide-contact',
        link: '/crm/customers',
      },
      {
        title: 'Contracts',
        icon: 'i-lucide-file-signature',
        link: '/crm/contracts',
      },
    ],
  },
  {
    heading: 'External',
    items: [
      {
        title: 'Stain Sign Off',
        icon: 'i-lucide-stamp',
        link: '/external/stain-sign-off',
      },
    ],
  },
]

export const navMenuConcepts: NavMenu = {
  heading: 'Concepts',
  headingKey: 'nav.concepts',
  items: [
    {
      title: 'Email',
      titleKey: 'nav.email',
      icon: 'i-lucide-mail',
      link: '/email',
    },
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
      title: 'Customers',
      titleKey: 'nav.customers',
      icon: 'i-lucide-users',
      link: '/sales/customers',
    },
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
  ],
}

export const navMenuBottom: NavMenuItems = []
