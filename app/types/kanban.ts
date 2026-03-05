export interface Subtask {
  id: string
  title: string
  completed: boolean
}

export interface Comment {
  id: string
  author: string
  avatar?: string
  text: string
  createdAt: Date | number | string
}

export interface Task {
  id: string
  _id?: string
  title: string
  description?: string
  priority?: 'low' | 'medium' | 'high'
  assignee?: {
    id: string
    name: string
    avatar?: string
  }
  dueDate?: Date | number | string
  status?: string
  labels?: string[]
  subtasks?: Subtask[]
  comments?: Comment[]
  createdAt: Date | number | string
}

export interface NewTask extends Omit<Task, 'id' | 'assignee' | 'createdAt'> {
}

export interface Column {
  id: string
  title: string
  tasks: Task[]
}

export interface BoardState {
  columns: Column[]
}
