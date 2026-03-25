import mongoose from 'mongoose'

const CrmSubmissionSchema = new mongoose.Schema(
  {
    // Link to Gravity Forms entry
    gfEntryId: { type: String, required: true, unique: true, index: true },
    gfFormId: { type: Number, required: true, index: true },
    formName: { type: String, default: '' },

    // Canonical CRM type
    type: {
      type: String,
      required: true,
      enum: ['appointment', 'fast-quote', 'flooring-estimate', 'subscriber', 'conditional-logic', 'other'],
      index: true,
    },

    // Parsed contact info
    name: { type: String, default: '' },
    firstName: { type: String, default: '' },
    lastName: { type: String, default: '' },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    address: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    zip: { type: String, default: '' },
    message: { type: String, default: '' },

    // Form-specific extended data (stores all raw fields)
    fields: { type: mongoose.Schema.Types.Mixed, default: {} },

    // Metadata
    status: { type: String, default: 'new', enum: ['new', 'contacted', 'in-progress', 'completed', 'archived'] },
    starred: { type: Boolean, default: false },
    notes: { type: String, default: '' },

    // Original GF dates
    dateSubmitted: { type: Date },
    dateUpdated: { type: Date },
    sourceUrl: { type: String, default: '' },
    ip: { type: String, default: '' },
  },
  {
    timestamps: true,
    collection: 'hardwoodDB_CrmSubmissions',
  },
)

// Compound index for efficient form-type queries
CrmSubmissionSchema.index({ type: 1, dateSubmitted: -1 })

export interface ICrmSubmission {
  _id?: any
  gfEntryId: string
  gfFormId: number
  formName: string
  type: 'appointment' | 'fast-quote' | 'flooring-estimate' | 'subscriber' | 'conditional-logic' | 'other'
  name: string
  firstName: string
  lastName: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  zip: string
  message: string
  fields: any
  status: 'new' | 'contacted' | 'in-progress' | 'completed' | 'archived'
  starred: boolean
  notes: string
  dateSubmitted: Date
  dateUpdated: Date
  sourceUrl: string
  ip: string
}

export const CrmSubmission =
  mongoose.models.CrmSubmission || mongoose.model<ICrmSubmission>('CrmSubmission', CrmSubmissionSchema)
