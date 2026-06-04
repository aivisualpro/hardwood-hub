import mongoose from 'mongoose'

const DocumentSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pipeline', required: true, index: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null, index: true },
    date: { type: Date, default: Date.now },
    documentType: { type: String, default: '' },
    files: [{
      url: { type: String, required: true },
      name: { type: String, default: '' },
      size: { type: Number, default: 0 },
      type: { type: String, default: '' },
    }],
    uploadedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    collection: 'hardwoodDB_Documents',
  },
)

DocumentSchema.index({ projectId: 1, createdAt: -1 })

export const Document = mongoose.models.Document || mongoose.model('Document', DocumentSchema)
