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
  assignees?: {
    _id: string
    employee: string
    profileImage?: string
  }[]
  createdBy?: {
    _id: string
    employee: string
    profileImage?: string
  }
  dueDate?: Date | number | string
  status?: string
  labels?: string[]
  subtasks?: Subtask[]
  comments?: Comment[]
  approvedBy?: {
    _id: string
    employee: string
    profileImage?: string
  }
  createdAt: Date | number | string
  updatedAt?: Date | number | string
  completionDate?: Date | number | string
}

export interface NewTask extends Omit<Task, 'id' | 'createdAt' | 'assignees' | 'createdBy'> {
  assignees?: string[] | Task['assignees']
  createdBy?: string | Task['createdBy']
}

export interface Column {
  id: string
  title: string
  tasks: Task[]
}

export interface BoardState {
  columns: Column[]
}
