import mongoose from 'mongoose'

const EmployeeSchema = new mongoose.Schema(
    {
        employee: { type: String, required: true, trim: true },
        email: { type: String, required: true, trim: true, lowercase: true },
        position: { type: String, required: true, trim: true },
        profileImage: { type: String, default: '' }, // Always a Cloudinary URL
        status: { type: String, default: 'Active', enum: ['Active', 'Inactive'] },
        workspace: { type: String, default: '' }, // Workspace ID
        basePay: { type: Number, default: 0 }, // Base pay in USD
        gmailTokens: { type: String, default: '' }, // AES-256 encrypted OAuth2 tokens
        gmailEmail: { type: String, default: '' }, // Connected Gmail address
    },
    { timestamps: true, collection: 'hardwoodDB_Employees' },
)

export const Employee = mongoose.models.Employee || mongoose.model('Employee', EmployeeSchema)
