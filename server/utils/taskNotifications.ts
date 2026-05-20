/**
 * Task notification emails – fired on ANY status change
 */
import { sendMail } from './mailer'

interface StatusChangePayload {
  taskId: string
  title: string
  createdByName: string
  movedByName?: string
  assigneeNames?: string
  priority?: string
  dueDate?: Date | string | null
  oldStatus: string
  newStatus: string
}

/**
 * Resolve a creator name to their email address via the Employee collection.
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
    'high': '#ef4444',
    'medium': '#f59e0b',
    'low': '#3b82f6',
  }
  return map[p] || '#6b7280'
}

/**
 * Send a status-change email notification to the task creator.
 * Non-blocking — errors are logged but never thrown.
 */
export async function notifyStatusChange(payload: StatusChangePayload) {
  const { taskId, title, createdByName, movedByName, assigneeNames, priority, dueDate, oldStatus, newStatus } = payload

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
  const fromLabel = statusLabel(oldStatus)
  const toLabel = statusLabel(newStatus)
  const toColor = statusColor(newStatus)

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
          <tr><td style="height:4px; background-color:${toColor};"></td></tr>

          <!-- Content -->
          <tr>
            <td style="padding:32px 32px 24px;">

              <!-- Logo -->
              ${company.logo ? `<img src="${company.logo}" alt="${companyName}" style="max-height:32px; max-width:140px; object-fit:contain; margin-bottom:24px; display:block;" />` : ''}

              <!-- Status Change Badge -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin-bottom:20px;">
                <tr>
                  <td style="padding:6px 12px; background-color:#f1f5f9; border-radius:6px; font-size:12px; font-weight:600; color:#64748b; letter-spacing:0.04em; text-transform:uppercase;">
                    STATUS UPDATED
                  </td>
                </tr>
              </table>

              <!-- Title -->
              <h1 style="margin:0 0 8px; font-size:20px; font-weight:700; color:#0f172a; line-height:1.3;">${title}</h1>
              <p style="margin:0 0 24px; font-size:13px; color:#94a3b8; font-family:'SF Mono', Monaco, monospace;">${taskId}</p>

              <!-- Status Arrow -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:24px; background-color:#f8fafc; border-radius:8px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="40%" style="vertical-align:middle;">
                          <p style="margin:0 0 4px; font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:0.06em; color:#94a3b8;">From</p>
                          <p style="margin:0; font-size:15px; font-weight:600; color:#475569;">${fromLabel}</p>
                        </td>
                        <td width="20%" style="text-align:center; vertical-align:middle;">
                          <span style="font-size:20px; color:#cbd5e1;">→</span>
                        </td>
                        <td width="40%" style="vertical-align:middle; text-align:right;">
                          <p style="margin:0 0 4px; font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:0.06em; color:#94a3b8;">To</p>
                          <p style="margin:0; font-size:15px; font-weight:700; color:${toColor};">${toLabel}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <div style="height:1px; background-color:#e2e8f0; margin-bottom:20px;"></div>

              <!-- Details Grid -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:24px;">
                <tr>
                  <td width="50%" style="padding:0 0 14px; vertical-align:top;">
                    <p style="margin:0 0 2px; font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:0.06em; color:#94a3b8;">Priority</p>
                    <p style="margin:0; font-size:14px; font-weight:600; color:${priorityColor(priority || 'medium')};">${capitalizeFirst(priority || 'Medium')}</p>
                  </td>
                  <td width="50%" style="padding:0 0 14px; vertical-align:top;">
                    <p style="margin:0 0 2px; font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:0.06em; color:#94a3b8;">Due Date</p>
                    <p style="margin:0; font-size:14px; font-weight:500; color:#334155;">${formatDate(dueDate)}</p>
                  </td>
                </tr>
                <tr>
                  <td width="50%" style="padding:0; vertical-align:top;">
                    <p style="margin:0 0 2px; font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:0.06em; color:#94a3b8;">Assignees</p>
                    <p style="margin:0; font-size:14px; font-weight:500; color:#334155;">${assigneeNames || '—'}</p>
                  </td>
                  <td width="50%" style="padding:0; vertical-align:top;">
                    <p style="margin:0 0 2px; font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:0.06em; color:#94a3b8;">Moved By</p>
                    <p style="margin:0; font-size:14px; font-weight:500; color:#334155;">${movedByName || '—'}</p>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <div style="height:1px; background-color:#e2e8f0; margin-bottom:20px;"></div>

              <!-- Message -->
              <p style="margin:0; font-size:14px; line-height:1.6; color:#475569;">
                ${movedByName ? `<strong>${movedByName}</strong> has moved your task` : 'Your task has been moved'} from <strong>${fromLabel}</strong> to <strong style="color:${toColor};">${toLabel}</strong>.
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
      to: creatorEmail,
      subject: `Task "${taskId}" moved to ${toLabel}`,
      html: emailHTML,
    })
    console.log(`[TaskNotify] Status change email sent to ${creatorEmail} for task ${taskId} (${fromLabel} → ${toLabel})`)
  } catch (err) {
    console.error(`[TaskNotify] Failed to send email to ${creatorEmail}`, err)
  }
}
