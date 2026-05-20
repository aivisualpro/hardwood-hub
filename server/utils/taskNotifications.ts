/**
 * Task notification emails – fired when a task moves to "in-review"
 */
import { sendMail } from './mailer'

interface TaskEmailPayload {
  taskId: string        // human-readable e.g. TASK-001
  title: string
  createdByName: string
  movedByName?: string
  assigneeNames?: string
  priority?: string
  dueDate?: Date | string | null
}

/**
 * Resolve a creator name to their email address via the Employee collection.
 * Falls back to null if not found.
 */
async function resolveCreatorEmail(creatorName: string): Promise<string | null> {
  if (!creatorName) return null
  try {
    const { Employee } = await import('../models/Employee')
    const emp = await Employee.findOne({ employee: creatorName }).lean<any>()
    return emp?.email || null
  } catch {
    return null
  }
}

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '—'
  const date = typeof d === 'string' ? new Date(d) : d
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function capitalizeFirst(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''
}

/**
 * Send an "in-review" email notification to the task creator.
 * Non-blocking — errors are logged but never thrown.
 */
export async function notifyTaskInReview(payload: TaskEmailPayload) {
  const { taskId, title, createdByName, movedByName, assigneeNames, priority, dueDate } = payload

  const creatorEmail = await resolveCreatorEmail(createdByName)
  if (!creatorEmail) {
    console.warn(`[TaskNotify] Could not resolve email for "${createdByName}", skipping notification`)
    return
  }

  // Load company branding
  let company: any = {}
  try {
    const { AppSetting } = await import('../models/AppSetting')
    const doc: any = await AppSetting.findOne({ key: 'companyProfile' }).lean()
    company = doc?.value || {}
  } catch { /* use defaults */ }

  const companyName = company.name || 'Ann Arbor Hardwoods'

  const emailHTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0; padding:0; background-color:#ffffff; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:#1a1a1a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#ffffff;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px; width:100%;">

          <!-- Logo -->
          ${company.logo ? `<tr><td style="padding:0 0 32px; text-align:left;"><img src="${company.logo}" alt="${companyName}" style="max-height:36px; max-width:160px; object-fit:contain;" /></td></tr>` : ''}

          <!-- Subject Line -->
          <tr>
            <td style="padding:0 0 8px;">
              <p style="margin:0; font-size:13px; font-weight:600; color:#6b7280; letter-spacing:0.02em;">TASK READY FOR REVIEW</p>
            </td>
          </tr>

          <!-- Title -->
          <tr>
            <td style="padding:0 0 24px;">
              <h1 style="margin:0; font-size:22px; font-weight:700; color:#111827; line-height:1.3;">${title}</h1>
            </td>
          </tr>

          <!-- Divider -->
          <tr><td style="padding:0 0 24px;"><div style="height:1px; background-color:#e5e7eb;"></div></td></tr>

          <!-- Details -->
          <tr>
            <td style="padding:0 0 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td width="50%" style="padding:0 0 16px; vertical-align:top;">
                    <p style="margin:0 0 2px; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.06em; color:#9ca3af;">Task ID</p>
                    <p style="margin:0; font-size:14px; font-weight:600; color:#374151; font-family:'SF Mono', Monaco, monospace;">${taskId}</p>
                  </td>
                  <td width="50%" style="padding:0 0 16px; vertical-align:top;">
                    <p style="margin:0 0 2px; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.06em; color:#9ca3af;">Priority</p>
                    <p style="margin:0; font-size:14px; font-weight:600; color:#374151;">${capitalizeFirst(priority || 'Medium')}</p>
                  </td>
                </tr>
                <tr>
                  <td width="50%" style="padding:0; vertical-align:top;">
                    <p style="margin:0 0 2px; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.06em; color:#9ca3af;">Assignee</p>
                    <p style="margin:0; font-size:14px; font-weight:500; color:#374151;">${assigneeNames || '—'}</p>
                  </td>
                  <td width="50%" style="padding:0; vertical-align:top;">
                    <p style="margin:0 0 2px; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.06em; color:#9ca3af;">Due Date</p>
                    <p style="margin:0; font-size:14px; font-weight:500; color:#374151;">${formatDate(dueDate)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr><td style="padding:0 0 24px;"><div style="height:1px; background-color:#e5e7eb;"></div></td></tr>

          <!-- Message -->
          <tr>
            <td style="padding:0 0 32px;">
              <p style="margin:0; font-size:14px; line-height:1.6; color:#4b5563;">
                ${movedByName ? `<strong>${movedByName}</strong> has moved` : 'A task you created has been moved to'} <strong style="color:#111827;">In Review</strong>. Please review and take the necessary action.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 0 0; border-top:1px solid #f3f4f6;">
              <p style="margin:0; font-size:12px; color:#9ca3af; line-height:1.5;">
                ${companyName}${company.phone1 ? ` · ${company.phone1}` : ''}${company.email ? ` · ${company.email}` : ''}
              </p>
              <p style="margin:4px 0 0; font-size:11px; color:#d1d5db;">
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
      to: creatorEmail,
      subject: `Task "${taskId}" is ready for your review`,
      html: emailHTML,
    })
    console.log(`[TaskNotify] "In Review" email sent to ${creatorEmail} for task ${taskId}`)
  } catch (err) {
    console.error(`[TaskNotify] Failed to send email to ${creatorEmail}`, err)
  }
}
