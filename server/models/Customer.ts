import mongoose from 'mongoose'

const CustomerSchema = new mongoose.Schema(
  {
    name: { type: String, default: '' },
    firstName: { type: String, default: '' },
    lastName: { type: String, default: '' },
    email: { type: String, default: '', index: true },
    phone: { type: String, default: '', index: true },
    address: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    zip: { type: String, default: '' },
    type: { type: String, default: 'lead' }, // 'lead', 'client', etc.
    status: { type: String, default: 'new' }, // 'new', 'contacted', 'converted', etc.
    notes: { type: String, default: '' },
    stage: { type: String, default: '' },
    estimatedProjectDuration: { type: String, default: '' },
    totalEstimate: { type: Number, default: null },
    assignedTo: { type: String, default: '' },
    totalTrackedViews: { type: Number, default: 0 },
    estimateSentOn: { type: Date, default: null },
    initialContactDate: { type: Date, default: null },
    lastFollowUpSentOn: { type: Date, default: null },
    dateApproved: { type: Date, default: null },
    projectAssignedTo: { type: String, default: '' },
    woodOrderDate: { type: Date, default: null },
    tags: [{ type: String }],
  },
  {
    timestamps: true,
    collection: 'hardwoodDB_Customers',
  }
)

// Index for better searching
CustomerSchema.index({ email: 1, phone: 1 })

export interface ICustomer {
  _id?: any
  name: string
  firstName: string
  lastName: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  zip: string
  type: string
  status: string
  notes: string
  stage?: string
  estimatedProjectDuration?: string
  totalEstimate?: number
  assignedTo?: string
  totalTrackedViews?: number
  estimateSentOn?: Date
  initialContactDate?: Date
  lastFollowUpSentOn?: Date
  dateApproved?: Date
  projectAssignedTo?: string
  woodOrderDate?: Date
  tags?: string[]
  createdAt?: Date
  updatedAt?: Date
}

export const Customer =
  mongoose.models.Customer || mongoose.model<ICustomer>('Customer', CustomerSchema)
