/**
 * Task notification emails – fired on ANY status change
 */
import { sendMail } from './mailer'
import { logger } from './logger'
const log = logger('[TaskNotify]')

interface StatusChangePayload {
  title: string
  createdByName: string
  movedByName?: string
  assigneeNames?: string
  approvedByName?: string
  priority?: string
  dueDate?: Date | string | null
  oldStatus: string
  newStatus: string
}

/**
 * Resolve a creator name to their email address via the Employee collection.
 */
async function resolveCreatorEmail(creatorName: string): Promise<string | null> {
  if (!creatorName)
    return null
  try {
    const { Employee } = await import('../models/Employee')
    const emp = await Employee.findOne({ employee: creatorName }).lean<any>()
    return emp?.email || null
  }
  catch {
    return null
  }
}

function formatDate(d: Date | string | null | undefined): string {
  if (!d)
    return '—'
  const date = typeof d === 'string' ? new Date(d) : d
  if (isNaN(date.getTime()))
    return '—'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function capitalizeFirst(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''
}

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    'todo': 'To Do',
    'in-progress': 'In Progress',
    'in-review': 'In Review',
    'done': 'Done',
  }
  return map[s] || capitalizeFirst(s.replace(/-/g, ' '))
}

function statusColor(s: string): string {
  const map: Record<string, string> = {
    'todo': '#3b82f6',
    'in-progress': '#f59e0b',
    'in-review': '#8b5cf6',
    'done': '#10b981',
  }
  return map[s] || '#6b7280'
}

function priorityColor(p: string): string {
  const map: Record<string, string> = {
    high: '#ef4444',
    medium: '#f59e0b',
    low: '#3b82f6',
  }
  return map[p] || '#6b7280'
}

/**
 * Send a status-change email notification to the task creator.
 * Non-blocking — errors are logged but never thrown.
 */
export async function notifyStatusChange(payload: StatusChangePayload) {
  const { title, createdByName, assigneeNames, approvedByName, oldStatus, newStatus, movedByName } = payload

  const creatorEmail = await resolveCreatorEmail(createdByName)
  if (!creatorEmail) {
    log.warn(`Could not resolve email for "${createdByName}", skipping notification`)
    return
  }

  // Load company branding
  let company: any = {}
  try {
    const { AppSetting } = await import('../models/AppSetting')
    const doc: any = await AppSetting.findOne({ key: 'companyProfile' }).lean()
    company = doc?.value || {}
  }
  catch { /* use defaults */ }

  const companyName = company.name || 'Ann Arbor Hardwoods'
  const fromLabel = statusLabel(oldStatus)
  const toLabel = statusLabel(newStatus)
  const toColor = statusColor(newStatus)

  // ── "TASK DONE" minimal template (only for done status) ──
  const isDone = newStatus === 'done'

  const emailHTML = isDone
    ? `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0; padding:24px; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:#1a1a1a; background-color:#ffffff;">
  <div style="max-width:520px; margin:0 auto; padding:20px; border:1px solid #e2e8f0; border-radius:12px; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
    <!-- Row 1: Task Title -->
    <div style="font-size:20px; font-weight:700; color:#0f172a; margin-bottom:12px; line-height:1.3;">${title}</div>

    <!-- Row 2: TASK DONE -->
    <div style="font-size:14px; font-weight:800; color:#10b981; margin-bottom:16px; letter-spacing:0.05em;">✓ TASK DONE</div>

    <!-- Row 3: Completed by (Assignees) -->
    <div style="font-size:14px; color:#475569; margin-bottom:12px; line-height:1.5;">
      Task has been completed by <strong style="color:#0f172a;">${assigneeNames || movedByName || '—'}</strong>
    </div>

    <!-- Row 4: Approved by -->
    <div style="font-size:14px; color:#475569; line-height:1.5;">
      Approved by <strong style="color:#0f172a;">${approvedByName || '—'}</strong>
    </div>
  </div>
</body>
</html>`
    : `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0; padding:0; background-color:#f8fafc; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:#1a1a1a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f8fafc;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px; width:100%; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <tr><td style="height:4px; background-color:${toColor};"></td></tr>
          <tr>
            <td style="padding:32px;">
              ${company.logo ? `<img src="${company.logo}" alt="${companyName}" style="max-height:32px; max-width:140px; object-fit:contain; margin-bottom:24px; display:block;" />` : ''}
              <h1 style="margin:0 0 16px; font-size:20px; font-weight:700; color:#0f172a;">${title}</h1>
              <p style="margin:0; font-size:14px; color:#475569; line-height:1.6;">
                ${movedByName ? `<strong>${movedByName}</strong> has moved your task` : 'Your task has been moved'} from <strong>${fromLabel}</strong> to <strong style="color:${toColor};">${toLabel}</strong>.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px; background-color:#f8fafc; border-top:1px solid #e2e8f0;">
              <p style="margin:0; font-size:11px; color:#cbd5e1;">This is an automated notification. Please do not reply.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  try {
    await sendMail({
      to: creatorEmail,
      subject: isDone ? `Task "${title}" is Done ✓` : `Task "${title}" moved to ${toLabel}`,
      html: emailHTML,
    })
    log.info(`Status change email sent to ${creatorEmail} for task "${title}" (${fromLabel} → ${toLabel})`)
  }
  catch (err) {
    log.error(`Failed to send email to ${creatorEmail}`, err)
  }
}

// ─── New Task Assignment Notification ──────────────────────

interface NewTaskPayload {
  title: string
  description?: string
  createdByName: string
  assigneeIds: string[]
  priority?: string
  dueDate?: Date | string | null
  status: string
}

/**
 * Send an email to each assignee when a new task is created.
 * Non-blocking — errors are logged but never thrown.
 */
export async function notifyNewTask(payload: NewTaskPayload) {
  const { title, description, createdByName, assigneeIds, priority, dueDate, status } = payload

  if (!assigneeIds?.length)
    return

  // Resolve assignee emails
  let assignees: any[] = []
  try {
    const { Employee } = await import('../models/Employee')
    assignees = await Employee.find({ _id: { $in: assigneeIds } }).select('email employee').lean<any[]>()
  }
  catch { return }

  const emails = assignees.map((a: any) => a.email).filter(Boolean)
  if (!emails.length)
    return

  // Load company branding
  let company: any = {}
  try {
    const { AppSetting } = await import('../models/AppSetting')
    const doc: any = await AppSetting.findOne({ key: 'companyProfile' }).lean()
    company = doc?.value || {}
  }
  catch { /* use defaults */ }

  const companyName = company.name || 'Ann Arbor Hardwoods'
  const statusLbl = statusLabel(status)
  const statusClr = statusColor(status)
  const prioClr = priorityColor(priority || 'medium')
  const assigneeNames = assignees.map(a => a.employee).filter(Boolean).join(', ')

  const emailHTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0; padding:0; background-color:#f8fafc; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:#1a1a1a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f8fafc;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px; width:100%; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.1);">

          <!-- Color Bar -->
          <tr><td style="height:4px; background:linear-gradient(90deg, #3b82f6, #8b5cf6);"></td></tr>

          <!-- Content -->
          <tr>
            <td style="padding:32px 32px 24px;">

              <!-- Logo -->
              ${company.logo ? `<img src="${company.logo}" alt="${companyName}" style="max-height:32px; max-width:140px; object-fit:contain; margin-bottom:24px; display:block;" />` : ''}

              <!-- Badge -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin-bottom:20px;">
                <tr>
                  <td style="padding:6px 12px; background-color:#dbeafe; border-radius:6px; font-size:12px; font-weight:600; color:#1d4ed8; letter-spacing:0.04em; text-transform:uppercase;">
                    NEW TASK ASSIGNED
                  </td>
                </tr>
              </table>

              <!-- Title -->
              <h1 style="margin:0 0 8px; font-size:20px; font-weight:700; color:#0f172a; line-height:1.3;">${title}</h1>
              ${description ? `<p style="margin:0 0 20px; font-size:14px; color:#64748b; line-height:1.5;">${description}</p>` : '<div style="margin-bottom:20px;"></div>'}

              <!-- Divider -->
              <div style="height:1px; background-color:#e2e8f0; margin-bottom:20px;"></div>

              <!-- Details Grid -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:24px;">
                <tr>
                  <td width="50%" style="padding:0 0 14px; vertical-align:top;">
                    <p style="margin:0 0 2px; font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:0.06em; color:#94a3b8;">Priority</p>
                    <p style="margin:0; font-size:14px; font-weight:600; color:${prioClr};">${capitalizeFirst(priority || 'Medium')}</p>
                  </td>
                  <td width="50%" style="padding:0 0 14px; vertical-align:top;">
                    <p style="margin:0 0 2px; font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:0.06em; color:#94a3b8;">Due Date</p>
                    <p style="margin:0; font-size:14px; font-weight:500; color:#334155;">${formatDate(dueDate)}</p>
                  </td>
                </tr>
                <tr>
                  <td width="50%" style="padding:0; vertical-align:top;">
                    <p style="margin:0 0 2px; font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:0.06em; color:#94a3b8;">Status</p>
                    <p style="margin:0; font-size:14px; font-weight:600; color:${statusClr};">${statusLbl}</p>
                  </td>
                  <td width="50%" style="padding:0; vertical-align:top;">
                    <p style="margin:0 0 2px; font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:0.06em; color:#94a3b8;">Created By</p>
                    <p style="margin:0; font-size:14px; font-weight:500; color:#334155;">${createdByName || '—'}</p>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <div style="height:1px; background-color:#e2e8f0; margin-bottom:20px;"></div>

              <!-- Message -->
              <p style="margin:0; font-size:14px; line-height:1.6; color:#475569;">
                <strong>${createdByName || 'Someone'}</strong> has assigned you a new task: <strong>"${title}"</strong>.
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px; background-color:#f8fafc; border-top:1px solid #e2e8f0;">
              <p style="margin:0; font-size:12px; color:#94a3b8; line-height:1.5;">
                ${companyName}${company.phone1 ? ` · ${company.phone1}` : ''}${company.email ? ` · ${company.email}` : ''}
              </p>
              <p style="margin:4px 0 0; font-size:11px; color:#cbd5e1;">
                This is an automated notification. Please do not reply.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  try {
    await sendMail({
      to: emails.join(', '),
      subject: `New Task Assigned: "${title}"`,
      html: emailHTML,
    })
    log.info(`New task email sent to ${emails.join(', ')} for "${title}"`)
  }
  catch (err) {
    log.error('Failed to send new task email', err)
  }
}

// ─── Comment Notification ──────────────────────────────────

interface CommentPayload {
  taskTitle: string
  commentText: string
  commentAuthor: string
  createdById: string
  assigneeIds: string[]
}

/**
 * Send comment notification email.
 * - If commenter is an assignee → notify creator
 * - If commenter is the creator → notify all assignees
 */
export async function notifyComment(payload: CommentPayload) {
  const { taskTitle, commentText, commentAuthor, createdById, assigneeIds } = payload

  if (!createdById && !assigneeIds?.length)
    return

  let targetEmails: string[] = []
  try {
    const { Employee } = await import('../models/Employee')

    // Determine who to notify
    const creator = await Employee.findById(createdById).select('email employee').lean<any>()
    const isCreator = creator?.employee === commentAuthor

    if (isCreator) {
      // Creator commented → notify all assignees
      if (!assigneeIds?.length)
        return
      const assignees = await Employee.find({ _id: { $in: assigneeIds } }).select('email').lean<any[]>()
      targetEmails = assignees.map((a: any) => a.email).filter(Boolean)
    }
    else {
      // Assignee commented → notify creator
      if (creator?.email)
        targetEmails = [creator.email]
    }
  }
  catch { return }

  if (!targetEmails.length)
    return

  const emailHTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0; padding:0; background-color:#f8fafc; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:#1a1a1a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f8fafc;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px; width:100%; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.1);">

          <!-- Content -->
          <tr>
            <td style="padding:32px;">

              <!-- Row 1: Task Title -->
              <h1 style="margin:0 0 16px; font-size:18px; font-weight:700; color:#0f172a; line-height:1.3;">${taskTitle}</h1>

              <!-- Row 2: Commenter Name -->
              <p style="margin:0 0 12px; font-size:14px; font-weight:600; color:#475569;">${commentAuthor}</p>

              <!-- Row 3: Comment -->
              <p style="margin:0; font-size:14px; line-height:1.6; color:#334155; white-space:pre-wrap;">${commentText}</p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px; background-color:#f8fafc; border-top:1px solid #e2e8f0;">
              <p style="margin:0; font-size:11px; color:#cbd5e1;">
                This is an automated notification. Please do not reply.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  try {
    await sendMail({
      to: targetEmails.join(', '),
      subject: `New comment on "${taskTitle}" by ${commentAuthor}`,
      html: emailHTML,
    })
    log.info(`Comment email sent to ${targetEmails.join(', ')} for "${taskTitle}"`)
  }
  catch (err) {
    log.error('Failed to send comment email', err)
  }
}

// ─── Comment Completed Notification ────────────────────────

interface CommentCompletedPayload {
  taskTitle: string
  commentText: string
  commentAuthor: string       // person who wrote the comment (will be notified)
  completedByName: string     // person who marked it completed
}

/**
 * Send an email to the comment author when their comment is marked as completed.
 * Non-blocking — errors are logged but never thrown.
 */
export async function notifyCommentCompleted(payload: CommentCompletedPayload) {
  const { taskTitle, commentText, commentAuthor, completedByName } = payload

  const authorEmail = await resolveCreatorEmail(commentAuthor)
  if (!authorEmail) {
    log.warn(`Could not resolve email for comment author "${commentAuthor}", skipping`)
    return
  }

  // Load company branding
  let company: any = {}
  try {
    const { AppSetting } = await import('../models/AppSetting')
    const doc: any = await AppSetting.findOne({ key: 'companyProfile' }).lean()
    company = doc?.value || {}
  }
  catch { /* use defaults */ }

  const companyName = company.name || 'Ann Arbor Hardwoods'

  const emailHTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0; padding:0; background-color:#f8fafc; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:#1a1a1a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f8fafc;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px; width:100%; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.1);">

          <!-- Color Bar -->
          <tr><td style="height:4px; background-color:#10b981;"></td></tr>

          <!-- Content -->
          <tr>
            <td style="padding:32px;">

              ${company.logo ? `<img src="${company.logo}" alt="${companyName}" style="max-height:32px; max-width:140px; object-fit:contain; margin-bottom:24px; display:block;" />` : ''}

              <!-- Badge -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin-bottom:20px;">
                <tr>
                  <td style="padding:6px 12px; background-color:#d1fae5; border-radius:6px; font-size:12px; font-weight:600; color:#065f46; letter-spacing:0.04em; text-transform:uppercase;">
                    ✓ COMMENT COMPLETED
                  </td>
                </tr>
              </table>

              <!-- Task Title -->
              <h1 style="margin:0 0 16px; font-size:18px; font-weight:700; color:#0f172a; line-height:1.3;">${taskTitle}</h1>

              <!-- Completed By -->
              <p style="margin:0 0 16px; font-size:14px; color:#475569; line-height:1.6;">
                <strong style="color:#0f172a;">${completedByName}</strong> has marked your comment as completed.
              </p>

              <!-- Divider -->
              <div style="height:1px; background-color:#e2e8f0; margin-bottom:16px;"></div>

              <!-- Original Comment -->
              <p style="margin:0 0 4px; font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:0.06em; color:#94a3b8;">Your Comment</p>
              <div style="padding:12px 16px; background-color:#f8fafc; border-radius:8px; border:1px solid #e2e8f0; margin-bottom:8px;">
                <p style="margin:0; font-size:14px; line-height:1.6; color:#334155; white-space:pre-wrap;">${commentText}</p>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px; background-color:#f8fafc; border-top:1px solid #e2e8f0;">
              <p style="margin:0; font-size:12px; color:#94a3b8; line-height:1.5;">
                ${companyName}${company.phone1 ? ` · ${company.phone1}` : ''}${company.email ? ` · ${company.email}` : ''}
              </p>
              <p style="margin:4px 0 0; font-size:11px; color:#cbd5e1;">
                This is an automated notification. Please do not reply.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  try {
    await sendMail({
      to: authorEmail,
      subject: `Your comment on "${taskTitle}" was completed ✓`,
      html: emailHTML,
    })
    log.info(`Comment completed email sent to ${authorEmail} for "${taskTitle}"`)
  }
  catch (err) {
    log.error('Failed to send comment completed email', err)
  }
}
