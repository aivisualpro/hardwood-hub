import mongoose from 'mongoose'

/**
 * Automation rule — configured on the Notifications → Automations tab.
 *
 * Shape of a rule:
 *   WHEN  <action> happens in <module>/<submodule>
 *   [IF   <field> changes (optionally to one of <values>)]
 *   THEN  notify <assignees> [+ email]
 */
const NotificationAutomationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    // Scope
    module: { type: String, required: true }, // 'crm' | 'hr' | 'learning-center' | 'project-management'
    submodule: { type: String, required: true }, // e.g. 'estimates'

    // Trigger
    action: { type: String, required: true, enum: ['create', 'update', 'delete'] },

    // Field condition (mainly for 'update')
    field: { type: String, default: '' }, // e.g. 'status' — empty = any change
    // 'any'         → fire on any change of the field (or any event when field empty)
    // 'changes_to'  → fire when field's NEW value is one of `values`
    // 'changes_from'→ fire when field's OLD value is one of `values`
    operator: { type: String, default: 'any', enum: ['any', 'changes_to', 'changes_from'] },
    values: { type: [String], default: [] }, // raw values (dropdown option ids or enum strings)
    valueLabels: { type: [String], default: [] }, // human labels snapshot for display

    // Who gets notified
    assignees: { type: [mongoose.Schema.Types.ObjectId], ref: 'Employee', default: [] },

    // What it says — supports {{entity}} {{field}} {{old}} {{new}} {{actor}} {{action}} placeholders
    messageTemplate: { type: String, default: '' },

    // Delivery
    sendEmail: { type: Boolean, default: false },

    // State
    enabled: { type: Boolean, default: true },
    lastFiredAt: { type: Date, default: null },
    fireCount: { type: Number, default: 0 },

    createdBy: { type: String, default: '' }, // actor email
  },
  { timestamps: true, collection: 'hardwoodDB_NotificationAutomations' },
)

NotificationAutomationSchema.index({ module: 1, submodule: 1, action: 1, enabled: 1 })

export const NotificationAutomation = (mongoose.models.NotificationAutomation
  || mongoose.model('NotificationAutomation', NotificationAutomationSchema)) as any
