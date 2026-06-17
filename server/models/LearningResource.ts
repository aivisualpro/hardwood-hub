import mongoose from 'mongoose'

/**
 * LearningResource — content shown in the employee-facing Learning Center.
 *
 * Four categories:
 *   - app-skill-guide        How to use Hardwood Hub
 *   - video-resources        Training videos (Cloudinary upload or YouTube/Vimeo)
 *   - nwfa-documentation     NWFA standards & technical docs (links or uploaded PDFs)
 *   - installation-guidelines Floor installation best-practice docs
 *
 * Each resource is one of three `type`s:
 *   - video     → playable inline (Cloudinary mp4 or embedded YouTube/Vimeo)
 *   - document  → downloadable / openable file (uploaded PDF/doc or external link)
 *   - link      → opens an external website in a new tab
 */
const LearningResourceSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    category: {
      type: String,
      required: true,
      enum: ['app-skill-guide', 'video-resources', 'nwfa-documentation', 'installation-guidelines'],
    },
    type: { type: String, required: true, enum: ['video', 'document', 'link'], default: 'link' },
    // Where the content lives — drives how the front-end renders it.
    source: { type: String, enum: ['cloudinary', 'youtube', 'external'], default: 'external' },
    url: { type: String, required: true, trim: true }, // Cloudinary secure_url, YouTube/Vimeo URL, or external link
    thumbnail: { type: String, default: '' }, // Optional Cloudinary image URL for the card cover
    fileType: { type: String, default: '' }, // e.g. 'pdf', 'mp4', 'docx'
    fileSize: { type: Number, default: 0 }, // bytes (optional, informational)
    duration: { type: String, default: '' }, // e.g. '12:30' for videos (optional)
    tags: { type: [String], default: [] },
    order: { type: Number, default: 0 }, // manual sort within a category (lower = first)
    isPublished: { type: Boolean, default: true }, // unpublished = draft, hidden from non-admins
    createdBy: { type: mongoose.Schema.Types.ObjectId, default: null },
    // Category-specific extra fields (e.g. difficulty, install method, presenter,
    // NWFA standard ref). Shape is driven by app/constants/learning-center.ts.
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, collection: 'hardwoodDB_LearningCenter' },
)

// Fast category listing in display order; published filter for employee views.
LearningResourceSchema.index({ category: 1, order: 1, createdAt: -1 })
LearningResourceSchema.index({ isPublished: 1 })

export const LearningResource
  = mongoose.models.LearningResource
    || mongoose.model('LearningResource', LearningResourceSchema)
