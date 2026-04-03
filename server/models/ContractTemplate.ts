import mongoose from 'mongoose'

const ContractTemplateSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        slug: { type: String, required: true, unique: true, trim: true },
        description: { type: String, default: '' },
        content: { type: String, default: '' },
        variables: [{ 
            key: { type: String, required: true },
            label: { type: String, required: true },
            type: { type: String, enum: ['text', 'date', 'number', 'currency', 'textarea', 'select'], default: 'text' },
            defaultValue: { type: String, default: '' },
            options: [String], // for select type
            required: { type: Boolean, default: false },
        }],
        category: { type: String, default: 'General' },
        isActive: { type: Boolean, default: true },
        createdBy: { type: String, default: '' },
    },
    { timestamps: true, collection: 'hardwoodDB_ContractTemplates' },
)

export const ContractTemplate = mongoose.models.ContractTemplate || mongoose.model('ContractTemplate', ContractTemplateSchema)
