import mongoose from 'mongoose'

const EstimateSchema = new mongoose.Schema(
  {
    estimateNumber: { type: String, required: true, unique: true, trim: true },
    title: { type: String, required: true, trim: true },

    // Link to customer (CRM Submission)
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'CrmSubmission', required: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pipeline', default: null },
    customerName: { type: String, default: '' },
    customerEmail: { type: String, default: '' },
    customerPhone: { type: String, default: '' },
    customerAddress: { type: String, default: '' },

    // Link to template
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'EstimateTemplate' },
    templateName: { type: String, default: '' },

    // Variable values filled by user
    variableValues: { type: mongoose.Schema.Types.Mixed, default: {} },

    // Rendered content (template + variable values merged)
    content: { type: String, default: '' },

    // Attached PDF string (base64 or URL)
    attachedPdf: { type: String, default: '' },

    // Attached from Customer Gallery (Array of URLs/base64)
    attachedGalleryImages: { type: [String], default: [] },

    // Final merged PDF (estimate + attached PDF) cached on Vercel Blob.
    // Generated on save; downloaded directly without re-rendering.
    mergedPdfUrl: { type: String, default: '' },
    mergedPdfGeneratedAt: { type: Date, default: null },

    // Sent tracking
    sentAt: { type: Date, default: null },

    // Token for public estimate response page (Approve/Change Request/Decline)
    responseToken: { type: String, default: '', index: true },

    // Client response (filled when customer clicks Approve/Change Request/Decline)
    clientResponse: {
      action: { type: String, enum: ['approved', 'change_request', 'declined', ''], default: '' },
      message: { type: String, default: '' },
      respondedAt: { type: Date, default: null },
    },

    // Status
    status: {
      type: String,
      enum: ['draft', 'sent', 'approved', 'change_request', 'declined', 'completed', 'cancelled'],
      default: 'draft',
    },

    // Metadata
    notes: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
  },
  { timestamps: true, collection: 'hardwoodDB_Estimates' },
)

EstimateSchema.index({ status: 1, createdAt: -1 })

export const Estimate = (mongoose.models.Estimate || mongoose.model('Estimate', EstimateSchema)) as any
