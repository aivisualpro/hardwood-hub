import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium'

export const generatePdfFromHtml = async (htmlContent: string) => {
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless === true ? true : chromium.headless,
  })

  const page = await browser.newPage()
  await page.setContent(htmlContent, { waitUntil: 'networkidle0' })
  
  const pdfBuffer = await page.pdf({ 
    format: 'Letter', 
    margin: { top: '32px', right: '40px', bottom: '32px', left: '40px' } 
  })

  await browser.close()
  return Buffer.from(pdfBuffer)
}
