import nodemailer from 'nodemailer'

let transporter: nodemailer.Transporter | null = null

export function getMailer() {
  if (transporter) return transporter

  const config = useRuntimeConfig()
  const user = config.gmailUser
  const pass = config.gmailAppPassword

  if (!user || !pass) {
    throw new Error('Gmail credentials not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD in .env')
  }

  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  })

  return transporter
}

export async function sendMail(opts: {
  to: string
  subject: string
  html: string
  from?: string
  attachments?: any[]
}) {
  const config = useRuntimeConfig()
  const mailer = getMailer()

  return mailer.sendMail({
    from: opts.from || `"Ann Arbor Hardwoods" <${config.gmailUser}>`,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    attachments: opts.attachments,
  })
}
