/**
 * Gravity Forms API helper
 * Supports both:
 *  1) REST API v2 (gf/v2) — requires GF REST API enabled in WP Admin
 *  2) Web API v1 (gravityformsapi) — older HMAC-signed API
 *
 * Auto-detects which is available on first call.
 */
import * as crypto from 'node:crypto'

interface GFConfig {
  siteUrl: string
  consumerKey: string
  consumerSecret: string
  publicApiKey: string
  privateApiKey: string
}

let _apiMode: 'v2' | 'v1' | null = null

function getConfig(): GFConfig {
  const config = useRuntimeConfig()
  return {
    siteUrl: ((config.gfSiteUrl as string) || '').replace(/\/$/, ''),
    consumerKey: (config.gfConsumerKey as string) || '',
    consumerSecret: (config.gfConsumerSecret as string) || '',
    publicApiKey: (config.gfPublicApiKey as string) || '',
    privateApiKey: (config.gfPrivateApiKey as string) || '',
  }
}

// ——— REST API v2 (Basic Auth) ———
function v2Headers(cfg: GFConfig): Record<string, string> {
  const token = Buffer.from(`${cfg.consumerKey}:${cfg.consumerSecret}`).toString('base64')
  return { 'Authorization': `Basic ${token}`, 'Content-Type': 'application/json' }
}

async function v2Fetch<T = any>(cfg: GFConfig, path: string): Promise<T> {
  const url = `${cfg.siteUrl}/wp-json/gf/v2${path}`
  const res = await fetch(url, { headers: v2Headers(cfg), redirect: 'follow' })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`[GF-v2] ${res.status}: ${text.slice(0, 300)}`)
  }
  return res.json() as Promise<T>
}

// ——— Web API v1 (HMAC Signature) ———
function v1SignedUrl(cfg: GFConfig, route: string, method: string = 'GET'): string {
  const expires = Math.floor(Date.now() / 1000) + 3600
  const stringToSign = `${cfg.publicApiKey}:${method}:${route}:${expires}`
  const sig = crypto
    .createHmac('sha1', cfg.privateApiKey)
    .update(stringToSign)
    .digest('base64')
  return `${cfg.siteUrl}/gravityformsapi/${route}?api_key=${encodeURIComponent(cfg.publicApiKey)}&signature=${encodeURIComponent(sig)}&expires=${expires}`
}

async function v1Fetch<T = any>(cfg: GFConfig, route: string): Promise<T> {
  const url = v1SignedUrl(cfg, route)
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`[GF-v1] ${res.status}: ${text.slice(0, 300)}`)
  }
  const data = await res.json()
  // v1 wraps responses in { status, response }
  if (data && typeof data === 'object' && 'response' in data) {
    return data.response as T
  }
  return data as T
}

// ——— Auto-detect which API is available ———
async function detectApiMode(cfg: GFConfig): Promise<'v2' | 'v1'> {
  if (_apiMode) return _apiMode

  // Check if site has gf/v2 namespace
  try {
    const nsRes = await fetch(`${cfg.siteUrl}/wp-json/`, { redirect: 'follow' })
    if (nsRes.ok) {
      const nsData = await nsRes.json()
      const namespaces: string[] = nsData?.namespaces || []
      if (namespaces.includes('gf/v2')) {
        _apiMode = 'v2'
        console.log('[GravityForms] Using REST API v2')
        return 'v2'
      }
    }
  } catch { /* ignore */ }

  // Fallback to v1
  _apiMode = 'v1'
  console.log('[GravityForms] REST API v2 not available, using Web API v1')
  return 'v1'
}

// ——— Unified public functions ———
export async function gfFetch<T = any>(path: string): Promise<T> {
  const cfg = getConfig()

  // Ensure siteUrl has www. if needed (handle redirect)
  if (cfg.siteUrl && !cfg.siteUrl.includes('www.')) {
    cfg.siteUrl = cfg.siteUrl.replace('https://', 'https://www.')
  }

  const mode = await detectApiMode(cfg)

  if (mode === 'v2') {
    return v2Fetch<T>(cfg, path)
  }

  // Convert v2-style paths to v1 routes
  // /forms → forms, /forms/3 → forms/3, /forms/3/entries → forms/3/entries
  const route = path.replace(/^\//, '').split('?')[0]
  return v1Fetch<T>(cfg, route)
}

/** Get all forms */
export async function gfGetForms() {
  return gfFetch<Record<string, any>>('/forms')
}

/** Get a single form with field definitions */
export async function gfGetForm(formId: number) {
  return gfFetch<any>(`/forms/${formId}`)
}

/** Get entries for a form (paginated) */
export async function gfGetEntries(formId: number, page = 1, pageSize = 100) {
  const cfg = getConfig()
  if (cfg.siteUrl && !cfg.siteUrl.includes('www.')) {
    cfg.siteUrl = cfg.siteUrl.replace('https://', 'https://www.')
  }
  const mode = await detectApiMode(cfg)

  if (mode === 'v2') {
    return v2Fetch<{ total_count: number; entries: any[] }>(
      cfg,
      `/forms/${formId}/entries?paging[page_size]=${pageSize}&paging[current_page]=${page}&sorting[key]=date_created&sorting[direction]=DESC`,
    )
  }

  // v1: /forms/{formId}/entries with paging
  const route = `forms/${formId}/entries`
  const entries = await v1Fetch<any>(cfg, route)

  // v1 returns entries directly or { total_count, entries }
  if (Array.isArray(entries)) {
    return { total_count: entries.length, entries }
  }
  if (entries && entries.entries) {
    return { total_count: entries.total_count || entries.entries.length, entries: entries.entries }
  }
  return { total_count: 0, entries: [] }
}

/** Get ALL entries for a form (auto-paginate for v2, single call for v1) */
export async function gfGetAllEntries(formId: number): Promise<any[]> {
  const cfg = getConfig()
  if (cfg.siteUrl && !cfg.siteUrl.includes('www.')) {
    cfg.siteUrl = cfg.siteUrl.replace('https://', 'https://www.')
  }
  const mode = await detectApiMode(cfg)

  if (mode === 'v1') {
    // v1 returns all entries at once
    const res = await gfGetEntries(formId)
    return res.entries || []
  }

  // v2: paginate
  const all: any[] = []
  let page = 1
  const pageSize = 100
  while (true) {
    const res = await gfGetEntries(formId, page, pageSize)
    if (!res.entries?.length) break
    all.push(...res.entries)
    if (all.length >= res.total_count) break
    page++
  }
  return all
}

/** Get single entry by entry ID */
export async function gfGetEntry(entryId: number) {
  return gfFetch<any>(`/entries/${entryId}`)
}
