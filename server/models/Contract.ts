import mongoose from 'mongoose'

const ContractSchema = new mongoose.Schema(
    {
        contractNumber: { type: String, required: true, unique: true, trim: true },
        title: { type: String, required: true, trim: true },

        // Link to customer (CRM Submission)
        customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'CrmSubmission', required: true },
        customerName: { type: String, default: '' },
        customerEmail: { type: String, default: '' },
        customerPhone: { type: String, default: '' },
        customerAddress: { type: String, default: '' },

        // Link to template
        templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'ContractTemplate' },
        templateName: { type: String, default: '' },

        // Variable values filled by user
        variableValues: { type: mongoose.Schema.Types.Mixed, default: {} },

        // System Signature Fields
        customerSignature: { type: String, default: '' },
        customerSignatureDate: { type: Date, default: null },

        // Signing flow
        signingToken: { type: String, default: '', index: true },
        sentAt: { type: Date, default: null },

        // Rendered content (template + variable values merged)
        content: { type: String, default: '' },
        
        // Attached PDF string (base64 or URL)
        attachedPdf: { type: String, default: '' },

        // Status
        status: {
            type: String,
            enum: ['draft', 'pending', 'sent', 'signed', 'completed', 'cancelled'],
            default: 'draft',
        },

        // Metadata
        notes: { type: String, default: '' },
        createdBy: { type: String, default: '' },
    },
    { timestamps: true, collection: 'hardwoodDB_Contracts' },
)

ContractSchema.index({ status: 1, createdAt: -1 })

export const Contract = mongoose.models.Contract || mongoose.model('Contract', ContractSchema)
