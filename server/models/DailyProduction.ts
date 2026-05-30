import type { Document, Types } from 'mongoose'
import mongoose, { Schema } from 'mongoose'

// ─── Sub-schemas ──────────────────────────────────────────
const WorkBlockSchema = new Schema(
  {
    category: { type: String, default: null },
    subtype: { type: String, default: null },
    hours: { type: Number, default: null },
    sqft: { type: Number, default: null },
    edgeLf: { type: Number, default: null },
    trimLf: { type: Number, default: null },
    count: { type: Number, default: null },
    equipment: { type: [String], default: [] },
    gritsBig: { type: [Number], default: [] },
    gritsEdger: { type: [Number], default: [] },
    shoeDisposition: { type: String, default: null },
    shoeCount: { type: Number, default: null },
  },
  { _id: false },
)

const NpItemSchema = new Schema(
  {
    type: { type: String, required: true },
    minutes: { type: Number, default: 0 },
    detail: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false },
)

// ─── Main document interface ──────────────────────────────
export interface IDailyProduction extends Document {
  date?: string
  emp?: Types.ObjectId
  job?: Types.ObjectId
  ontime?: boolean
  blocks?: {
    category?: string
    subtype?: string
    hours?: number
    sqft?: number
    edgeLf?: number
    trimLf?: number
    count?: number
    equipment?: string[]
    gritsBig?: number[]
    gritsEdger?: number[]
    shoeDisposition?: string
    shoeCount?: number
  }[]
  np_items?: {
    type: string
    minutes?: number
    detail?: Record<string, any>
  }[]
  np_total_mins?: number
  blockers?: string[]
  notes?: string
  submitted?: Date
  createdBy?: Types.ObjectId
}

// ─── Schema ───────────────────────────────────────────────
const DailyProductionSchema = new Schema(
  {
    date: { type: String, default: null },
    emp: { type: Schema.Types.ObjectId, ref: 'Employee', default: null },
    job: { type: Schema.Types.ObjectId, ref: 'CrmSubmission', default: null },
    ontime: { type: Boolean, default: null },
    blocks: { type: [WorkBlockSchema], default: [] },
    np_items: { type: [NpItemSchema], default: [] },
    np_total_mins: { type: Number, default: 0 },
    blockers: { type: [String], default: [] },
    notes: { type: String, default: null },
    submitted: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Employee', default: null },
  },
  { timestamps: true },
)

// Indexes for dashboard and reporting queries
DailyProductionSchema.index({ createdAt: -1 })
DailyProductionSchema.index({ emp: 1, date: -1 })
DailyProductionSchema.index({ date: -1 })
DailyProductionSchema.index({ createdBy: 1 })

export const DailyProduction = mongoose.models.DailyProduction || mongoose.model<IDailyProduction>('DailyProduction', DailyProductionSchema, 'hardwoodDB_DailyProduction')
