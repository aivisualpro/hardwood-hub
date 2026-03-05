// POST /api/tasks/seed — one-time seed of dummy tasks into MongoDB
import { connectDB } from '../../utils/mongoose'
import { Task } from '../../models/Task'

const seedTasks = [
    // ─── To Do ─────────────────────────────────────
    {
        taskId: 'TASK-001', title: 'Fix pagination on inventory table',
        description: 'The inventory table shows incorrect page counts when filters are applied. The total count is not respecting the active category filter.',
        priority: 'high',
        assignee: { id: 'u2', name: 'Adeel Jabbar', avatar: '/avatars/adeel.png' },
        dueDate: new Date(Date.now() + 2 * 86400000), status: 'todo', labels: ['Bug', 'Inventory'], order: 0,
        subtasks: [
            { id: 'st-014', title: 'Reproduce the bug with filters', completed: true },
            { id: 'st-015', title: 'Fix count query to include filter params', completed: false },
            { id: 'st-016', title: 'Add regression test', completed: false },
        ],
        comments: [
            { id: 'cm-007', author: 'Priya Sharma', avatar: '', text: 'This only happens when category filter is active. All other filters work fine.', createdAt: new Date(Date.now() - 1 * 86400000) },
            { id: 'cm-008', author: 'Adeel Jabbar', avatar: '/avatars/adeel.png', text: 'Found it — the count aggregation pipeline is missing the $match stage for category.', createdAt: new Date(Date.now() - 12 * 3600000) },
        ],
    },
    {
        taskId: 'TASK-002', title: 'Create vendor onboarding form',
        description: 'Build a multi-step form for onboarding new vendors. Include fields for company info, banking details, tax documents, and compliance certifications.',
        priority: 'medium',
        assignee: { id: 'u4', name: 'Priya Sharma', avatar: '' },
        dueDate: new Date(Date.now() + 5 * 86400000), status: 'todo', labels: ['Feature', 'Vendors'], order: 1,
        subtasks: [
            { id: 'st-017', title: 'Design multi-step form wireframe', completed: true },
            { id: 'st-018', title: 'Build step 1: Company info', completed: false },
            { id: 'st-019', title: 'Build step 2: Banking details', completed: false },
            { id: 'st-020', title: 'Build step 3: Document uploads', completed: false },
            { id: 'st-021', title: 'Build step 4: Review & submit', completed: false },
        ],
        comments: [
            { id: 'cm-009', author: 'Sarah Chen', avatar: '', text: 'Wireframes look great! Let\'s add a progress indicator at the top.', createdAt: new Date(Date.now() - 3 * 86400000) },
        ],
    },
    {
        taskId: 'TASK-003', title: 'Optimize dashboard KPI queries',
        description: 'The main dashboard takes 3.2s to load due to unoptimized MongoDB aggregation pipelines. Target < 500ms load time.',
        priority: 'high',
        assignee: { id: 'u3', name: 'Marcus Webb', avatar: '' },
        dueDate: new Date(Date.now() + 3 * 86400000), status: 'todo', labels: ['Performance', 'Backend'], order: 2,
        subtasks: [
            { id: 'st-022', title: 'Profile existing aggregation pipelines', completed: true },
            { id: 'st-023', title: 'Add compound indexes', completed: true },
            { id: 'st-024', title: 'Implement query result caching', completed: false },
            { id: 'st-025', title: 'Benchmark before/after', completed: false },
        ],
        comments: [
            { id: 'cm-010', author: 'Marcus Webb', avatar: '', text: 'Initial profiling shows the revenue aggregation is the bottleneck — no index on createdAt.', createdAt: new Date(Date.now() - 18 * 3600000) },
        ],
    },
    {
        taskId: 'TASK-004', title: 'Add email notifications for order status changes',
        description: 'Send automated email notifications when sale order status changes (confirmed, shipped, delivered).',
        priority: 'medium',
        assignee: { id: 'u1', name: 'Sarah Chen', avatar: '' },
        dueDate: new Date(Date.now() + 7 * 86400000), status: 'todo', labels: ['Feature', 'Notifications'], order: 3,
        subtasks: [
            { id: 'st-026', title: 'Design email templates', completed: false },
            { id: 'st-027', title: 'Create notification trigger in order workflow', completed: false },
            { id: 'st-028', title: 'Add user notification preferences', completed: false },
        ],
        comments: [],
    },

    // ─── In Progress ────────────────────────────────
    {
        taskId: 'TASK-005', title: 'Build PDF invoice generation',
        description: 'Implement server-side PDF generation for sale order invoices using Google Docs templates.',
        priority: 'high',
        assignee: { id: 'u2', name: 'Adeel Jabbar', avatar: '/avatars/adeel.png' },
        dueDate: new Date(Date.now() + 1 * 86400000), status: 'in-progress', labels: ['Feature', 'Sales'], order: 0,
        subtasks: [
            { id: 'st-029', title: 'Set up Google Docs API auth', completed: true },
            { id: 'st-030', title: 'Create invoice template', completed: true },
            { id: 'st-031', title: 'Implement placeholder replacement', completed: true },
            { id: 'st-032', title: 'Add line items table generation', completed: false },
            { id: 'st-033', title: 'Test with real sale order data', completed: false },
        ],
        comments: [
            { id: 'cm-011', author: 'Adeel Jabbar', avatar: '/avatars/adeel.png', text: 'Service account auth is working. Template placeholder replacement is done.', createdAt: new Date(Date.now() - 2 * 86400000) },
            { id: 'cm-012', author: 'Sarah Chen', avatar: '', text: 'Can we add the company logo to the PDF header?', createdAt: new Date(Date.now() - 1 * 86400000) },
        ],
    },
    {
        taskId: 'TASK-006', title: 'Implement role-based access control',
        description: 'Add granular RBAC with roles: Admin, Manager, Staff, Viewer.',
        priority: 'high',
        assignee: { id: 'u3', name: 'Marcus Webb', avatar: '' },
        dueDate: new Date(Date.now() + 4 * 86400000), status: 'in-progress', labels: ['Security', 'Backend'], order: 1,
        subtasks: [
            { id: 'st-034', title: 'Define role hierarchy and permissions', completed: true },
            { id: 'st-035', title: 'Create middleware for route protection', completed: true },
            { id: 'st-036', title: 'Add role check to API endpoints', completed: false },
            { id: 'st-037', title: 'Build admin role management UI', completed: false },
        ],
        comments: [
            { id: 'cm-014', author: 'Marcus Webb', avatar: '', text: 'Route middleware is done. Moving on to API endpoint protection.', createdAt: new Date(Date.now() - 1 * 86400000) },
        ],
    },
    {
        taskId: 'TASK-007', title: 'Migrate image uploads to Cloudinary',
        description: 'Replace local file storage with Cloudinary CDN. Implement auto-optimization and responsive images.',
        priority: 'medium',
        assignee: { id: 'u4', name: 'Priya Sharma', avatar: '' },
        dueDate: new Date(Date.now() + 6 * 86400000), status: 'in-progress', labels: ['Infrastructure', 'Media'], order: 2,
        subtasks: [
            { id: 'st-038', title: 'Set up Cloudinary account and API keys', completed: true },
            { id: 'st-039', title: 'Create upload utility composable', completed: true },
            { id: 'st-040', title: 'Migrate product images', completed: false },
            { id: 'st-041', title: 'Add responsive image transforms', completed: false },
        ],
        comments: [
            { id: 'cm-015', author: 'Priya Sharma', avatar: '', text: 'Upload composable is working with drag & drop support.', createdAt: new Date(Date.now() - 2 * 86400000) },
        ],
    },

    // ─── In Review ──────────────────────────────────
    {
        taskId: 'TASK-008', title: 'Redesign manufacturing detail page',
        description: 'Overhaul the manufacturing order detail view with better layout and inline editing.',
        priority: 'medium',
        assignee: { id: 'u1', name: 'Sarah Chen', avatar: '' },
        dueDate: new Date(Date.now() + 1 * 86400000), status: 'in-review', labels: ['UI/UX', 'Manufacturing'], order: 0,
        subtasks: [
            { id: 'st-042', title: 'Redesign layout with inline editing', completed: true },
            { id: 'st-043', title: 'Add searchable SKU dropdown', completed: true },
            { id: 'st-044', title: 'Fix theme compatibility for modals', completed: true },
            { id: 'st-045', title: 'Get design approval from PM', completed: false },
        ],
        comments: [
            { id: 'cm-017', author: 'Sarah Chen', avatar: '', text: 'All UI changes done. Screenshots attached in the PR.', createdAt: new Date(Date.now() - 1 * 86400000) },
            { id: 'cm-018', author: 'Adeel Jabbar', avatar: '/avatars/adeel.png', text: 'Looks amazing! One tweak — modal backdrop needs to be slightly darker in light mode.', createdAt: new Date(Date.now() - 6 * 3600000) },
        ],
    },
    {
        taskId: 'TASK-009', title: 'Add bulk import for inventory items',
        description: 'Support CSV/Excel bulk import with validation, duplicate detection, and a preview step.',
        priority: 'high',
        assignee: { id: 'u2', name: 'Adeel Jabbar', avatar: '/avatars/adeel.png' },
        dueDate: new Date(Date.now() - 1 * 86400000), status: 'in-review', labels: ['Feature', 'Inventory'], order: 1,
        subtasks: [
            { id: 'st-046', title: 'Build CSV parser with validation', completed: true },
            { id: 'st-047', title: 'Create preview table component', completed: true },
            { id: 'st-048', title: 'Implement batch insert API', completed: true },
            { id: 'st-049', title: 'Add duplicate detection logic', completed: true },
        ],
        comments: [
            { id: 'cm-019', author: 'Adeel Jabbar', avatar: '/avatars/adeel.png', text: 'Tested with 8,000 rows — imports in ~4 seconds.', createdAt: new Date(Date.now() - 2 * 86400000) },
        ],
    },

    // ─── Done ───────────────────────────────────────
    {
        taskId: 'TASK-010', title: 'Set up Nuxt 4 project with Shadcn Vue',
        description: 'Initialize the boilerplate with Nuxt 4, Shadcn Vue, TailwindCSS 4.',
        priority: 'high',
        assignee: { id: 'u2', name: 'Adeel Jabbar', avatar: '/avatars/adeel.png' },
        dueDate: new Date(Date.now() - 20 * 86400000), status: 'done', labels: ['Infrastructure', 'Setup'], order: 0,
        subtasks: [
            { id: 'st-056', title: 'Initialize Nuxt 4 project', completed: true },
            { id: 'st-057', title: 'Install and configure Shadcn Vue', completed: true },
            { id: 'st-058', title: 'Set up TailwindCSS 4', completed: true },
        ],
        comments: [
            { id: 'cm-023', author: 'Adeel Jabbar', avatar: '/avatars/adeel.png', text: 'Project scaffolding complete.', createdAt: new Date(Date.now() - 28 * 86400000) },
        ],
    },
    {
        taskId: 'TASK-011', title: 'Build sidebar navigation with collapsible groups',
        description: 'Create a responsive sidebar with nested navigation groups and keyboard shortcuts.',
        priority: 'medium',
        assignee: { id: 'u1', name: 'Sarah Chen', avatar: '' },
        dueDate: new Date(Date.now() - 15 * 86400000), status: 'done', labels: ['UI/UX', 'Navigation'], order: 1,
        subtasks: [
            { id: 'st-060', title: 'Build sidebar shell component', completed: true },
            { id: 'st-061', title: 'Add collapsible nav groups', completed: true },
            { id: 'st-062', title: 'Add keyboard shortcuts', completed: true },
        ],
        comments: [
            { id: 'cm-024', author: 'Sarah Chen', avatar: '', text: 'Sidebar supports rail mode and collapsible groups.', createdAt: new Date(Date.now() - 22 * 86400000) },
        ],
    },
    {
        taskId: 'TASK-012', title: 'Deploy to Vercel with custom domain',
        description: 'Configure Vercel deployment with environment variables and custom domain.',
        priority: 'high',
        assignee: { id: 'u3', name: 'Marcus Webb', avatar: '' },
        dueDate: new Date(Date.now() - 5 * 86400000), status: 'done', labels: ['DevOps', 'Deployment'], order: 2,
        subtasks: [
            { id: 'st-070', title: 'Create Vercel project', completed: true },
            { id: 'st-071', title: 'Configure environment variables', completed: true },
            { id: 'st-072', title: 'Set up custom domain DNS', completed: true },
        ],
        comments: [
            { id: 'cm-029', author: 'Marcus Webb', avatar: '', text: 'Deployment pipeline complete.', createdAt: new Date(Date.now() - 10 * 86400000) },
        ],
    },
]

export default defineEventHandler(async (event) => {
    await connectDB()

    // Only seed if collection is empty
    const count = await Task.countDocuments()
    if (count > 0) {
        return { success: true, message: `Already seeded with ${count} tasks`, skipped: true }
    }

    await Task.insertMany(seedTasks)
    return { success: true, message: `Seeded ${seedTasks.length} tasks`, seeded: seedTasks.length }
})
