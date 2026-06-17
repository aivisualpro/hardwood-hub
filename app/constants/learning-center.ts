/**
 * Learning Center configuration — single source of truth.
 *
 * Drives three things so they never drift apart:
 *   1. The sidebar sub-menus under the "Learning Center" heading
 *   2. The per-category routes  (/learning-center/<slug>)
 *   3. The DYNAMIC add/edit form — each category exposes its own content
 *      input modes (upload video, YouTube link, upload PDF, external link…)
 *      and its own extra fields (level, method, presenter, standard ref…).
 *
 * To add a new category or field, edit only this file.
 */

export type LCType = 'video' | 'document' | 'link'
export type LCSource = 'cloudinary' | 'youtube' | 'external'

/** A way to provide the resource's content (shown as a toggle in the form). */
export interface LCContentMode {
  id: string
  label: string
  icon: string
  via: 'upload' | 'url'
  type: LCType
  source: LCSource
  resourceType?: 'video' | 'auto' // upload only — Cloudinary resource_type
  accept?: string // upload only — file input accept attr
  placeholder?: string // url only
  hint?: string
}

/** A category-specific extra field, stored on the resource's `meta` object. */
export interface LCField {
  key: string
  label: string
  input: 'text' | 'textarea' | 'select'
  options?: string[]
  placeholder?: string
  col?: 1 | 2
  icon?: string
}

export interface LCCategory {
  key: string // value stored in the DB `category` field
  slug: string // URL segment under /learning-center/
  label: string
  short: string
  icon: string
  desc: string
  gradient: string
  text: string
  dot: string
  contentModes: LCContentMode[]
  fields: LCField[]
}

// ── Reusable content-input modes ─────────────────────────────────────────────
const MODES: Record<string, LCContentMode> = {
  uploadVideo: { id: 'upload-video', label: 'Upload video', icon: 'i-lucide-cloud-upload', via: 'upload', type: 'video', source: 'cloudinary', resourceType: 'video', accept: 'video/*', hint: 'MP4, MOV or WebM' },
  youtube: { id: 'youtube', label: 'YouTube / Vimeo', icon: 'i-lucide-youtube', via: 'url', type: 'video', source: 'youtube', placeholder: 'https://youtube.com/watch?v=…' },
  uploadDoc: { id: 'upload-doc', label: 'Upload document', icon: 'i-lucide-file-up', via: 'upload', type: 'document', source: 'cloudinary', resourceType: 'auto', accept: '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,application/pdf', hint: 'PDF, DOCX, PPTX…' },
  link: { id: 'link', label: 'External link', icon: 'i-lucide-link', via: 'url', type: 'link', source: 'external', placeholder: 'https://…' },
}

export const LC_CATEGORIES: LCCategory[] = [
  {
    key: 'app-skill-guide',
    slug: 'skill-guide',
    label: 'Skill Guide',
    short: 'Skill Guide',
    icon: 'i-lucide-book-open-check',
    desc: 'Step-by-step guides for using Hardwood Hub',
    gradient: 'from-emerald-500/25 to-teal-500/5',
    text: 'text-emerald-400',
    dot: 'bg-emerald-500',
    contentModes: [MODES.uploadDoc!, MODES.link!, MODES.youtube!],
    fields: [
      { key: 'difficulty', label: 'Level', input: 'select', options: ['Beginner', 'Intermediate', 'Advanced'], col: 1, icon: 'i-lucide-signal' },
      { key: 'estTime', label: 'Time to complete', input: 'text', placeholder: 'e.g. 5 min', col: 1, icon: 'i-lucide-clock' },
    ],
  },
  {
    key: 'video-resources',
    slug: 'video-resources',
    label: 'Video Resources',
    short: 'Videos',
    icon: 'i-lucide-play-circle',
    desc: 'Training & how-to videos for the team',
    gradient: 'from-violet-500/25 to-fuchsia-500/5',
    text: 'text-violet-400',
    dot: 'bg-violet-500',
    contentModes: [MODES.uploadVideo!, MODES.youtube!],
    fields: [
      { key: 'presenter', label: 'Presenter', input: 'text', placeholder: 'e.g. Mike (Operations)', col: 2, icon: 'i-lucide-user' },
    ],
  },
  {
    key: 'nwfa-documentation',
    slug: 'nwfa-documentation',
    label: 'NWFA Documentation',
    short: 'NWFA',
    icon: 'i-lucide-badge-check',
    desc: 'National Wood Flooring Association standards & technical docs',
    gradient: 'from-amber-500/25 to-orange-500/5',
    text: 'text-amber-400',
    dot: 'bg-amber-500',
    contentModes: [MODES.link!, MODES.uploadDoc!],
    fields: [
      { key: 'docCode', label: 'Standard / Reference', input: 'text', placeholder: 'e.g. NWFA Sand & Finish', col: 1, icon: 'i-lucide-hash' },
      { key: 'year', label: 'Year', input: 'text', placeholder: 'e.g. 2024', col: 1, icon: 'i-lucide-calendar' },
    ],
  },
  {
    key: 'installation-guidelines',
    slug: 'installation-guidelines',
    label: 'Installation Guidelines',
    short: 'Install',
    icon: 'i-lucide-hard-hat',
    desc: 'Best-practice guides for floor installation',
    gradient: 'from-sky-500/25 to-blue-500/5',
    text: 'text-sky-400',
    dot: 'bg-sky-500',
    contentModes: [MODES.uploadDoc!, MODES.link!, MODES.youtube!],
    fields: [
      { key: 'method', label: 'Method', input: 'select', options: ['Nail-down', 'Glue-down', 'Floating', 'Staple', 'Any'], col: 1, icon: 'i-lucide-hammer' },
      { key: 'difficulty', label: 'Level', input: 'select', options: ['Beginner', 'Intermediate', 'Advanced'], col: 1, icon: 'i-lucide-signal' },
    ],
  },
]

export const LC_BASE = '/learning-center'

export function lcBySlug(slug: string): LCCategory | undefined {
  return LC_CATEGORIES.find(c => c.slug === slug)
}
export function lcByKey(key: string): LCCategory | undefined {
  return LC_CATEGORIES.find(c => c.key === key)
}
