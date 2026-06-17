import mongoose from 'mongoose'

const ChangeOrderSchema = new mongoose.Schema(
  {
    changeOrderNumber: { type: String, required: true, unique: true, trim: true },
    title: { type: String, required: true, trim: true },

    // Link to customer (CRM Submission / Pipeline)
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'CrmSubmission', required: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pipeline', default: null },
    customerName: { type: String, default: '' },
    customerEmail: { type: String, default: '' },
    customerPhone: { type: String, default: '' },
    customerAddress: { type: String, default: '' },
    projectName: { type: String, default: '' },

    // Link to template (always the Change Order Agreement template)
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'ContractTemplate' },
    templateName: { type: String, default: '' },

    // Variable values filled by user
    variableValues: { type: mongoose.Schema.Types.Mixed, default: {} },

    // Rendered content (template snapshot)
    content: { type: String, default: '' },

    // Metadata
    notes: { type: String, default: '' },
    createdBy: { type: String, default: '' },
  },
  { timestamps: true, collection: 'hardwoodDB_ChangeOrders' },
)

ChangeOrderSchema.index({ createdAt: -1 })
ChangeOrderSchema.index({ customerId: 1 })

export const ChangeOrder = (mongoose.models.ChangeOrder || mongoose.model('ChangeOrder', ChangeOrderSchema)) as any
