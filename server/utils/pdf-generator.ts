import puppeteer from 'puppeteer-core'

/**
 * Remote chromium pack — used on Vercel because the full @sparticuz/chromium
 * package's .br archive files do NOT survive Vercel's bundling, which is what
 * causes the "libnss3.so: cannot open shared object file" error.
 *
 * The -min package downloads this pack at cold start. The pack contains the
 * chromium binary AND every shared library it needs (libnss3, libnspr4, etc.).
 *
 * Version MUST match the @sparticuz/chromium-min version in package.json.
 */
const REMOTE_CHROMIUM_PACK =
  'https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar'

export const generatePdfFromHtml = async (htmlContent: string) => {
  const isLocal = process.env.NODE_ENV === 'development' || !process.env.VERCEL

  let executablePath: string
  let launchArgs: string[]

  if (isLocal) {
    executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    launchArgs = ['--no-sandbox', '--disable-setuid-sandbox']
  } else {
    try {
      // Dynamic import — only loads on Vercel, never at server boot time
      // @ts-ignore
      const mod = await import('@sparticuz/chromium-min')
      const chromium = mod.default || mod

      // Disable WebGL/graphics to shave decompression time + memory
      chromium.setGraphicsMode = false

      // Pass the remote pack URL — chromium-min will download + extract it
      // (binary + ALL shared libs) into /tmp on first call. Cached for warm starts.
      executablePath = await chromium.executablePath(REMOTE_CHROMIUM_PACK)

      if (!executablePath) {
        throw new Error('Could not resolve Chromium executable path on Vercel')
      }

      launchArgs = [
        ...chromium.args,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--single-process',
      ]
    } catch (e: any) {
      throw new Error('Chromium Init Error: ' + e.message)
    }
  }

  const browser = await puppeteer.launch({
    args: launchArgs,
    defaultViewport: { width: 1280, height: 800 },
    executablePath,
    headless: true,
  })

  try {
    const page = await browser.newPage()
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' })

    const pdfBuffer = await page.pdf({
      format: 'Letter',
      margin: { top: '32px', right: '40px', bottom: '32px', left: '40px' },
      printBackground: true,
    })

    return Buffer.from(pdfBuffer)
  } finally {
    await browser.close()
  }
}
