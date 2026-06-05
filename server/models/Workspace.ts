import type { Document } from 'mongoose'
import mongoose, { Schema } from 'mongoose'

export interface IWorkspace extends Document {
  name: string
  logo: string
  plan: string
  allowedMenus: string[]
  menuPermissions: Record<string, string[]>
  fieldPermissions: Record<string, Record<string, 'hidden' | 'read' | 'edit'>>
  isLocked: boolean
}

const WorkspaceSchema = new Schema(
  {
    name: { type: String, required: true },
    logo: { type: String, default: 'i-lucide-building' },
    plan: { type: String, default: 'Workspace' },
    allowedMenus: { type: [String], default: [] },
    menuPermissions: { type: Schema.Types.Mixed, default: {} },
    fieldPermissions: { type: Schema.Types.Mixed, default: {} },
    isLocked: { type: Boolean, default: false },
  },
  { timestamps: true },
)

export const Workspace = mongoose.models.Workspace || mongoose.model<IWorkspace>('Workspace', WorkspaceSchema)
