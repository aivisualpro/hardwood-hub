// DEPRECATED: Ghostscript path removed because Vercel serverless does not
// have `gs` available. PDF compression is now handled inline by pdf-lib in
// server/api/upload/compress-pdf.ts and server/api/contracts/download-pdf/[id].get.ts.
//
// This stub is retained only so any stray import of `compressPdfWithGhostscript`
// fails gracefully (returns the input untouched) instead of throwing at build time.

export async function compressPdfWithGhostscript(inputBuffer: Buffer): Promise<Buffer> {
  return inputBuffer
}
