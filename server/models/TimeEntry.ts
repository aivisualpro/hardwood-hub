import mongoose from 'mongoose'

const TimeEntrySchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    employeeName: { type: String, default: '' },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pipeline', default: null },
    projectName: { type: String, default: '' },
    customerName: { type: String, default: '' },
    clockIn: { type: Date, required: true },
    clockOut: { type: Date, default: null },
    duration: { type: Number, default: null }, // minutes, computed on clock-out
    notes: { type: String, default: '' },
    status: { type: String, enum: ['active', 'completed'], default: 'active' },
  },
  {
    timestamps: true,
    collection: 'hardwoodDB_timeEntries',
  },
)

// Indexes for dashboard and query performance
TimeEntrySchema.index({ employeeId: 1, status: 1 })
TimeEntrySchema.index({ projectId: 1 })
TimeEntrySchema.index({ clockIn: -1 })
TimeEntrySchema.index({ status: 1, clockIn: -1 })

export const TimeEntry
  = mongoose.models.TimeEntry || mongoose.model('TimeEntry', TimeEntrySchema)
