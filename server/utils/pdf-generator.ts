import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium'

export const generatePdfFromHtml = async (htmlContent: string) => {
  const isLocal = process.env.NODE_ENV === 'development' || !process.env.VERCEL

  let executablePath: string
  let launchArgs: string[]

  if (isLocal) {
    executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    launchArgs = ['--no-sandbox', '--disable-setuid-sandbox']
  } else {
    chromium.setGraphicsMode = false
    executablePath = await chromium.executablePath()
    launchArgs = [
      ...chromium.args,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--no-zygote',
      '--single-process',
    ]
  }

  if (!executablePath) {
    throw new Error(`Could not resolve Chromium executable path (isLocal: ${isLocal})`)
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
