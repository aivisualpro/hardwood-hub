import mongoose from 'mongoose'

const EmployeeSchema = new mongoose.Schema(
    {
        employee: { type: String, required: true, trim: true },
        email: { type: String, required: true, trim: true, lowercase: true },
        position: { type: String, required: true, trim: true },
        profileImage: { type: String, default: '' }, // Always a Cloudinary URL
        status: { type: String, default: 'Active', enum: ['Active', 'Inactive'] },
    },
    { timestamps: true, collection: 'hardwoodDB_Employees' },
)

export const Employee = mongoose.models.Employee || mongoose.model('Employee', EmployeeSchema)
