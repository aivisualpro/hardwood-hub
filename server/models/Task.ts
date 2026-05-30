import type { Document } from 'mongoose'
import mongoose, { Schema } from 'mongoose'

export interface ISubtask {
  id: string
  title: string
  completed: boolean
}

export interface IComment {
  id: string
  author: string
  avatar?: string
  text: string
  createdAt: Date
}

export interface IChangelog {
  field: string
  oldValue?: any
  newValue?: any
  changedBy: string
  changedAt: Date
}

export interface ITask extends Document {
  title: string
  description?: string
  priority?: 'low' | 'medium' | 'high'
  assignees?: mongoose.Types.ObjectId[] | {
    _id: mongoose.Types.ObjectId
    employee: string
    profileImage?: string
  }[]
  createdBy?: mongoose.Types.ObjectId | {
    _id: mongoose.Types.ObjectId
    employee: string
    profileImage?: string
  }
  dueDate?: Date
  status: 'todo' | 'in-progress' | 'in-review' | 'done'
  labels?: string[]
  subtasks: ISubtask[]
  comments: IComment[]
  changelog: IChangelog[]
  order: number // for drag-and-drop ordering within a column
  approvedBy?: mongoose.Types.ObjectId | {
    _id: mongoose.Types.ObjectId
    employee: string
    profileImage?: string
  }
  createdAt: Date
  updatedAt: Date
}

const SubtaskSchema = new Schema({
  id: { type: String, required: true },
  title: { type: String, required: true },
  completed: { type: Boolean, default: false },
}, { _id: false })

const CommentSchema = new Schema({
  id: { type: String, required: true },
  author: { type: String, required: true },
  avatar: { type: String, default: '' },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
}, { _id: false })

const ChangelogSchema = new Schema({
  field: { type: String, required: true },
  oldValue: { type: Schema.Types.Mixed },
  newValue: { type: Schema.Types.Mixed },
  changedBy: { type: String, default: '' },
  changedAt: { type: Date, default: Date.now },
}, { _id: false })

const TaskSchema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: '' },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    assignees: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Employee' }],
      default: [],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },
    dueDate: { type: Date, default: null },
    status: { type: String, enum: ['todo', 'in-progress', 'in-review', 'done'], required: true, index: true },
    labels: { type: [String], default: [] },
    subtasks: { type: [SubtaskSchema], default: [] },
    comments: { type: [CommentSchema], default: [] },
    changelog: { type: [ChangelogSchema], default: [] },
    order: { type: Number, default: 0, index: true },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'hardwoodDB_tasks',
  },
)

// Compound indexes for efficient kanban queries
TaskSchema.index({ status: 1, order: 1 })
TaskSchema.index({ status: 1, dueDate: 1, createdAt: -1 })
TaskSchema.index({ assignees: 1 })
TaskSchema.index({ createdBy: 1 })

export const Task = mongoose.models.Task || mongoose.model<ITask>('Task', TaskSchema)
