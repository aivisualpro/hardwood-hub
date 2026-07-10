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

    // Extracted PDF line items and totals
    lineItems: [
      {
        room: { type: String, default: '' },
        sku: { type: String, default: '' },
        description: { type: String, default: '' },
        quantity: { type: Number, default: 0 },
        unit: { type: String, default: '' },
        price: { type: Number, default: 0 },
        amount: { type: Number, default: 0 },
      },
    ],
    materialTotal: { type: Number, default: 0 },
    laborTotal: { type: Number, default: 0 },
    taxTotal: { type: Number, default: 0 },
    discountTotal: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },

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

    statusTimeline: [
      {
        action: { type: String, required: true },
        message: { type: String, default: '' },
        timestamp: { type: Date, default: Date.now },
        performedBy: { type: String, default: '' },
        sentToEmail: { type: String, default: '' },
      },
    ],

    // Status
    status: {
      type: String,
      enum: ['draft', 'sent', 'received', 'approved', 'change_request', 'declined', 'completed', 'cancelled'],
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
