import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium'

export const generatePdfFromHtml = async (htmlContent: string) => {
  const isLocal = process.env.NODE_ENV === 'development' || !process.env.VERCEL

  let options: any = {}
  if (isLocal) {
    options = {
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      headless: true,
    }
  } else {
    chromium.setGraphicsMode = false
    options = {
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless as any,
    }
  }

  const browser = await puppeteer.launch(options)

  const page = await browser.newPage()
  await page.setContent(htmlContent, { waitUntil: 'networkidle0' })
  
  const pdfBuffer = await page.pdf({ 
    format: 'Letter', 
    margin: { top: '32px', right: '40px', bottom: '32px', left: '40px' } 
  })

  await browser.close()
  return Buffer.from(pdfBuffer)
}
