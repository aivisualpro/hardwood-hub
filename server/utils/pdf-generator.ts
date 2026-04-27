import puppeteer from 'puppeteer-core'
import fs from 'fs'
import path from 'path'

const REMOTE_CHROMIUM_PACK =
  'https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar'

/**
 * Walk a directory and return every directory that contains a file matching `pattern`.
 * Used to locate where libnss3.so actually got extracted to.
 */
function findDirsContaining(
  rootDir: string,
  pattern: RegExp,
  maxDepth = 4,
): string[] {
  const matches: string[] = []
  const visit = (dir: string, depth: number) => {
    if (depth > maxDepth) return
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    let dirHasMatch = false
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isFile() && pattern.test(entry.name)) {
        dirHasMatch = true
      } else if (entry.isDirectory()) {
        visit(full, depth + 1)
      }
    }
    if (dirHasMatch) matches.push(dir)
  }
  visit(rootDir, 0)
  return matches
}

export const generatePdfFromHtml = async (htmlContent: string) => {
  const isLocal = process.env.NODE_ENV === 'development' || !process.env.VERCEL

  let executablePath: string
  let launchArgs: string[]

  if (isLocal) {
    executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    launchArgs = ['--no-sandbox', '--disable-setuid-sandbox']
  } else {
    try {
      // @ts-ignore
      const mod = await import('@sparticuz/chromium-min')
      const chromium = mod.default || mod

      chromium.setGraphicsMode = false

      console.log('[pdf-generator] Resolving chromium executable from remote pack...')
      executablePath = await chromium.executablePath(REMOTE_CHROMIUM_PACK)
      console.log('[pdf-generator] executablePath:', executablePath)

      if (!executablePath) {
        throw new Error('Could not resolve Chromium executable path on Vercel')
      }

      const binDir = path.dirname(executablePath)

      // Recursively find every directory under /tmp that contains libnss3.so.
      // chromium-min sometimes extracts system libs into a subdirectory like
      // /tmp/chromium-pack/ rather than directly into /tmp.
      const nssDirs = findDirsContaining(binDir, /^libnss3(\.so.*)?$/)
      console.log('[pdf-generator] dirs containing libnss3:', nssDirs)

      if (nssDirs.length === 0) {
        // Last-ditch dump for diagnosis
        const dump = (dir: string, depth = 0) => {
          if (depth > 2) return
          try {
            const entries = fs.readdirSync(dir, { withFileTypes: true })
            console.log(
              `[pdf-generator] ${'  '.repeat(depth)}${dir}:`,
              entries.map((e) => e.name + (e.isDirectory() ? '/' : '')).slice(0, 40),
            )
            for (const e of entries) {
              if (e.isDirectory()) dump(path.join(dir, e.name), depth + 1)
            }
          } catch (err: any) {
            console.log(`[pdf-generator] cannot read ${dir}: ${err?.message}`)
          }
        }
        dump(binDir)
        throw new Error(
          'Chromium pack extracted but libnss3.so was not found anywhere under /tmp. ' +
          'The pack tar is incomplete or extraction failed.',
        )
      }

      // Build LD_LIBRARY_PATH from every dir that contains libnss3 plus binDir itself.
      const libDirs = Array.from(new Set([binDir, ...nssDirs]))
      const existing = process.env.LD_LIBRARY_PATH || ''
      process.env.LD_LIBRARY_PATH = [...libDirs, existing].filter(Boolean).join(':')
      console.log('[pdf-generator] LD_LIBRARY_PATH set to:', process.env.LD_LIBRARY_PATH)

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
