/**
 * Ensure all MongoDB indexes are created for optimal M10 Atlas performance.
 * Run: npx tsx server/scripts/ensure-indexes.ts
 */
import mongoose from 'mongoose'
import dotenv from 'dotenv'
dotenv.config()

const MONGO_URI = process.env.NUXT_MONGODB_URI || ''

async function run() {
    await mongoose.connect(MONGO_URI)
    const db = mongoose.connection.db!
    console.log('🔌 Connected to MongoDB\n')

    // ─── Index Definitions ───────────────────────────────────
    // Each entry: [collectionName, indexSpec, options?]
    const indexes: Array<[string, Record<string, 1 | -1 | 'text'>, mongoose.IndexDefinition?]> = [

        // ── Customers (294 docs, pipeline page, search, status filter) ──
        ['hardwoodDB_Customers', { status: 1 }],
        ['hardwoodDB_Customers', { name: 1 }],
        ['hardwoodDB_Customers', { email: 1 }],
        ['hardwoodDB_Customers', { phone: 1 }],
        ['hardwoodDB_Customers', { createdAt: -1 }],
        ['hardwoodDB_Customers', { status: 1, name: 1 }],   // Pipeline grouped by status, sorted by name
        ['hardwoodDB_Customers', { name: 'text', email: 'text', phone: 'text' }],  // Text search

        // ── CRM Submissions (850 docs, heavy aggregation) ──
        ['hardwoodDB_CrmSubmissions', { type: 1, dateSubmitted: -1 }],
        ['hardwoodDB_CrmSubmissions', { gfEntryId: 1 }],     // Already unique
        ['hardwoodDB_CrmSubmissions', { gfFormId: 1 }],
        ['hardwoodDB_CrmSubmissions', { status: 1 }],
        ['hardwoodDB_CrmSubmissions', { dateSubmitted: -1 }],
        ['hardwoodDB_CrmSubmissions', { type: 1, status: 1 }],
        ['hardwoodDB_CrmSubmissions', { createdAt: -1 }],

        // ── Tasks (8+ docs, kanban board: filter by status, sort by dueDate) ──
        ['hardwoodDB_tasks', { status: 1, dueDate: 1, createdAt: -1 }], // Main kanban query
        ['hardwoodDB_tasks', { status: 1, order: 1 }],  // Already defined in schema
        ['hardwoodDB_tasks', { assignees: 1 }],
        ['hardwoodDB_tasks', { createdBy: 1 }],
        ['hardwoodDB_tasks', { createdAt: -1 }],

        // ── Employees (10 docs, frequent lookups) ──
        ['hardwoodDB_Employees', { email: 1 }],
        ['hardwoodDB_Employees', { status: 1 }],
        ['hardwoodDB_Employees', { createdAt: -1 }],

        // ── EmpSkillPerformance (2372 docs, largest query-heavy collection) ──
        ['hardwoodDB_EmpSkillPerformance', { employee: 1 }],
        ['hardwoodDB_EmpSkillPerformance', { employee: 1, skill: 1 }], // findOne by employee + skill
        ['hardwoodDB_EmpSkillPerformance', { employee: 1, category: 1 }],
        ['hardwoodDB_EmpSkillPerformance', { category: 1, subCategory: 1 }],
        ['hardwoodDB_EmpSkillPerformance', { createdAt: -1 }],
        ['hardwoodDB_EmpSkillPerformance', { employee: 1, subCategory: 1, skill: 1 }],  // Proficiency check

        // ── Activity Logs (5828 docs, dashboard + nav counts) ──
        ['hardwoodDB_activitylogs', { createdAt: -1 }],     // Already defined
        ['hardwoodDB_activitylogs', { isRead: 1 }],          // Nav count: unread
        ['hardwoodDB_activitylogs', { user: 1, createdAt: -1 }],
        ['hardwoodDB_activitylogs', { module: 1, action: 1, createdAt: -1 }],

        // ── Daily Production ──
        ['hardwoodDB_DailyProduction', { createdAt: -1 }],
        ['hardwoodDB_DailyProduction', { employeeName: 1 }],
        ['hardwoodDB_DailyProduction', { date: -1 }],
        ['hardwoodDB_DailyProduction', { employeeName: 1, date: -1 }],

        // ── Bonus Distributions (292 docs) ──
        ['hardwoodDB_BonusDistributions', { employee: 1, createdAt: -1 }],
        ['hardwoodDB_BonusDistributions', { employee: 1, subCategory: 1, bonusType: 1 }],
        ['hardwoodDB_BonusDistributions', { status: 1 }],

        // ── Contracts ──
        ['hardwoodDB_Contracts', { status: 1, createdAt: -1 }],
        ['hardwoodDB_Contracts', { customerId: 1 }],
        ['hardwoodDB_Contracts', { signingToken: 1 }],

        // ── Skills ──
        ['hardwoodDB_Skills', { category: 1 }],
        ['hardwoodDB_Skills', { createdAt: -1 }],

        // ── SubCategories ──
        ['hardwoodDB_subCategories', { category: 1 }],
        ['hardwoodDB_subCategories', { name: 1 }],

        // ── Categories ──
        ['hardwoodDB_Categories', { name: 1 }],

        // ── Products ──
        ['hardwoodDB_Products', { createdAt: -1 }],

        // ── Stain Sign Off ──
        ['hardwoodDB_StainSignOff', { createdAt: -1 }],
        ['hardwoodDB_StainSignOff', { isSigned: 1 }],

        // ── Dropdowns ──
        ['hardwoodDB_Dropdowns', { name: 1 }],    // Already unique

        // ── Project Communication ──
        ['hardwoodDB_ProjectCommunicationData', { createdAt: -1 }],

        // ── Workspaces ──
        ['workspaces', { createdAt: 1 }],

        // ── Skill Bonus ──
        ['hardwoodDB_SkillBonus', { createdAt: -1 }],
    ]

    // ─── Create Indexes ──────────────────────────────────────
    let created = 0
    let skipped = 0
    let errors = 0

    for (const [collection, spec, options] of indexes) {
        try {
            const col = db.collection(collection)
            const result = await col.createIndex(spec as any, options as any || {})
            console.log(`  ✅ ${collection}.${result}`)
            created++
        } catch (e: any) {
            if (e.code === 85 || e.code === 86) {
                // Index already exists with different options — skip
                console.log(`  ⏭️  ${collection}: index exists (${Object.keys(spec).join(',')})`)
                skipped++
            } else {
                console.error(`  ❌ ${collection}: ${e.message}`)
                errors++
            }
        }
    }

    console.log(`\n📊 Summary: ${created} created, ${skipped} skipped, ${errors} errors`)

    // ─── Print final index counts ────────────────────────────
    console.log('\n📋 Final index counts per collection:\n')
    const collections = await db.listCollections().toArray()
    for (const c of collections.sort((a, b) => a.name.localeCompare(b.name))) {
        try {
            const idxs = await db.collection(c.name).indexes()
            console.log(`  ${c.name}: ${idxs.length} indexes`)
        } catch { }
    }

    await mongoose.disconnect()
    console.log('\n🏁 Done!')
}

run().catch(err => { console.error('❌', err); process.exit(1) })
