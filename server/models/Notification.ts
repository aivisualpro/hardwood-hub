import mongoose from 'mongoose'

/**
 * In-app notification — one document per recipient per event.
 * Created by the automation engine (server/utils/automationEngine.ts).
 */
const NotificationSchema = new mongoose.Schema(
  {
    // Recipient (Employee)
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    recipientEmail: { type: String, default: '' },

    // What happened
    title: { type: String, required: true },
    message: { type: String, default: '' },

    // Source event
    module: { type: String, default: '' }, // e.g. 'crm'
    submodule: { type: String, default: '' }, // e.g. 'estimates'
    action: { type: String, default: '' }, // 'create' | 'update' | 'delete'
    entityId: { type: String, default: '' }, // _id of the affected record
    entityLabel: { type: String, default: '' }, // human label, e.g. 'EST-1024 — Smith Floors'
    link: { type: String, default: '' }, // in-app route to open the record

    // Field-change details (for update events)
    field: { type: String, default: '' },
    oldValue: { type: String, default: '' },
    newValue: { type: String, default: '' },

    // Who triggered it
    actorId: { type: String, default: '' },
    actorName: { type: String, default: '' },
    actorEmail: { type: String, default: '' },

    // Which automation rule produced it
    ruleId: { type: mongoose.Schema.Types.ObjectId, ref: 'NotificationAutomation', default: null },
    ruleName: { type: String, default: '' },

    // Read state
    readAt: { type: Date, default: null },

    // Email delivery state
    emailSent: { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'hardwoodDB_Notifications' },
)

NotificationSchema.index({ recipientId: 1, readAt: 1, createdAt: -1 })
NotificationSchema.index({ createdAt: -1 })

export const Notification = (mongoose.models.Notification
  || mongoose.model('Notification', NotificationSchema)) as any
