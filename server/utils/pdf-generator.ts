/**
 * PDF generation via Browserless.io REST API.
 *
 * Why Browserless instead of bundling Chromium:
 *  - No native binaries on Vercel → no libnss3.so / glibc / Lambda extraction issues.
 *  - Cold start is ~200ms (just an HTTP call) vs 5-10s for chromium-min.
 *  - Free tier covers ~1k PDFs/month — plenty for contracts.
 *
 * Token is read from BROWSERLESS_TOKEN env var (set in Vercel project settings).
 * Get yours at https://browserless.io
 */

const BROWSERLESS_BASE = 'https://production-sfo.browserless.io'

export const generatePdfFromHtml = async (htmlContent: string): Promise<Buffer> => {
  const config = useRuntimeConfig()
  const token = config.browserlessToken || process.env.BROWSERLESS_TOKEN

  if (!token) {
    throw new Error(
      'BROWSERLESS_TOKEN is not set. Add it to your Vercel project environment variables.',
    )
  }

  const endpoint = `${BROWSERLESS_BASE}/pdf?token=${encodeURIComponent(token)}`

  const body = {
    html: htmlContent,
    options: {
      format: 'Letter',
      margin: {
        top: '32px',
        right: '40px',
        bottom: '32px',
        left: '40px',
      },
      printBackground: true,
      preferCSSPageSize: false,
    },
    // Wait for fonts/images to load before rendering
    gotoOptions: {
      waitUntil: 'networkidle0',
      timeout: 30000,
    },
  }

  console.log('[pdf-generator] POST → Browserless …')
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(
      `Browserless responded ${res.status}: ${errText.slice(0, 500)}`,
    )
  }

  const arrayBuffer = await res.arrayBuffer()
  const pdfBuffer = Buffer.from(arrayBuffer)
  console.log(`[pdf-generator] PDF bytes: ${(pdfBuffer.length / 1024).toFixed(0)}KB`)
  return pdfBuffer
}
