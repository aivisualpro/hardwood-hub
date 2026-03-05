import { Icon } from '#components'
import { h } from 'vue'

export const labels = [
  {
    value: 'bug',
    label: 'Bug',
    labelKey: 'tasks.label.bug' as const,
  },
  {
    value: 'feature',
    label: 'Feature',
    labelKey: 'tasks.label.feature' as const,
  },
  {
    value: 'documentation',
    label: 'Documentation',
    labelKey: 'tasks.label.documentation' as const,
  },
]

export const statuses = [
  {
    value: 'todo',
    label: 'Todo',
    labelKey: 'tasks.status.todo' as const,
    icon: h(Icon, { name: 'i-radix-icons-circle' }),
  },
  {
    value: 'in-progress',
    label: 'In Progress',
    labelKey: 'tasks.status.inProgress' as const,
    icon: h(Icon, { name: 'i-radix-icons-stopwatch' }),
  },
  {
    value: 'in-review',
    label: 'In Review',
    labelKey: 'tasks.status.inReview' as const,
    icon: h(Icon, { name: 'i-radix-icons-eye-open' }),
  },
  {
    value: 'done',
    label: 'Done',
    labelKey: 'tasks.status.done' as const,
    icon: h(Icon, { name: 'i-radix-icons-check-circled' }),
  },
]

export const priorities = [
  {
    value: 'low',
    label: 'Low',
    labelKey: 'tasks.priority.low' as const,
    icon: h(Icon, { name: 'i-radix-icons-arrow-down' }),
  },
  {
    value: 'medium',
    label: 'Medium',
    labelKey: 'tasks.priority.medium' as const,
    icon: h(Icon, { name: 'i-radix-icons-arrow-right' }),
  },
  {
    value: 'high',
    label: 'High',
    labelKey: 'tasks.priority.high' as const,
    icon: h(Icon, { name: 'i-radix-icons-arrow-up' }),
  },
]
