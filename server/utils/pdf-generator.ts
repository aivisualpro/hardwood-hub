import puppeteer from 'puppeteer-core'

/**
 * Remote chromium pack — chromium-min downloads this at cold start and extracts
 * it to /tmp. The pack contains chromium binary AND every shared library it
 * needs (libnss3, libnspr4, libxshmfence, etc).
 *
 * IMPORTANT: This version MUST match @sparticuz/chromium-min in package.json.
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
      // Dynamic import — only loads on Vercel
      // @ts-ignore
      const mod = await import('@sparticuz/chromium-min')
      const chromium = mod.default || mod

      // Disable graphics decoding to shave cold-start time + memory
      chromium.setGraphicsMode = false

      // Trigger pack download + extraction. Returns /tmp/chromium.
      console.log('[pdf-generator] Resolving chromium executable from remote pack...')
      executablePath = await chromium.executablePath(REMOTE_CHROMIUM_PACK)
      console.log('[pdf-generator] executablePath:', executablePath)

      if (!executablePath) {
        throw new Error('Could not resolve Chromium executable path on Vercel')
      }

      // Verify the binary + libs actually exist on disk. This is the
      // diagnostic we couldn't see before — if any of these are missing,
      // the pack download/extraction silently failed.
      const fs = await import('fs')
      const path = await import('path')
      const binDir = path.dirname(executablePath)
      let dirContents: string[] = []
      try {
        dirContents = fs.readdirSync(binDir)
      } catch (e) {
        console.error('[pdf-generator] Cannot read', binDir, e)
      }
      const hasNss = dirContents.some((f) => f.startsWith('libnss3'))
      console.log(
        `[pdf-generator] /tmp contents: ${dirContents.length} files. ` +
        `chromium present: ${dirContents.includes('chromium')}. ` +
        `libnss3 present: ${hasNss}.`,
      )
      if (!hasNss) {
        console.warn(
          '[pdf-generator] libnss3.so missing in /tmp. ' +
          'Files found:',
          dirContents.slice(0, 30),
        )
      }

      // CRITICAL: ensure dynamic linker can find the .so files extracted
      // alongside the chromium binary. Without this, the binary launches
      // but immediately fails with "libnss3.so: cannot open shared object file".
      // chromium-min sets this internally on some versions but not all —
      // setting it explicitly is the bulletproof fix.
      const existingLdPath = process.env.LD_LIBRARY_PATH || ''
      if (!existingLdPath.split(':').includes(binDir)) {
        process.env.LD_LIBRARY_PATH = `${binDir}:${existingLdPath}`
        console.log('[pdf-generator] LD_LIBRARY_PATH set to:', process.env.LD_LIBRARY_PATH)
      }

      // Use chromium-min's curated args verbatim. Don't add --single-process
      // — it actively breaks Chromium on AWS Lambda / Vercel.
      launchArgs = chromium.args
    } catch (e: any) {
      console.error('[pdf-generator] Chromium init failed:', e)
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
