/**
 * server/utils/validation.ts
 *
 * Centralised Zod schemas for all server/api write endpoints.
 *
 * Usage inside a handler:
 *   import { parseBody, objectId, CustomerCreateSchema } from '../../utils/validation'
 *
 *   const data = parseBody(CustomerCreateSchema, await readBody(event))
 *   // → throws createError({ statusCode: 400 }) on failure
 *   // → returns the validated, narrowed data object
 *
 * ObjectId route params:
 *   const id = objectId(getRouterParam(event, 'id'))
 *   // → throws createError({ statusCode: 400 }) on invalid hex
 */

import { z } from 'zod'

// ─── Core helpers ────────────────────────────────────────────────────────────

/**
 * Parse and validate a raw request body against a Zod schema.
 * Throws a 400 createError with field-level messages on failure.
 */
export function parseBody<T extends z.ZodTypeAny>(
  schema: T,
  body: unknown,
): z.infer<T> {
  const result = schema.safeParse(body)
  if (!result.success) {
    const messages = result.error.errors
      .map(e => `${e.path.join('.')}: ${e.message}`)
      .join('; ')
    throw createError({ statusCode: 400, message: `Validation error — ${messages}` })
  }
  return result.data
}

/**
 * Validate and return a MongoDB ObjectId string from a route param.
 * Throws 400 if the value is missing or not a 24-hex string.
 * Protects against NoSQL-operator injection via params like { $ne: null }.
 */
export function objectId(value: string | undefined | null, name = 'id'): string {
  if (!value || typeof value !== 'string' || !/^[0-9a-f]{24}$/i.test(value)) {
    throw createError({ statusCode: 400, message: `Invalid ${name}: must be a 24-character hex ObjectId` })
  }
  return value
}

/**
 * Escape a user-supplied string for safe use in a MongoDB $regex filter.
 * Without this, characters like (.*+?^${}[]|\) act as regex operators,
 * enabling ReDoS attacks (catastrophic backtracking) and regex injection.
 *
 * Usage:
 *   { name: { $regex: escapeRegex(userSearch), $options: 'i' } }
 */
export function escapeRegex(value: string): string {
  // Escapes all PCRE/JS regex metacharacters
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Wrap a DB call so that Mongoose CastErrors (invalid ObjectId format reaching
 * Mongoose despite earlier validation) become a 400 rather than an unhandled 500.
 *
 * Usage:
 *   const doc = await catchMongoError(() => MyModel.findById(id).lean())
 */
export async function catchMongoError<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  }
  catch (err: any) {
    if (err?.name === 'CastError' || err?.kind === 'ObjectId') {
      throw createError({ statusCode: 400, message: 'Invalid ID format' })
    }
    throw err
  }
}

// ─── Shared sub-schemas ───────────────────────────────────────────────────────

const MongoId = z.string().regex(/^[0-9a-f]{24}$/i, 'Must be a valid ObjectId')

const RelatedContact = z.object({
  firstName: z.string().max(100).optional().default(''),
  lastName: z.string().max(100).optional().default(''),
  title: z.string().max(100).optional().default(''),
  emails: z.array(z.string().email('Invalid email')).optional().default([]),
  phones: z.array(z.string().max(30)).optional().default([]),
  preferredContact: z.string().max(50).optional().default(''),
  address: z.string().max(300).optional().default(''),
})

const GalleryItem = z.object({
  url: z.string().url('Gallery URL must be a valid URL'),
  caption: z.string().max(500).optional().default(''),
  uploadedAt: z.coerce.date().optional(),
})

const DocumentFile = z.object({
  url: z.string().url('File URL must be a valid URL'),
  name: z.string().max(500).optional().default(''),
  size: z.number().nonnegative().optional().default(0),
  type: z.string().max(200).optional().default(''),
})

const DocumentItem = z.object({
  date: z.coerce.date().optional(),
  documentType: z.string().max(200).optional().default(''),
  files: z.array(DocumentFile).optional().default([]),
  uploadedAt: z.coerce.date().optional(),
})

// ─── CUSTOMER ─────────────────────────────────────────────────────────────────
//
// Writable fields from Customer model (read-only server fields excluded:
//   _id, createdAt, updatedAt, totalTrackedViews — never accepted from client)

const CustomerWritable = {
  name: z.string().max(200).optional().default(''),
  firstName: z.string().max(100).optional().default(''),
  lastName: z.string().max(100).optional().default(''),
  email: z.string().email('Invalid email').or(z.literal('')).optional().default(''),
  phone: z.string().max(30).optional().default(''),
  address: z.string().max(300).optional().default(''),
  city: z.string().max(100).optional().default(''),
  state: z.string().max(100).optional().default(''),
  zip: z.string().max(20).optional().default(''),
  notes: z.string().max(10_000).optional().default(''),

  // type is a Mongo ObjectId ref to a Dropdown option — accept string or null
  type: MongoId.nullable().optional(),
  // status is a Mongo ObjectId ref to a Dropdown doc — accept string or null
  status: MongoId.nullable().optional(),
  estimatedProjectDuration: z.string().max(100).optional().default(''),
  totalEstimate: z.number().nonnegative().nullable().optional(),
  assignedTo: z.string().max(200).optional().default(''),
  estimateSentOn: z.coerce.date().nullable().optional(),
  initialContactDate: z.coerce.date().nullable().optional(),
  lastFollowUpSentOn: z.coerce.date().nullable().optional(),
  dateApproved: z.coerce.date().nullable().optional(),
  projectAssignedTo: z.string().max(200).optional().default(''),
  contactIds: z.array(MongoId).optional().default([]),
  woodOrderDate: z.coerce.date().nullable().optional(),
  tags: z.array(z.string().max(100)).optional().default([]),
  gallery: z.array(GalleryItem).optional().default([]),
  relatedContacts: z.array(RelatedContact).optional().default([]),
}

/**
 * POST /api/customers — create a customer.
 * At least one of name/firstName+lastName must identify the customer.
 */
export const CustomerCreateSchema = z.object(CustomerWritable).superRefine((data, ctx) => {
  if (!data.name && !data.firstName && !data.lastName) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'At least one of name, firstName, or lastName is required',
      path: ['name'],
    })
  }
})

/**
 * PUT /api/customers/:id — partial update.
 * All fields are optional; at least one must be provided.
 */
export const CustomerUpdateSchema = z.object(
  Object.fromEntries(
    Object.entries(CustomerWritable).map(([k, v]) => [k, (v as any).optional()]),
  ) as typeof CustomerWritable,
).refine(
  data => Object.keys(data).length > 0,
  { message: 'At least one field must be provided to update' },
)

// ─── CONTRACT ─────────────────────────────────────────────────────────────────

/** POST /api/contracts — create a contract */
export const ContractCreateSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  customerId: MongoId,
  projectId: MongoId.nullable().optional(),
  customerName: z.string().max(200).optional().default(''),
  customerEmail: z.string().email().or(z.literal('')).optional().default(''),
  customerPhone: z.string().max(30).optional().default(''),
  customerAddress: z.string().max(300).optional().default(''),
  templateId: MongoId.optional(),
  templateName: z.string().max(200).optional().default(''),
  variableValues: z.record(z.string(), z.unknown()).optional().default({}),
  content: z.string().max(500_000).optional().default(''),
  attachedPdf: z.string().max(5_000_000).optional().default(''), // URL or small base64
  attachedGalleryImages: z.array(z.string()).optional().default([]),
  notes: z.string().max(10_000).optional().default(''),
  createdBy: z.string().max(200).optional().default(''),
  // contractNumber auto-generated server-side; client may suggest one
  contractNumber: z.string().max(100).optional(),
})

/**
 * PUT /api/contracts/detail/:id — update a contract.
 *  Excludes fields that must never change after creation (customerId, contractNumber)
 *  or that are set only by the signing flow (signingToken, customerSignature, sentAt).
 */
export const ContractUpdateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  projectId: MongoId.nullable().optional(),
  customerName: z.string().max(200).optional(),
  customerEmail: z.string().email().or(z.literal('')).optional(),
  customerPhone: z.string().max(30).optional(),
  customerAddress: z.string().max(300).optional(),
  templateId: MongoId.optional(),
  templateName: z.string().max(200).optional(),
  variableValues: z.record(z.string(), z.unknown()).optional(),
  content: z.string().max(500_000).optional(),
  attachedPdf: z.string().max(5_000_000).optional(),
  attachedGalleryImages: z.array(z.string()).optional(),
  mergedPdfUrl: z.string().url().or(z.literal('')).optional(),
  mergedPdfGeneratedAt: z.coerce.date().nullable().optional(),
  status: z.enum(['draft', 'pending', 'sent', 'signed', 'completed', 'cancelled']).optional(),
  notes: z.string().max(10_000).optional(),
})

// ─── TASK ─────────────────────────────────────────────────────────────────────

const Subtask = z.object({
  id: z.string().min(1).max(100),
  title: z.string().min(1).max(500),
  completed: z.boolean().optional().default(false),
})

const TaskComment = z.object({
  id: z.string().min(1).max(100),
  author: z.string().max(200),
  avatar: z.string().max(1000).optional().default(''),
  text: z.string().min(1).max(10_000),
  createdAt: z.coerce.date().optional(),
  completed: z.boolean().optional().default(false),
  completedBy: z.string().max(200).optional().default(''),
  completedAt: z.coerce.date().nullable().optional(),
})

const TaskStatus = z.enum(['todo', 'in-progress', 'in-review', 'done'])
const TaskPriority = z.enum(['low', 'medium', 'high'])

/** POST /api/tasks — create a task */
export const TaskCreateSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  description: z.string().max(10_000).optional().default(''),
  priority: TaskPriority.optional().default('medium'),
  assignees: z.array(MongoId).optional().default([]),
  createdBy: MongoId.nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  status: TaskStatus.optional().default('todo'),
  labels: z.array(z.string().max(100)).optional().default([]),
  subtasks: z.array(Subtask).optional().default([]),
  comments: z.array(TaskComment).optional().default([]),
  // order is computed server-side — never accepted from client
})

/** PUT /api/tasks/:id — full or partial update */
export const TaskUpdateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(10_000).optional(),
  priority: TaskPriority.optional(),
  assignees: z.array(MongoId).optional(),
  createdBy: MongoId.nullable().optional(),
  approvedBy: MongoId.nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  status: TaskStatus.optional(),
  labels: z.array(z.string().max(100)).optional(),
  subtasks: z.array(Subtask).optional(),
  comments: z.array(TaskComment).optional(),
  // order is only changed via reorder endpoint — rejected here
})

/** POST /api/tasks/reorder — batch drag-drop status + order update */
export const TaskReorderSchema = z.object({
  updates: z.array(z.object({
    _id: MongoId,
    status: TaskStatus,
    order: z.number().int().min(0),
  })).min(1, 'At least one update is required'),
  // _changedBy/_changedById from body are legacy display hints (still used for notification text)
  _changedBy: z.string().max(200).optional(),
  _changedById: MongoId.optional(),
})

// ─── PIPELINE ─────────────────────────────────────────────────────────────────

export const PipelineCreateSchema = z.object({
  name: z.string().max(200).optional().default(''),
  projectName: z.string().max(200).optional().default(''),
  customerId: MongoId.nullable().optional(),
  customerName: z.string().max(200).optional().default(''),
  firstName: z.string().max(100).optional().default(''),
  lastName: z.string().max(100).optional().default(''),
  email: z.string().email().or(z.literal('')).optional().default(''),
  phone: z.string().max(30).optional().default(''),
  address: z.string().max(300).optional().default(''),
  city: z.string().max(100).optional().default(''),
  state: z.string().max(100).optional().default(''),
  zip: z.string().max(20).optional().default(''),
  notes: z.string().max(10_000).optional().default(''),

  status: MongoId.nullable().optional(),
  estimatedProjectDuration: z.string().max(100).optional().default(''),
  totalEstimate: z.number().nonnegative().nullable().optional(),
  assignedTo: z.string().max(200).optional().default(''),
  estimateSentOn: z.coerce.date().nullable().optional(),
  initialContactDate: z.coerce.date().nullable().optional(),
  lastFollowUpSentOn: z.coerce.date().nullable().optional(),
  dateApproved: z.coerce.date().nullable().optional(),
  projectAssignedTo: z.string().max(200).optional().default(''),
  contactIds: z.array(MongoId).optional().default([]),
  woodOrderDate: z.coerce.date().nullable().optional(),
  tags: z.array(z.string().max(100)).optional().default([]),
  gallery: z.array(GalleryItem).optional().default([]),
  relatedContacts: z.array(RelatedContact).optional().default([]),
  documents: z.array(DocumentItem).optional().default([]),
})

export const PipelineUpdateSchema = PipelineCreateSchema.partial()

// ─── EMPLOYEES ───────────────────────────────────────────────────────────────

export const EmployeeCreateSchema = z.object({
  employee: z.string().min(1, 'Employee name is required').max(200),
  email: z.string().email('Invalid email'),
  position: z.string().min(1, 'Position is required').max(100),
  profileImage: z.string().max(2000).optional().default(''),
  status: z.enum(['Active', 'Inactive']).optional().default('Active'),
  basePay: z.number().nonnegative().optional().default(0),
  workspace: MongoId.nullable().optional(),
})

export const EmployeeUpdateSchema = z.object({
  employee: z.string().min(1).max(200).optional(),
  email: z.string().email().optional(),
  position: z.string().min(1).max(100).optional(),
  profileImage: z.string().max(2000).optional(),
  status: z.enum(['Active', 'Inactive']).optional(),
  basePay: z.number().nonnegative().optional(),
  workspace: MongoId.nullable().optional(),
  sessionEpoch: z.never({ message: 'sessionEpoch cannot be set directly' }).optional(),
  $inc: z.never({ message: '$inc cannot be sent from the client' }).optional(),
})

// ─── PERFORMANCE ─────────────────────────────────────────────────────────────

export const PerformanceCreateSchema = z.object({
  employee: MongoId,
  category: MongoId,
  subCategory: MongoId,
  skill: MongoId,
  currentSkillLevel: z.enum(['Needs Improvement', 'Beginner', 'Developing', 'Proficient', 'Mastered']),
  createdBy: MongoId,
})

export const PerformanceUpdateSchema = z.object({
  currentSkillLevel: z.enum(['Needs Improvement', 'Beginner', 'Developing', 'Proficient', 'Mastered']).optional(),
  notes: z.string().max(2000).optional(),
})

// ─── CATEGORIES / SUBCATEGORIES / SKILLS ─────────────────────────────────────

export const CategoryWriteSchema = z.object({
  category: z.string().min(1, 'Category name is required').max(200),
  icon: z.string().max(100).optional(),
  color: z.string().max(50).optional(),
  order: z.number().int().min(0).optional(),
})

export const SubcategoryWriteSchema = z.object({
  subCategory: z.string().min(1, 'Subcategory name is required').max(200),
  category: MongoId,
  icon: z.string().max(100).optional(),
  color: z.string().max(50).optional(),
  order: z.number().int().min(0).optional(),
})

export const SkillWriteSchema = z.object({
  skill: z.string().min(1, 'Skill name is required').max(200),
  subCategory: MongoId,
  category: MongoId,
  description: z.string().max(2000).optional().default(''),
  order: z.number().int().min(0).optional(),
})

// ─── PROJECT COMMUNICATION ────────────────────────────────────────────────────

export const ProjectCommunicationWriteSchema = z.object({
  projectId: MongoId.optional(),
  customerId: MongoId.optional(),
  subject: z.string().min(1).max(500),
  message: z.string().min(1).max(50_000),
  type: z.enum(['email', 'note', 'call', 'sms', 'other']).optional().default('note'),
  sentBy: z.string().max(200).optional().default(''),
  sentAt: z.coerce.date().optional(),
  attachments: z.array(z.string().url()).optional().default([]),
})

export const ProjectCommunicationUpdateSchema = ProjectCommunicationWriteSchema.partial()

// ─── DROPDOWNS ────────────────────────────────────────────────────────────────

export const DropdownOptionSchema = z.object({
  label: z.string().min(1).max(200),
  value: z.string().max(200).optional(),
  color: z.string().max(50).optional(),
  icon: z.string().max(100).optional(),
  order: z.number().int().min(0).optional(),
  category: z.string().max(100).optional(),
})

export const DropdownWriteSchema = z.object({
  name: z.string().min(1, 'Dropdown name is required').max(200),
  options: z.array(DropdownOptionSchema).optional().default([]),
})

export const DropdownUpdateSchema = DropdownWriteSchema.partial()



// ─── APP SETTINGS ─────────────────────────────────────────────────────────────

export const AppSettingsWriteSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.unknown(),
  description: z.string().max(500).optional().default(''),
  scope: z.string().max(100).optional(),
})

// ─── SKILL BONUS ─────────────────────────────────────────────────────────────

export const SkillBonusWriteSchema = z.object({
  skill: MongoId,
  subCategory: MongoId.optional(),
  category: MongoId.optional(),
  amount: z.number().nonnegative().max(1_000_000),
  bonusType: z.enum(['flat', 'percentage']).optional().default('flat'),
  notes: z.string().max(2000).optional().default(''),
})

export const SkillBonusUpdateSchema = SkillBonusWriteSchema.partial()

// ─── DAILY PRODUCTION ────────────────────────────────────────────────────────

export const DailyProductionWriteSchema = z.object({
  date: z.coerce.date(),
  employeeId: MongoId.optional(),
  category: z.string().max(200).optional().default(''),
  subType: z.string().max(200).optional().default(''),
  quantity: z.number().nonnegative().optional(),
  unit: z.string().max(50).optional().default(''),
  notes: z.string().max(5000).optional().default(''),
  projectId: MongoId.nullable().optional(),
  customerId: MongoId.nullable().optional(),
  reportedBy: z.string().max(200).optional().default(''),
})

export const DailyProductionUpdateSchema = DailyProductionWriteSchema.partial()

// ─── STAIN SIGN-OFF ──────────────────────────────────────────────────────────

export const StainSignOffWriteSchema = z.object({
  projectId: MongoId.optional(),
  customerId: MongoId.optional(),
  employeeId: MongoId.optional(),
  stainColor: z.string().max(200).optional().default(''),
  sheen: z.string().max(100).optional().default(''),
  notes: z.string().max(5000).optional().default(''),
  signedOffBy: z.string().max(200).optional().default(''),
  signedOffAt: z.coerce.date().optional(),
  images: z.array(z.string().url()).optional().default([]),
})

export const StainSignOffUpdateSchema = StainSignOffWriteSchema.partial()

// ─── CONTRACT TEMPLATE ───────────────────────────────────────────────────────────

const TemplateVariable = z.object({
  key: z.string().min(1).max(100),
  label: z.string().min(1).max(200),
  type: z.enum(['text', 'date', 'number', 'currency', 'textarea', 'select', 'signature']).optional().default('text'),
  defaultValue: z.string().max(1000).optional().default(''),
  options: z.array(z.string().max(200)).optional().default([]),
  required: z.boolean().optional().default(false),
  scope: z.enum(['template', 'client']).optional().default('template'),
})

export const ContractTemplateWriteSchema = z.object({
  name: z.string().min(1, 'Template name is required').max(300),
  slug: z.string().max(200).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with dashes').optional(),
  description: z.string().max(5000).optional().default(''),
  content: z.string().max(500_000).optional().default(''),
  variables: z.array(TemplateVariable).optional().default([]),
  category: z.string().max(100).optional().default('General'),
  isActive: z.boolean().optional().default(true),
  createdBy: z.string().max(200).optional().default(''),
})

export const ContractTemplateUpdateSchema = ContractTemplateWriteSchema.partial()

// ─── ESTIMATE ─────────────────────────────────────────────────────────────────

const LineItemSchema = z.object({
  room: z.string().max(200).optional().default(''),
  sku: z.string().max(200).optional().default(''),
  description: z.string().max(2000).optional().default(''),
  quantity: z.number().optional().default(0),
  unit: z.string().max(50).optional().default(''),
  price: z.number().optional().default(0),
  amount: z.number().optional().default(0),
})

/** POST /api/estimates — create an estimate */
export const EstimateCreateSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  customerId: MongoId,
  projectId: MongoId.nullable().optional(),
  customerName: z.string().max(200).optional().default(''),
  customerEmail: z.union([z.string().email(), z.literal(''), z.null(), z.undefined()]).transform(v => v ?? '').optional().default(''),
  customerPhone: z.union([z.string().max(30), z.null(), z.undefined()]).transform(v => v ?? '').optional().default(''),
  customerAddress: z.string().max(300).optional().default(''),
  templateId: MongoId.optional(),
  templateName: z.string().max(200).optional().default(''),
  variableValues: z.record(z.string(), z.unknown()).optional().default({}),
  content: z.string().max(500_000).optional().default(''),
  attachedPdf: z.string().max(5_000_000).optional().default(''), // URL or small base64
  attachedGalleryImages: z.array(z.string()).optional().default([]),
  notes: z.string().max(10_000).optional().default(''),
  createdBy: z.string().max(200).optional().default(''),
  estimateNumber: z.string().max(100).optional(),
  status: z.enum(['draft', 'sent', 'approved', 'change_request', 'declined', 'completed', 'cancelled']).optional().default('draft'),
  lineItems: z.array(LineItemSchema).optional().default([]),
  materialTotal: z.number().optional().default(0),
  laborTotal: z.number().optional().default(0),
  taxTotal: z.number().optional().default(0),
  discountTotal: z.number().optional().default(0),
  totalAmount: z.number().optional().default(0),
})

/** PUT /api/estimates/detail/:id — update an estimate */
export const EstimateUpdateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  projectId: MongoId.nullable().optional(),
  customerName: z.string().max(200).optional(),
  customerEmail: z.string().email().or(z.literal('')).optional(),
  customerPhone: z.string().max(30).optional(),
  customerAddress: z.string().max(300).optional(),
  templateId: MongoId.optional(),
  templateName: z.string().max(200).optional(),
  variableValues: z.record(z.string(), z.unknown()).optional(),
  content: z.string().max(500_000).optional(),
  attachedPdf: z.string().max(5_000_000).optional(),
  attachedGalleryImages: z.array(z.string()).optional(),
  mergedPdfUrl: z.string().url().or(z.literal('')).optional(),
  mergedPdfGeneratedAt: z.coerce.date().nullable().optional(),
  status: z.enum(['draft', 'sent', 'completed', 'cancelled']).optional(),
  notes: z.string().max(10_000).optional(),
  lineItems: z.array(LineItemSchema).optional(),
  materialTotal: z.number().optional(),
  laborTotal: z.number().optional(),
  taxTotal: z.number().optional(),
  discountTotal: z.number().optional(),
  totalAmount: z.number().optional(),
})

// ─── ESTIMATE TEMPLATE ───────────────────────────────────────────────────────

const EstimateTemplateVariable = z.object({
  key: z.string().min(1).max(100),
  label: z.string().min(1).max(200),
  type: z.enum(['text', 'date', 'number', 'currency', 'textarea', 'select']).optional().default('text'),
  defaultValue: z.string().max(1000).optional().default(''),
  options: z.array(z.string().max(200)).optional().default([]),
  required: z.boolean().optional().default(false),
  scope: z.enum(['template']).optional().default('template'),
})

const PdfSettingsSchema = z.object({
  paragraphSpacing: z.number().min(0).max(2).optional().default(0.75),
  lineHeight: z.number().min(1).max(2.5).optional().default(1.75),
  headingSpacing: z.number().min(0).max(3).optional().default(1.5),
  listSpacing: z.number().min(0).max(2).optional().default(0.75),
  fontSize: z.number().min(10).max(18).optional().default(14),
}).optional()

export const EstimateTemplateWriteSchema = z.object({
  name: z.string().min(1, 'Template name is required').max(300),
  slug: z.string().max(200).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with dashes').optional(),
  description: z.string().max(5000).optional().default(''),
  content: z.string().max(500_000).optional().default(''),
  variables: z.array(EstimateTemplateVariable).optional().default([]),
  category: z.string().max(100).optional().default('General'),
  isActive: z.boolean().optional().default(true),
  createdBy: z.string().max(200).optional().default(''),
  pdfSettings: PdfSettingsSchema,
})

export const EstimateTemplateUpdateSchema = EstimateTemplateWriteSchema.partial()

// ─── CUSTOM BONUS (Performance) ─────────────────────────────────────────────

export const CustomBonusWriteSchema = z.object({
  employee: MongoId,
  subCategory: MongoId,
  bonusAmount: z.number().nonnegative().max(1_000_000),
  reason: z.string().max(2000).optional().default(''),
  createdBy: MongoId.nullable().optional(),
})

// ─── CONTRACT SEND EMAIL ─────────────────────────────────────────────────────

export const ContractSendEmailSchema = z.object({
  contractId: MongoId,
  overrideEmail: z.string().email().or(z.literal('')).optional(),
})

// ─── WORKSPACE (simplified — actual model has more fields) ───────────────────

// Strict type for permission ops
const CrudOpEnum = z.enum(['create', 'read', 'update', 'delete'])
const FieldModeEnum = z.enum(['hidden', 'read', 'edit'])

export const WorkspaceCreateSchema = z.object({
  name: z.string().min(1, 'Workspace name is required').max(200),
  logo: z.string().max(200).optional(),
  plan: z.string().max(100).optional(),
  allowedMenus: z.array(z.string().max(200)).optional().default([]),
  menuPermissions: z.record(z.string(), z.array(CrudOpEnum)).optional().default({}),
  fieldPermissions: z.record(z.string(), z.record(z.string(), FieldModeEnum)).optional().default({}),
})

// Update schema: NO defaults — omitted fields are left untouched in DB
export const WorkspaceUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  logo: z.string().max(200).optional(),
  plan: z.string().max(100).optional(),
  allowedMenus: z.array(z.string().max(200)).optional(),
  menuPermissions: z.record(z.string(), z.array(CrudOpEnum)).optional(),
  fieldPermissions: z.record(z.string(), z.record(z.string(), FieldModeEnum)).optional(),
})

// ─── UPLOAD ──────────────────────────────────────────────────────────────────

export const CloudinaryUploadSchema = z.object({
  file: z.string().min(1, 'No file provided'),
  folder: z.string().max(200).optional(),
})

export const CompanyLogoUploadSchema = z.object({
  file: z.string().min(1, 'No file provided'),
})

// ─── CHANGE ORDERS ───────────────────────────────────────────────────────────

export const ChangeOrderCreateSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  customerId: MongoId,
  projectId: MongoId.nullable().optional(),
  customerName: z.string().max(200).optional().default(''),
  customerEmail: z.string().email().or(z.literal('')).optional().default(''),
  customerPhone: z.string().max(30).optional().default(''),
  customerAddress: z.string().max(300).optional().default(''),
  projectName: z.string().max(200).optional().default(''),
  templateId: MongoId.optional(),
  templateName: z.string().max(200).optional().default(''),
  variableValues: z.record(z.string(), z.unknown()).optional().default({}),
  content: z.string().max(500_000).optional().default(''),
  notes: z.string().max(10_000).optional().default(''),
  createdBy: z.string().max(200).optional().default(''),
  changeOrderNumber: z.string().max(100).optional(),
})

export const ChangeOrderUpdateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  projectId: MongoId.nullable().optional(),
  customerName: z.string().max(200).optional(),
  customerEmail: z.string().email().or(z.literal('')).optional(),
  customerPhone: z.string().max(30).optional(),
  customerAddress: z.string().max(300).optional(),
  projectName: z.string().max(200).optional(),
  templateId: MongoId.optional(),
  templateName: z.string().max(200).optional(),
  variableValues: z.record(z.string(), z.unknown()).optional(),
  content: z.string().max(500_000).optional(),
  notes: z.string().max(10_000).optional(),
})

// ─── LEARNING CENTER ─────────────────────────────────────────────────────────

const LEARNING_CATEGORIES = ['app-skill-guide', 'video-resources', 'nwfa-documentation', 'installation-guidelines'] as const
const LEARNING_TYPES = ['video', 'document', 'link'] as const
const LEARNING_SOURCES = ['cloudinary', 'youtube', 'external'] as const

export const LearningResourceCreateSchema = z.object({
  title: z.string().min(1, 'Title is required').max(300),
  description: z.string().max(5000).optional().default(''),
  category: z.enum(LEARNING_CATEGORIES),
  type: z.enum(LEARNING_TYPES),
  source: z.enum(LEARNING_SOURCES).optional().default('external'),
  url: z.string().min(1, 'A URL or uploaded file is required').max(2000),
  thumbnail: z.string().max(2000).optional().default(''),
  fileType: z.string().max(50).optional().default(''),
  fileSize: z.number().nonnegative().optional().default(0),
  duration: z.string().max(20).optional().default(''),
  tags: z.array(z.string().max(50)).max(20).optional().default([]),
  order: z.number().int().optional().default(0),
  isPublished: z.boolean().optional().default(true),
  meta: z.record(z.string(), z.unknown()).optional().default({}),
})

export const LearningResourceUpdateSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(5000).optional(),
  category: z.enum(LEARNING_CATEGORIES).optional(),
  type: z.enum(LEARNING_TYPES).optional(),
  source: z.enum(LEARNING_SOURCES).optional(),
  url: z.string().min(1).max(2000).optional(),
  thumbnail: z.string().max(2000).optional(),
  fileType: z.string().max(50).optional(),
  fileSize: z.number().nonnegative().optional(),
  duration: z.string().max(20).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  order: z.number().int().optional(),
  isPublished: z.boolean().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
})

// ─── TimeEntry (TimeSheet) ───────────────────────────────────────────────────

export const TimeEntryClockInSchema = z.object({
  projectId: z.string().regex(/^[0-9a-f]{24}$/i).optional().nullable(),
  projectName: z.string().max(300).optional().default(''),
  customerName: z.string().max(300).optional().default(''),
  notes: z.string().max(2000).optional().default(''),
})

export const TimeEntryClockOutSchema = z.object({
  notes: z.string().max(2000).optional(),
})

export const TimeEntryUpdateSchema = z.object({
  projectId: z.string().regex(/^[0-9a-f]{24}$/i).optional().nullable(),
  projectName: z.string().max(300).optional(),
  customerName: z.string().max(300).optional(),
  notes: z.string().max(2000).optional(),
  clockIn: z.string().datetime().optional(),
  clockOut: z.string().datetime().optional().nullable(),
})
