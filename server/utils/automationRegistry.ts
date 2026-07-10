/**
 * Automation registry — single source of truth for which modules/submodules/fields
 * the notification automation engine knows about.
 *
 * Adding a new submodule here makes it appear automatically in the
 * Notifications → Automations builder UI. Set `wired: true` once the submodule's
 * API routes actually call fireAutomations().
 *
 * Field `options`:
 *   - { dropdown: '<Dropdown name>' } → options loaded live from hardwoodDB_Dropdowns
 *   - { enum: [...] }                 → static options (schema enums)
 *   - omitted                         → free-text value in the builder
 */

export interface RegistryField {
  key: string
  label: string
  type: 'text' | 'number' | 'date' | 'select'
  dropdown?: string // Dropdown collection name to pull options from
  enum?: { value: string, label: string }[]
}

export interface RegistrySubmodule {
  key: string
  label: string
  icon: string
  wired: boolean // true = API routes emit events for this submodule
  link: string // in-app route for "view record" links
  labelFields: string[] // fields concatenated to build a human entity label
  fields: RegistryField[]
}

export interface RegistryModule {
  key: string
  label: string
  icon: string
  submodules: RegistrySubmodule[]
}

function enumOpts(values: string[], labels?: Record<string, string>) {
  return values.map(v => ({
    value: v,
    label: labels?.[v] || v.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
  }))
}

export const AUTOMATION_REGISTRY: RegistryModule[] = [
  {
    key: 'crm',
    label: 'CRM',
    icon: 'i-lucide-contact',
    submodules: [
      {
        key: 'customers',
        label: 'Customers',
        icon: 'i-lucide-users',
        wired: true,
        link: '/crm/customers',
        labelFields: ['name'],
        fields: [
          { key: 'status', label: 'Status', type: 'select', dropdown: 'Customer Status' },
          { key: 'type', label: 'Type', type: 'select', dropdown: 'Customer Type' },
          { key: 'assignedTo', label: 'Assigned To', type: 'text' },
          { key: 'projectAssignedTo', label: 'Project Assigned To', type: 'text' },
          { key: 'totalEstimate', label: 'Total Estimate', type: 'number' },
          { key: 'name', label: 'Name', type: 'text' },
          { key: 'email', label: 'Email', type: 'text' },
          { key: 'phone', label: 'Phone', type: 'text' },
        ],
      },
      {
        key: 'pipeline',
        label: 'Pipeline',
        icon: 'i-lucide-contact',
        wired: true,
        link: '/crm/pipeline',
        labelFields: ['projectName', 'name'],
        fields: [
          { key: 'status', label: 'Status', type: 'select', dropdown: 'Customer Status' },
          { key: 'assignedTo', label: 'Assigned To', type: 'text' },
          { key: 'projectAssignedTo', label: 'Project Assigned To', type: 'text' },
          { key: 'totalEstimate', label: 'Total Estimate', type: 'number' },
          { key: 'projectName', label: 'Project Name', type: 'text' },
          { key: 'woodOrderDate', label: 'Wood Order Date', type: 'date' },
          { key: 'dateApproved', label: 'Date Approved', type: 'date' },
        ],
      },
      {
        key: 'products',
        label: 'Products & Services',
        icon: 'i-lucide-package',
        wired: true,
        link: '/crm/products',
        labelFields: ['sku', 'description'],
        fields: [
          { key: 'salesPrice', label: 'Sales Price', type: 'number' },
          { key: 'costPrice', label: 'Cost Price', type: 'number' },
          { key: 'sku', label: 'SKU', type: 'text' },
          { key: 'vendor', label: 'Vendor', type: 'text' },
          { key: 'type', label: 'Type', type: 'text' },
        ],
      },
      {
        key: 'estimates',
        label: 'Estimates',
        icon: 'i-lucide-file-text',
        wired: true,
        link: '/crm/estimates',
        labelFields: ['estimateNumber', 'title'],
        fields: [
          {
            key: 'status',
            label: 'Status',
            type: 'select',
            enum: enumOpts(
              ['draft', 'sent', 'received', 'approved', 'change_request', 'declined', 'completed', 'cancelled'],
              { change_request: 'Change Request' },
            ),
          },
          { key: 'totalAmount', label: 'Total Amount', type: 'number' },
          { key: 'customerName', label: 'Customer Name', type: 'text' },
          { key: 'title', label: 'Title', type: 'text' },
        ],
      },
      {
        key: 'contracts',
        label: 'Contracts',
        icon: 'i-lucide-file-signature',
        wired: true,
        link: '/crm/contracts',
        labelFields: ['contractNumber', 'title'],
        fields: [
          {
            key: 'status',
            label: 'Status',
            type: 'select',
            enum: enumOpts(['draft', 'pending', 'sent', 'signed', 'completed', 'cancelled']),
          },
          { key: 'customerName', label: 'Customer Name', type: 'text' },
          { key: 'title', label: 'Title', type: 'text' },
        ],
      },
      {
        key: 'change-orders',
        label: 'Change Orders',
        icon: 'i-lucide-file-diff',
        wired: true,
        link: '/crm/change-orders',
        labelFields: ['changeOrderNumber', 'title'],
        fields: [
          { key: 'customerName', label: 'Customer Name', type: 'text' },
          { key: 'projectName', label: 'Project Name', type: 'text' },
          { key: 'title', label: 'Title', type: 'text' },
        ],
      },
    ],
  },
  {
    key: 'hr',
    label: 'HR',
    icon: 'i-lucide-users',
    submodules: [
      {
        key: 'employees',
        label: 'Employees',
        icon: 'i-lucide-users',
        wired: false,
        link: '/hr/employees',
        labelFields: ['employee'],
        fields: [
          { key: 'status', label: 'Status', type: 'select', enum: enumOpts(['Active', 'Inactive']) },
          { key: 'position', label: 'Position', type: 'text' },
          { key: 'basePay', label: 'Base Pay', type: 'number' },
        ],
      },
      {
        key: 'timesheet',
        label: 'TimeSheet',
        icon: 'i-lucide-clock',
        wired: false,
        link: '/hr/timesheet',
        labelFields: ['employee'],
        fields: [],
      },
    ],
  },
  {
    key: 'learning-center',
    label: 'Learning Center',
    icon: 'i-lucide-book-open-check',
    submodules: [
      {
        key: 'resources',
        label: 'Resources',
        icon: 'i-lucide-play-circle',
        wired: false,
        link: '/learning-center/skill-guide',
        labelFields: ['title'],
        fields: [
          { key: 'isPublished', label: 'Published', type: 'select', enum: enumOpts(['true', 'false'], { true: 'Published', false: 'Unpublished' }) },
          { key: 'category', label: 'Category', type: 'text' },
        ],
      },
    ],
  },
  {
    key: 'project-management',
    label: 'Project Management',
    icon: 'i-lucide-kanban',
    submodules: [
      {
        key: 'tasks',
        label: 'Tasks',
        icon: 'i-lucide-kanban',
        wired: false,
        link: '/tasks',
        labelFields: ['title'],
        fields: [
          { key: 'status', label: 'Status', type: 'select', enum: enumOpts(['todo', 'in-progress', 'in-review', 'done'], { 'todo': 'To Do', 'in-progress': 'In Progress', 'in-review': 'In Review', 'done': 'Done' }) },
          { key: 'priority', label: 'Priority', type: 'select', enum: enumOpts(['low', 'medium', 'high']) },
        ],
      },
      {
        key: 'daily-production',
        label: 'Daily Production',
        icon: 'i-lucide-clipboard-list',
        wired: false,
        link: '/daily-production',
        labelFields: ['title'],
        fields: [],
      },
      {
        key: 'stain-sign-off',
        label: 'Stain Sign Off',
        icon: 'i-lucide-stamp',
        wired: false,
        link: '/stain-sign-off',
        labelFields: ['customerName'],
        fields: [],
      },
    ],
  },
]

export function findSubmodule(moduleKey: string, submoduleKey: string): { mod: RegistryModule, sub: RegistrySubmodule } | null {
  const mod = AUTOMATION_REGISTRY.find(m => m.key === moduleKey)
  if (!mod)
    return null
  const sub = mod.submodules.find(s => s.key === submoduleKey)
  if (!sub)
    return null
  return { mod, sub }
}
