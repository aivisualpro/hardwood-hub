import type { Column, NewTask, Task } from '~/types/kanban'
import { nanoid } from 'nanoid'
import { toast } from 'vue-sonner'

export interface BoardState {
  columns: Column[]
}

const COLUMN_DEFS = [
  { id: 'todo', title: 'To Do' },
  { id: 'in-progress', title: 'In Progress' },
  { id: 'in-review', title: 'In Review' },
  { id: 'done', title: 'Done' },
]

const PAGE_SIZE = 20

export function useKanban() {
  const board = useState<BoardState>('kanban-board', () => ({
    columns: COLUMN_DEFS.map(c => ({ id: c.id, title: c.title, tasks: [] })),
  }))

  const hasMore = useState<Record<string, boolean>>('kanban-hasMore', () => ({
    'todo': false,
    'in-progress': false,
    'in-review': false,
    'done': false,
  }))

  const columnTotals = useState<Record<string, number>>('kanban-totals', () => ({
    'todo': 0,
    'in-progress': 0,
    'in-review': 0,
    'done': 0,
  }))

  const loading = useState('kanban-loading', () => false)
  const loadingMore = useState<Record<string, boolean>>('kanban-loading-more', () => ({}))

  // ─── Initial Load ─────────────────────────────────
  async function fetchBoard() {
    loading.value = true
    try {
      const res = await $fetch<any>(`/api/tasks?limit=${PAGE_SIZE}`)
      if (res.columns) {
        for (const col of board.value.columns) {
          const data = res.columns[col.id]
          if (data) {
            col.tasks = data.tasks.map(mapTask)
            hasMore.value[col.id] = data.hasMore
            columnTotals.value[col.id] = data.total
          }
        }
      }
    } catch (e) {
      console.error('[useKanban] fetch failed', e)
    } finally {
      loading.value = false
    }
  }

  // ─── Load More (infinite scroll) ──────────────────
  async function loadMore(columnId: string) {
    if (loadingMore.value[columnId] || !hasMore.value[columnId]) return
    loadingMore.value[columnId] = true
    try {
      const col = board.value.columns.find(c => c.id === columnId)
      if (!col) return
      const skip = col.tasks.length
      const res = await $fetch<any>(`/api/tasks?status=${columnId}&skip=${skip}&limit=${PAGE_SIZE}`)
      if (res.data) {
        col.tasks.push(...res.data.map(mapTask))
        hasMore.value[columnId] = res.hasMore
      }
    } catch (e) {
      console.error('[useKanban] loadMore failed', e)
    } finally {
      loadingMore.value[columnId] = false
    }
  }

  // ─── Map API task to client Task type ─────────────
  function mapTask(t: any): Task {
    return {
      id: t._id,
      _id: t._id,
      title: t.title,
      description: t.description,
      priority: t.priority,
      assignees: (t.assignees || []).map((a: any) => {
        // Already populated Employee doc
        if (a && typeof a === 'object' && a.employee) {
          return { _id: a._id?.toString?.() || a._id, employee: a.employee, profileImage: a.profileImage || '' }
        }
        // Raw ObjectId string (fallback)
        if (typeof a === 'string') return { _id: a, employee: '', profileImage: '' }
        // Legacy format: { id, name, avatar }
        if (a?.name) return { _id: a.id || a._id, employee: a.name, profileImage: a.avatar || '' }
        return null
      }).filter(Boolean),
      createdBy: (() => {
        const cb = t.createdBy
        if (!cb) return undefined
        // Populated Employee doc
        if (typeof cb === 'object' && cb.employee) {
          return { _id: cb._id?.toString?.() || cb._id, employee: cb.employee, profileImage: cb.profileImage || '' }
        }
        // Legacy embedded format
        if (typeof cb === 'object' && (cb as any).name) {
          return { _id: (cb as any).id || (cb as any)._id || '', employee: (cb as any).name, profileImage: (cb as any).avatar || '' }
        }
        // Raw ObjectId string
        if (typeof cb === 'string') return { _id: cb, employee: '', profileImage: '' }
        return undefined
      })(),
      dueDate: t.dueDate,
      status: t.status,
      labels: t.labels || [],
      subtasks: t.subtasks || [],
      comments: t.comments || [],
      approvedBy: t.approvedBy || null,
      createdAt: t.createdAt,
    }
  }

  // ─── CRUD ─────────────────────────────────────────
  async function addTask(columnId: string, payload: NewTask) {
    try {
      const res = await $fetch<any>('/api/tasks', {
        method: 'POST',
        body: { ...payload, status: columnId },
      })
      if (res.data) {
        const col = board.value.columns.find(c => c.id === columnId)
        if (col) {
          col.tasks.unshift(mapTask(res.data))
          columnTotals.value[columnId] = (columnTotals.value[columnId] || 0) + 1
        }
      }
    } catch (e: any) {
      console.error('[useKanban] addTask failed', e)
      toast.error('Failed to create task', { description: e?.data?.message || e?.message || 'Unknown error' })
    }
  }

  async function updateTask(columnId: string, taskId: string, patch: Partial<Task>) {
    const col = board.value.columns.find(c => c.id === columnId)
    const t = col?.tasks.find(t => t.id === taskId)
    if (!t || !(t as any)._id) return

    // Get current user name for changelog
    const userCookie = useCookie<{ employee?: string } | null>('hardwood_user')
    const changedBy = userCookie.value?.employee || ''

    // Optimistic
    Object.assign(t, patch)
    try {
      const res = await $fetch<any>(`/api/tasks/${(t as any)._id}`, { method: 'PUT', body: { ...patch, _changedBy: changedBy } })
      // Apply populated response back (e.g. assignees with employee data)
      if (res?.data) {
        const mapped = mapTask(res.data)
        Object.assign(t, mapped)
      }
    } catch (e) {
      console.error('[useKanban] updateTask failed', e)
      // Reload on error
      await fetchBoard()
    }
  }

  async function removeTask(columnId: string, taskId: string) {
    const col = board.value.columns.find(c => c.id === columnId)
    if (!col) return
    const t = col.tasks.find(t => t.id === taskId)
    if (!t || !(t as any)._id) return

    // Optimistic
    col.tasks = col.tasks.filter(t => t.id !== taskId)
    columnTotals.value[columnId] = Math.max(0, (columnTotals.value[columnId] || 0) - 1)

    try {
      await $fetch(`/api/tasks/${(t as any)._id}`, { method: 'DELETE' })
    } catch (e) {
      console.error('[useKanban] removeTask failed', e)
      await fetchBoard()
    }
  }

  // ─── Drag & Drop Reorder ──────────────────────────
  // Snapshot state before drag to compute minimal diff
  const _snapshot = useState<Record<string, { status: string, order: number }>>('kanban-snapshot', () => ({}))

  function takeSnapshot() {
    const snap: Record<string, { status: string, order: number }> = {}
    for (const col of board.value.columns) {
      col.tasks.forEach((t, idx) => {
        if ((t as any)._id) {
          snap[(t as any)._id] = { status: col.id, order: idx }
        }
      })
    }
    _snapshot.value = snap
  }

  async function setColumns(next: Column[]) {
    board.value.columns = next

    // Build diff — only tasks that actually changed column or order
    const updates: { _id: string, status: string, order: number }[] = []
    for (const col of next) {
      col.tasks.forEach((t, idx) => {
        const id = (t as any)._id
        if (!id) return
        const prev = _snapshot.value[id]
        if (!prev || prev.status !== col.id || prev.order !== idx) {
          updates.push({ _id: id, status: col.id, order: idx })
        }
      })
    }

    if (!updates.length) return

    // Throws on 403 (approval gate) so caller can revert
    const userCookie = useCookie<{ _id?: string, employee?: string } | null>('hardwood_user')
    await $fetch('/api/tasks/reorder', { method: 'POST', body: { updates, _changedBy: userCookie.value?.employee || '', _changedById: userCookie.value?._id || '' } })
  }

  // ─── Subtask CRUD ─────────────────────────────────
  async function addSubtask(columnId: string, taskId: string, title: string) {
    const col = board.value.columns.find(c => c.id === columnId)
    const task = col?.tasks.find(t => t.id === taskId)
    if (!task || !(task as any)._id) return

    const newSt = { id: nanoid(8), title, completed: false }
    if (!task.subtasks) task.subtasks = []
    task.subtasks.push(newSt)

    await $fetch(`/api/tasks/${(task as any)._id}`, {
      method: 'PUT',
      body: { subtasks: task.subtasks },
    }).catch(() => fetchBoard())
  }

  async function toggleSubtask(columnId: string, taskId: string, subtaskId: string) {
    const col = board.value.columns.find(c => c.id === columnId)
    const task = col?.tasks.find(t => t.id === taskId)
    if (!task?.subtasks) return
    const st = task.subtasks.find(s => s.id === subtaskId)
    if (st) st.completed = !st.completed

    await $fetch(`/api/tasks/${(task as any)._id}`, {
      method: 'PUT',
      body: { subtasks: task.subtasks },
    }).catch(() => fetchBoard())
  }

  async function removeSubtask(columnId: string, taskId: string, subtaskId: string) {
    const col = board.value.columns.find(c => c.id === columnId)
    const task = col?.tasks.find(t => t.id === taskId)
    if (!task?.subtasks) return
    task.subtasks = task.subtasks.filter(s => s.id !== subtaskId)

    await $fetch(`/api/tasks/${(task as any)._id}`, {
      method: 'PUT',
      body: { subtasks: task.subtasks },
    }).catch(() => fetchBoard())
  }

  // ─── Comment CRUD ─────────────────────────────────
  async function addComment(columnId: string, taskId: string, text: string, author?: string, avatar?: string) {
    const col = board.value.columns.find(c => c.id === columnId)
    const task = col?.tasks.find(t => t.id === taskId)
    if (!task || !(task as any)._id) return

    const newCm = {
      id: nanoid(8),
      author: author || 'Unknown',
      avatar: avatar || '',
      text,
      createdAt: new Date().toISOString(),
    }
    if (!task.comments) task.comments = []
    task.comments.push(newCm)

    await $fetch(`/api/tasks/${(task as any)._id}`, {
      method: 'PUT',
      body: { comments: task.comments },
    }).catch(() => fetchBoard())
  }

  async function removeComment(columnId: string, taskId: string, commentId: string) {
    const col = board.value.columns.find(c => c.id === columnId)
    const task = col?.tasks.find(t => t.id === taskId)
    if (!task?.comments) return
    task.comments = task.comments.filter(c => c.id !== commentId)

    await $fetch(`/api/tasks/${(task as any)._id}`, {
      method: 'PUT',
      body: { comments: task.comments },
    }).catch(() => fetchBoard())
  }

  // Stubs for column CRUD (not needed since columns are fixed)
  function addColumn(_title: string) { }
  function removeColumn(_id: string) { }
  function updateColumn(_id: string, _title: string) { }
  function persist() { }

  return {
    board,
    loading,
    loadingMore,
    hasMore,
    columnTotals,
    fetchBoard,
    loadMore,
    addColumn,
    removeColumn,
    updateColumn,
    addTask,
    updateTask,
    removeTask,
    setColumns,
    takeSnapshot,
    persist,
    addSubtask,
    toggleSubtask,
    removeSubtask,
    addComment,
    removeComment,
  }
}
