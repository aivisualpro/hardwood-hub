import mongoose from 'mongoose'

const PipelineSchema = new mongoose.Schema(
  {
    name: { type: String, default: '' },
    projectName: { type: String, default: '' },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
    customerName: { type: String, default: '' },
    firstName: { type: String, default: '' },
    lastName: { type: String, default: '' },
    email: { type: String, default: '', index: true },
    phone: { type: String, default: '', index: true },
    address: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    zip: { type: String, default: '' },
    notes: { type: String, default: '' },
    stage: { type: String, default: '' },
    status: { type: mongoose.Schema.Types.ObjectId, default: null },
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
    gallery: [{
      url: { type: String, required: true },
      caption: { type: String, default: '' },
      uploadedAt: { type: Date, default: Date.now },
    }],
    relatedContacts: [{
      firstName: { type: String, default: '' },
      lastName: { type: String, default: '' },
      title: { type: String, default: '' },
      emails: [{ type: String }],
      phones: [{ type: String }],
      preferredContact: { type: String, default: '' },
      address: { type: String, default: '' },
    }],
  },
  {
    timestamps: true,
    collection: 'hardwoodDB_pipeline',
  },
)

// Indexes for pipeline and search performance
PipelineSchema.index({ status: 1, name: 1 })
PipelineSchema.index({ createdAt: -1 })
PipelineSchema.index({ email: 1, phone: 1 })

export interface IPipeline {
  _id?: any
  name: string
  projectName?: string
  customerId?: any
  firstName: string
  lastName: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  zip: string
  notes: string
  stage?: string
  status?: any
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
  gallery?: Array<{
    url: string
    caption?: string
    uploadedAt: Date
  }>
  relatedContacts?: Array<{
    _id?: any
    firstName?: string
    lastName?: string
    title?: string
    emails?: string[]
    phones?: string[]
    preferredContact?: string
    address?: string
  }>
  createdAt?: Date
  updatedAt?: Date
}

export const Pipeline
  = mongoose.models.Pipeline || mongoose.model<IPipeline>('Pipeline', PipelineSchema)
