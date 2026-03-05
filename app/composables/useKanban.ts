import type { Column, NewTask, Task } from '~/types/kanban'
import { nanoid } from 'nanoid'

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
      // Seed first (no-op if already seeded)
      await $fetch('/api/tasks/seed', { method: 'POST' })

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
      id: t.taskId,
      _id: t._id,
      title: t.title,
      description: t.description,
      priority: t.priority,
      assignee: t.assignee,
      dueDate: t.dueDate,
      status: t.status,
      labels: t.labels || [],
      subtasks: t.subtasks || [],
      comments: t.comments || [],
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
    } catch (e) {
      console.error('[useKanban] addTask failed', e)
    }
  }

  async function updateTask(columnId: string, taskId: string, patch: Partial<Task>) {
    const col = board.value.columns.find(c => c.id === columnId)
    const t = col?.tasks.find(t => t.id === taskId)
    if (!t || !(t as any)._id) return

    // Optimistic
    Object.assign(t, patch)
    try {
      await $fetch(`/api/tasks/${(t as any)._id}`, { method: 'PUT', body: patch })
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
  async function setColumns(next: Column[]) {
    board.value.columns = next

    // Build bulk update payload
    const updates: { _id: string, status: string, order: number }[] = []
    for (const col of next) {
      col.tasks.forEach((t, idx) => {
        if ((t as any)._id) {
          updates.push({ _id: (t as any)._id, status: col.id, order: idx })
        }
      })
    }

    try {
      await $fetch('/api/tasks/reorder', { method: 'POST', body: { updates } })
    } catch (e) {
      console.error('[useKanban] reorder failed', e)
    }
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
    persist,
    addSubtask,
    toggleSubtask,
    removeSubtask,
    addComment,
    removeComment,
  }
}
