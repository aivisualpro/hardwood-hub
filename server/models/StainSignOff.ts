import type { Document } from 'mongoose'
import mongoose, { Schema } from 'mongoose'

export interface IStainSignOff extends Document {
  customerId?: string
  customerName?: string
  projectId?: string
  projectName?: string
  clientName?: string
  email?: string
  stainColorAdditive?: string[]
  isStainSamplesThrough?: boolean
  isScreensNotAnAccurate?: boolean
  isWoodNaturalProduct?: boolean
  isAnyChangesColorsYourExpense?: boolean
  isMaplePineOther?: boolean
  specialNotes?: string
  isSigned?: boolean
  signature?: string
  createdBy?: string
}

const StainSignOffSchema = new Schema(
  {
    customerId: { type: String, default: null },
    customerName: { type: String, default: null },
    projectId: { type: String, default: null },
    projectName: { type: String, default: null },
    clientName: { type: String, default: null },
    email: { type: String, default: null },
    stainColorAdditive: { type: [String], default: [] },
    isStainSamplesThrough: { type: Boolean, default: false },
    isScreensNotAnAccurate: { type: Boolean, default: false },
    isWoodNaturalProduct: { type: Boolean, default: false },
    isAnyChangesColorsYourExpense: { type: Boolean, default: false },
    isMaplePineOther: { type: Boolean, default: false },
    specialNotes: { type: String, default: null },
    isSigned: { type: Boolean, default: false },
    signature: { type: String, default: null },
    createdBy: { type: String, default: null },
  },
  { timestamps: true },
)

export const StainSignOff = mongoose.models.StainSignOff || mongoose.model<IStainSignOff>('StainSignOff', StainSignOffSchema, 'hardwoodDB_StainSignOff')
