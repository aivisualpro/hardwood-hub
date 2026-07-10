/**
 * Zod schema for creating/updating notification automation rules.
 * Shared by POST /api/notifications/automations and PUT /api/notifications/automations/:id
 */
import { z } from 'zod'

export const AutomationSchema = z.object({
  name: z.string().trim().min(1).max(120),
  module: z.string().trim().min(1),
  submodule: z.string().trim().min(1),
  action: z.enum(['create', 'update', 'delete']),
  field: z.string().trim().max(64).default(''),
  operator: z.enum(['any', 'changes_to', 'changes_from']).default('any'),
  values: z.array(z.string().max(256)).max(50).default([]),
  valueLabels: z.array(z.string().max(256)).max(50).default([]),
  assignees: z.array(z.string().regex(/^[0-9a-f]{24}$/i)).min(1, 'Select at least one assignee').max(200),
  messageTemplate: z.string().max(2000).default(''),
  sendEmail: z.boolean().default(false),
  enabled: z.boolean().default(true),
})
