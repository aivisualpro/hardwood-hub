import type { ColumnDef } from '@tanstack/vue-table'

import type { Task } from '../data/schema'
import { h } from 'vue'
import { priorities, statuses } from '../data/data'
import DataTableColumnHeader from './DataTableColumnHeader.vue'
import DataTableRowActions from './DataTableRowActions.vue'
import DataTableStatusCell from './DataTableStatusCell.vue'
import DataTablePriorityCell from './DataTablePriorityCell.vue'
import DataTableAssigneesCell from './DataTableAssigneesCell.vue'
import DueDateBadge from './DueDateBadge.vue'

export const columns: ColumnDef<Task>[] = [
  {
    id: 'sno',
    header: ({ column }) => h(DataTableColumnHeader, { column, titleKey: 'tasks.col.sno' }),
    cell: ({ row }) => h('div', { class: 'w-8 text-muted-foreground tabular-nums text-center' }, row.index + 1),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'title',
    header: ({ column }) => h(DataTableColumnHeader, { column, titleKey: 'tasks.col.title' }),
    cell: ({ row }) => {
      return h('span', { class: 'max-w-[500px] truncate font-medium' }, row.getValue('title'))
    },
  },
  {
    accessorKey: 'assignees',
    header: ({ column }) => h(DataTableColumnHeader, { column, titleKey: 'tasks.col.assignees' }),
    cell: ({ row }) => h(DataTableAssigneesCell, { task: row.original }),
    enableSorting: false,
  },
  {
    accessorKey: 'status',
    header: ({ column }) => h(DataTableColumnHeader, { column, titleKey: 'tasks.col.status' }),
    cell: ({ row }) => h(DataTableStatusCell, { task: row.original }),
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: 'priority',
    header: ({ column }) => h(DataTableColumnHeader, { column, titleKey: 'tasks.col.priority' }),
    cell: ({ row }) => h(DataTablePriorityCell, { task: row.original }),
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: 'createdAt',
    header: ({ column }) => h(DataTableColumnHeader, { column, titleKey: 'tasks.col.createdAt' }),
    cell: ({ row }) => {
      const val = row.getValue('createdAt') as string | undefined
      if (!val) return h('span', { class: 'text-xs text-muted-foreground' }, '—')
      const d = new Date(val)
      return h('span', { class: 'text-xs text-muted-foreground whitespace-nowrap' },
        d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
      )
    },
  },
  {
    accessorKey: 'dueDate',
    header: ({ column }) => h(DataTableColumnHeader, { column, titleKey: 'tasks.col.dueDate' }),
    cell: ({ row }) => {
      const val = row.getValue('dueDate') as string | undefined
      return h(DueDateBadge, { dueDate: val })
    },
    sortingFn: (rowA, rowB) => {
      const a = rowA.getValue('dueDate') as string | undefined
      const b = rowB.getValue('dueDate') as string | undefined
      if (!a && !b) return 0
      if (!a) return 1
      if (!b) return -1
      return new Date(a).getTime() - new Date(b).getTime()
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => h(DataTableRowActions, { row }),
  },
]
