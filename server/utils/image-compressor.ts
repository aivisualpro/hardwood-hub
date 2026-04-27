import sharp from 'sharp'

interface CompressOptions {
  /** Max width in pixels (default 800) */
  maxWidth?: number
  /** JPEG quality 1-100 (default 60) */
  quality?: number
  /** Force output format: 'jpeg' | 'png' (default 'jpeg') */
  format?: 'jpeg' | 'png'
}

const DEFAULT_OPTS: Required<CompressOptions> = {
  maxWidth: 800,
  quality: 60,
  format: 'jpeg',
}

/**
 * Fetch an image from URL, compress it with sharp, and return a base64 data URI.
 * Falls back to the original URL on any failure.
 */
export async function compressImageUrl(
  url: string,
  opts?: CompressOptions,
): Promise<string> {
  const { maxWidth, quality, format } = { ...DEFAULT_OPTS, ...opts }

  try {
    // Skip data URIs — compress them in-place
    if (url.startsWith('data:')) {
      return await compressBase64DataUri(url, { maxWidth, quality, format })
    }

    // Skip non-http URLs
    if (!url.startsWith('http')) return url

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)

    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timer)

    if (!res.ok) {
      console.warn(`[img-compress] Fetch failed (${res.status}) for: ${url.substring(0, 80)}...`)
      return url
    }

    const arrayBuffer = await res.arrayBuffer()
    const inputBuffer = Buffer.from(arrayBuffer)
    const inputSize = inputBuffer.length

    let pipeline = sharp(inputBuffer).resize({
      width: maxWidth,
      withoutEnlargement: true,
    })

    let mime: string
    if (format === 'png') {
      pipeline = pipeline.png({ quality, compressionLevel: 9 })
      mime = 'image/png'
    } else {
      pipeline = pipeline.jpeg({ quality, mozjpeg: true })
      mime = 'image/jpeg'
    }

    const outputBuffer = await pipeline.toBuffer()
    const outputSize = outputBuffer.length

    console.log(`[img-compress] ${url.substring(0, 60)}... | ${(inputSize / 1024).toFixed(0)}KB → ${(outputSize / 1024).toFixed(0)}KB (${format} q${quality} w${maxWidth})`)

    const b64 = outputBuffer.toString('base64')
    return `data:${mime};base64,${b64}`
  } catch (err: any) {
    console.error(`[img-compress] FAILED for ${url.substring(0, 80)}: ${err?.message}`)
    return url
  }
}

/**
 * Compress an existing base64 data URI.
 */
async function compressBase64DataUri(
  dataUri: string,
  opts: Required<CompressOptions>,
): Promise<string> {
  try {
    const match = dataUri.match(/^data:image\/[^;]+;base64,(.+)$/)
    if (!match) return dataUri

    const inputBuffer = Buffer.from(match[1], 'base64')
    const inputSize = inputBuffer.length

    let pipeline = sharp(inputBuffer).resize({
      width: opts.maxWidth,
      withoutEnlargement: true,
    })

    let mime: string
    if (opts.format === 'png') {
      pipeline = pipeline.png({ quality: opts.quality, compressionLevel: 9 })
      mime = 'image/png'
    } else {
      pipeline = pipeline.jpeg({ quality: opts.quality, mozjpeg: true })
      mime = 'image/jpeg'
    }

    const outputBuffer = await pipeline.toBuffer()
    console.log(`[img-compress] data-uri | ${(inputSize / 1024).toFixed(0)}KB → ${(outputBuffer.length / 1024).toFixed(0)}KB`)
    return `data:${mime};base64,${outputBuffer.toString('base64')}`
  } catch (err: any) {
    console.error(`[img-compress] data-uri FAILED: ${err?.message}`)
    return dataUri
  }
}

/**
 * Walk an HTML string and replace every <img src="..."> with a
 * pre-compressed base64 data URI version.
 * This ensures Puppeteer embeds small images instead of full-res bitmaps.
 */
export async function compressImagesInHtml(
  html: string,
  opts?: CompressOptions,
): Promise<string> {
  // Collect all unique image URLs
  const srcRegex = /<img[^>]+src=["']([^"']+)["']/gi
  const urls = new Map<string, string>()
  let match: RegExpExecArray | null

  while ((match = srcRegex.exec(html)) !== null) {
    const url = match[1]
    if (!urls.has(url)) {
      urls.set(url, url) // placeholder
    }
  }

  console.log(`[img-compress] Found ${urls.size} unique images in HTML (${(html.length / 1024).toFixed(0)}KB HTML)`)

  if (urls.size === 0) return html

  // Compress all images in parallel (max concurrency 6)
  const entries = [...urls.keys()]
  const BATCH = 6
  for (let i = 0; i < entries.length; i += BATCH) {
    const batch = entries.slice(i, i + BATCH)
    const results = await Promise.all(
      batch.map(async (url) => {
        // Signatures and logos are small — use PNG w/ small width
        const isPng = url.includes('f_png') || url.includes('.png')
        const isSignature = url.includes('signature') || url.includes('Signature')
        const isLogo = url.includes('logo') || url.includes('Logo')
        const isSmallAsset = isSignature || isLogo

        const finalOpts: CompressOptions = {
          ...opts,
          format: isPng || isSmallAsset ? 'png' : 'jpeg',
          maxWidth: isSmallAsset ? 300 : (opts?.maxWidth ?? 800),
          quality: isSmallAsset ? 70 : (opts?.quality ?? 60),
        }
        const compressed = await compressImageUrl(url, finalOpts)
        return [url, compressed] as const
      }),
    )
    for (const [url, compressed] of results) {
      urls.set(url, compressed)
    }
  }

  // Replace all src attributes in the HTML
  let result = html
  let replacedCount = 0
  for (const [originalUrl, compressedUri] of urls) {
    if (compressedUri === originalUrl) continue // skip failed compressions
    // Escape special regex chars in the URL
    const escaped = originalUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const before = result.length
    result = result.replace(new RegExp(escaped, 'g'), compressedUri)
    if (result.length !== before) replacedCount++
  }

  console.log(`[img-compress] Replaced ${replacedCount}/${urls.size} images. HTML: ${(html.length / 1024).toFixed(0)}KB → ${(result.length / 1024).toFixed(0)}KB`)

  return result
}
