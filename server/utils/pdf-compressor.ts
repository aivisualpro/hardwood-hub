import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import os from 'os'

const execFileAsync = promisify(execFile)

/**
 * Compresses a PDF file using Ghostscript.
 * Highly effective for downsampling embedded images.
 * @param inputBuffer The original PDF buffer
 * @returns The compressed PDF buffer
 */
export async function compressPdfWithGhostscript(inputBuffer: Buffer): Promise<Buffer> {
  const tmpId = `gs_${Date.now()}_${Math.random().toString(36).slice(2)}`
  const inputPath = path.join(os.tmpdir(), `${tmpId}_input.pdf`)
  const outputPath = path.join(os.tmpdir(), `${tmpId}_output.pdf`)

  try {
    // Write input to temp file
    fs.writeFileSync(inputPath, inputBuffer)

    // Ghostscript arguments for "screen" quality (72 dpi, good for web/email)
    const gsArgs = [
      '-sDEVICE=pdfwrite',
      '-dCompatibilityLevel=1.4',
      '-dPDFSETTINGS=/screen', // /screen (72 dpi), /ebook (150 dpi), /printer (300 dpi)
      '-dNOPAUSE',
      '-dQUIET',
      '-dBATCH',
      `-sOutputFile=${outputPath}`,
      inputPath
    ]

    // Determine the gs command (gs on Linux/Mac, gswin64c on Windows)
    const gsCmd = process.platform === 'win32' ? 'gswin64c' : 'gs'

    await execFileAsync(gsCmd, gsArgs)

    // Read compressed file
    const compressedBuffer = fs.readFileSync(outputPath)
    return compressedBuffer
  } catch (error: any) {
    console.error('[pdf-compressor] Ghostscript compression failed:', error.message)
    // If gs fails (e.g., not installed), fallback to returning the original buffer
    return inputBuffer
  } finally {
    // Clean up temp files
    try { fs.unlinkSync(inputPath) } catch (e) {}
    try { fs.unlinkSync(outputPath) } catch (e) {}
  }
}
