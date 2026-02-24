import { z } from 'zod'

// Sub-task schema
export const subTaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string().default('todo'),
  priority: z.string().default('medium'),
  assignee: z.string().optional(),
  dueDate: z.string().optional(),
  createdAt: z.string().optional(),
})

export type SubTask = z.infer<typeof subTaskSchema>

// We're keeping a simple non-relational schema here.
// IRL, you will have a schema for your data models.
export const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  label: z.string(),
  priority: z.string(),
  createdAt: z.string().optional(),
  dueDate: z.string().optional(),
  assignees: z.array(z.string()).optional(),
  description: z.string().optional(),
  subtasks: z.array(subTaskSchema).optional(),
})

export type Task = z.infer<typeof taskSchema>
