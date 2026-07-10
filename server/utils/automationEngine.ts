/**
 * Notification Automation Engine
 *
 * Routes call fireAutomations() after a create/update/delete. The engine:
 *   1. Finds enabled rules matching module + submodule + action
 *   2. Evaluates each rule's field condition against before/after docs
 *   3. Creates one hardwoodDB_Notifications doc per assignee
 *   4. Optionally emails each assignee (non-blocking)
 *
 * Fire-and-forget by design — it must NEVER break or slow down the calling route.
 */
import { Notification } from '../models/Notification'
import { NotificationAutomation } from '../models/NotificationAutomation'
import { findSubmodule } from './automationRegistry'
import { logger } from './logger'

const log = logger('[Automations]')

export interface AutomationEvent {
  module: string // e.g. 'crm'
  submodule: string // e.g. 'estimates'
  action: 'create' | 'update' | 'delete'
  before?: Record<string, any> | null // doc before the change (update/delete)
  after?: Record<string, any> | null // doc after the change (create/update)
  actor?: { id?: string, email?: string, name?: string } | null
}

/** Extract actor info from the H3 event's session (set by 02.apiAuth.ts). */
export function actorFromEvent(event: any): AutomationEvent['actor'] {
  const session = event?.context?.session
  if (!session)
    return { id: '', email: 'System', name: 'System' }
  return { id: session.id || '', email: session.email || '', name: '' }
}

/** Fire-and-forget entry point — safe to call from any route. */
export function fireAutomations(evt: AutomationEvent): void {
  runAutomations(evt).catch((e: any) => {
    log.warn('automation run failed:', e?.message || e)
  })
}

// ─────────────────────────────────────────────────────────────────────────────

function normalize(v: any): string {
  if (v === null || v === undefined)
    return ''
  if (v instanceof Date)
    return v.toISOString()
  return String(v)
}

function getField(doc: Record<string, any> | null | undefined, key: string): string {
  if (!doc)
    return ''
  return normalize(doc[key])
}

/** Resolve dropdown option ObjectIds → human labels (e.g. Customer Status). */
async function resolveLabel(dropdownName: string | undefined, raw: string): Promise<string> {
  if (!raw)
    return ''
  if (!dropdownName)
    return raw
  try {
    const { Dropdown } = await import('../models/Dropdown')
    const dd = await Dropdown.findOne({ name: dropdownName }).lean()
    const opt = (dd?.options || []).find((o: any) => String(o._id) === raw || o.value === raw)
    return opt?.label || raw
  }
  catch {
    return raw
  }
}

function buildEntityLabel(sub: { labelFields: string[] }, doc: Record<string, any> | null | undefined): string {
  if (!doc)
    return ''
  const parts = sub.labelFields.map(k => normalize(doc[k])).filter(Boolean)
  return parts.join(' — ')
}

const ACTION_VERB: Record<string, string> = {
  create: 'created',
  update: 'updated',
  delete: 'deleted',
}

function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => vars[key] ?? '')
}

async function runAutomations(evt: AutomationEvent): Promise<void> {
  const rules = await NotificationAutomation.find({
    module: evt.module,
    submodule: evt.submodule,
    action: evt.action,
    enabled: true,
  }).lean()

  if (!rules.length)
    return

  const reg = findSubmodule(evt.module, evt.submodule)
  const sub = reg?.sub
  const doc = evt.after || evt.before || {}
  const entityId = normalize(doc._id)
  const entityLabel = (sub ? buildEntityLabel(sub, doc) : '') || entityId

  // Resolve actor display name once (best effort)
  let actorName = evt.actor?.name || ''
  if (!actorName && evt.actor?.id) {
    try {
      const { Employee } = await import('../models/Employee')
      const emp = await Employee.findById(evt.actor.id).lean()
      actorName = emp?.employee || ''
    }
    catch { /* noop */ }
  }
  if (!actorName)
    actorName = evt.actor?.email || 'System'

  for (const rule of rules) {
    try {
      await evaluateRule(rule, evt, { sub, entityId, entityLabel, actorName })
    }
    catch (e: any) {
      log.warn(`rule "${rule.name}" failed:`, e?.message || e)
    }
  }
}

async function evaluateRule(
  rule: any,
  evt: AutomationEvent,
  ctx: { sub: any, entityId: string, entityLabel: string, actorName: string },
): Promise<void> {
  const fieldKey = rule.field || ''
  const regField = fieldKey && ctx.sub
    ? (ctx.sub.fields || []).find((f: any) => f.key === fieldKey)
    : null

  let oldRaw = ''
  let newRaw = ''

  // ── Condition check ───────────────────────────────────────────────────────
  if (fieldKey) {
    oldRaw = getField(evt.before, fieldKey)
    newRaw = getField(evt.after, fieldKey)

    if (evt.action === 'update') {
      // Field must actually change
      if (oldRaw === newRaw)
        return
    }

    if (rule.operator === 'changes_to') {
      const target = evt.action === 'delete' ? oldRaw : newRaw
      if (!(rule.values || []).includes(target))
        return
    }
    else if (rule.operator === 'changes_from') {
      if (!(rule.values || []).includes(oldRaw))
        return
    }
    // operator 'any' → any change of this field passes
  }
  // No field → every matching event passes

  if (!rule.assignees?.length)
    return

  // ── Build message ─────────────────────────────────────────────────────────
  const fieldLabel = regField?.label || fieldKey
  const oldLabel = await resolveLabel(regField?.dropdown, oldRaw)
  const newLabel = await resolveLabel(regField?.dropdown, newRaw)
  const verb = ACTION_VERB[evt.action] || evt.action
  const subLabel = ctx.sub?.label || evt.submodule

  const vars: Record<string, string> = {
    entity: ctx.entityLabel,
    module: subLabel,
    action: verb,
    field: fieldLabel,
    old: oldLabel,
    new: newLabel,
    actor: ctx.actorName,
  }

  let message = rule.messageTemplate ? renderTemplate(rule.messageTemplate, vars) : ''
  if (!message) {
    if (evt.action === 'update' && fieldKey)
      message = `${subLabel} "${ctx.entityLabel}": ${fieldLabel} changed${oldLabel ? ` from "${oldLabel}"` : ''} to "${newLabel}" by ${ctx.actorName}.`
    else
      message = `${subLabel} "${ctx.entityLabel}" was ${verb} by ${ctx.actorName}.`
  }

  const title = evt.action === 'update' && fieldKey
    ? `${subLabel} ${fieldLabel} → ${newLabel || 'updated'}`
    : `${subLabel} ${verb}`

  // ── Resolve recipients ────────────────────────────────────────────────────
  const { Employee } = await import('../models/Employee')
  const recipients = await Employee.find({ _id: { $in: rule.assignees } })
    .select('employee email')
    .lean()

  if (!recipients.length)
    return

  const link = ctx.sub?.link || ''

  // ── Create notifications ──────────────────────────────────────────────────
  const docs = recipients.map((r: any) => ({
    recipientId: r._id,
    recipientEmail: r.email || '',
    title,
    message,
    module: evt.module,
    submodule: evt.submodule,
    action: evt.action,
    entityId: ctx.entityId,
    entityLabel: ctx.entityLabel,
    link,
    field: fieldKey,
    oldValue: oldLabel,
    newValue: newLabel,
    actorId: evt.actor?.id || '',
    actorName: ctx.actorName,
    actorEmail: evt.actor?.email || '',
    ruleId: rule._id,
    ruleName: rule.name,
    emailSent: false,
  }))

  await Notification.insertMany(docs)

  // Track rule usage (best effort)
  NotificationAutomation.updateOne(
    { _id: rule._id },
    { $set: { lastFiredAt: new Date() }, $inc: { fireCount: 1 } },
  ).catch(() => {})

  log.info(`rule "${rule.name}" fired → ${recipients.length} notification(s)`)

  // ── Email delivery (non-blocking) ─────────────────────────────────────────
  if (rule.sendEmail) {
    sendRuleEmails(rule, recipients, { title, message, subLabel, entityLabel: ctx.entityLabel, verb })
      .catch((e: any) => log.warn('email delivery failed:', e?.message || e))
  }
}

async function sendRuleEmails(
  rule: any,
  recipients: any[],
  info: { title: string, message: string, subLabel: string, entityLabel: string, verb: string },
): Promise<void> {
  const { sendMail } = await import('./mailer')

  const html = `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
    <div style="background:#111827;padding:20px 28px">
      <p style="margin:0;color:#9ca3af;font-size:11px;letter-spacing:1.5px;text-transform:uppercase">Hardwood Hub · Notification</p>
      <h2 style="margin:6px 0 0;color:#ffffff;font-size:18px">${info.title}</h2>
    </div>
    <div style="padding:24px 28px">
      <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.6">${info.message}</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;color:#6b7280">
        <tr><td style="padding:6px 0;width:110px;color:#9ca3af">Record</td><td style="padding:6px 0;color:#111827;font-weight:600">${info.entityLabel || '—'}</td></tr>
        <tr><td style="padding:6px 0;color:#9ca3af">Automation</td><td style="padding:6px 0">${rule.name}</td></tr>
      </table>
    </div>
    <div style="padding:14px 28px;background:#f9fafb;border-top:1px solid #e5e7eb">
      <p style="margin:0;color:#9ca3af;font-size:12px">You received this because you're an assignee on the "${rule.name}" automation.</p>
    </div>
  </div>`

  for (const r of recipients) {
    if (!r.email)
      continue
    try {
      await sendMail({ to: r.email, subject: `🔔 ${info.title} — Hardwood Hub`, html })
    }
    catch (e: any) {
      log.warn(`email to ${r.email} failed:`, e?.message || e)
    }
  }

  // Mark emails as sent (best effort)
  Notification.updateMany(
    { ruleId: rule._id, recipientId: { $in: recipients.map((r: any) => r._id) }, emailSent: false },
    { $set: { emailSent: true } },
  ).catch(() => {})
}
