import mongoose, { Schema, Document } from 'mongoose'

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

export interface ITask extends Document {
    taskId: string          // human-readable e.g. TASK-001
    title: string
    description?: string
    priority?: 'low' | 'medium' | 'high'
    assignee?: {
        id: string
        name: string
        avatar?: string
    }
    dueDate?: Date
    status: 'todo' | 'in-progress' | 'in-review' | 'done'
    labels?: string[]
    subtasks: ISubtask[]
    comments: IComment[]
    order: number           // for drag-and-drop ordering within a column
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

const TaskSchema = new Schema(
    {
        taskId: { type: String, required: true, unique: true, index: true },
        title: { type: String, required: true },
        description: { type: String, default: '' },
        priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
        assignee: {
            type: {
                id: { type: String },
                name: { type: String },
                avatar: { type: String },
            },
            default: null,
        },
        dueDate: { type: Date, default: null },
        status: { type: String, enum: ['todo', 'in-progress', 'in-review', 'done'], required: true, index: true },
        labels: { type: [String], default: [] },
        subtasks: { type: [SubtaskSchema], default: [] },
        comments: { type: [CommentSchema], default: [] },
        order: { type: Number, default: 0, index: true },
    },
    {
        timestamps: true,
        collection: 'hardwoodDB_tasks',
    }
)

// Compound index for efficient column queries
TaskSchema.index({ status: 1, order: 1 })

export const Task = mongoose.models.Task || mongoose.model<ITask>('Task', TaskSchema)
