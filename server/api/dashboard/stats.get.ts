// GET /api/dashboard/stats — aggregated dashboard metrics
import { connectDB } from '../../utils/mongoose'
import { Employee } from '../../models/Employee'
import { Task } from '../../models/Task'
import { DailyProduction } from '../../models/DailyProduction'
import { Skill } from '../../models/Skill'
import { Category } from '../../models/Category'
import { SubCategory } from '../../models/SubCategory'
import { ProjectCommunication } from '../../models/ProjectCommunication'
import { EmpSkillPerformance } from '../../models/EmpSkillPerformance'
import { Contract } from '../../models/Contract'
import { CrmSubmission } from '../../models/CrmSubmission'
import { ActivityLog } from '../../models/ActivityLog'
import { StainSignOff } from '../../models/StainSignOff'

export default defineEventHandler(async () => {
    await connectDB()

    // Run all queries in parallel for speed
    const [
        totalEmployees,
        activeEmployees,
        totalTasks,
        totalSkills,
        totalCategories,
        totalSubCategories,
        totalProduction,
        totalCommunications,
        tasksByStatus,
        recentProduction,
        recentTasks,
        recentEmployees,
        // New: richer data
        totalContracts,
        contractsByStatus,
        totalCrm,
        crmByType,
        crmByStatus,
        totalSignOffs,
        signedSignOffs,
        totalPerformanceRecords,
        perfByLevel,
        productionLast30,
        perfLast30,
        topProducers,
        recentActivity,
        employees,
    ] = await Promise.all([
        Employee.countDocuments(),
        Employee.countDocuments({ status: 'Active' }),
        Task.countDocuments(),
        Skill.countDocuments(),
        Category.countDocuments(),
        SubCategory.countDocuments(),
        DailyProduction.countDocuments(),
        ProjectCommunication.countDocuments(),
        Task.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        DailyProduction.find()
            .sort({ createdAt: -1 })
            .limit(7)
            .lean<any[]>(),
        Task.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .lean<any[]>(),
        Employee.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .lean<any[]>(),
        // Contracts
        Contract.countDocuments(),
        Contract.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        // CRM
        CrmSubmission.countDocuments(),
        CrmSubmission.aggregate([
            { $group: { _id: '$type', count: { $sum: 1 } } },
        ]),
        CrmSubmission.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        // Stain Sign Offs
        StainSignOff.countDocuments(),
        StainSignOff.countDocuments({ isSigned: true }),
        // Performance reviews
        EmpSkillPerformance.countDocuments(),
        EmpSkillPerformance.aggregate([
            { $group: { _id: '$currentSkillLevel', count: { $sum: 1 } } },
        ]),
        // Production trends (last 30 days)
        DailyProduction.aggregate([
            {
                $match: {
                    createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
                },
            },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    sqft: { $sum: { $ifNull: ['$squareFeetCompleted', 0] } },
                    hours: { $sum: { $ifNull: ['$productionHours', 0] } },
                    entries: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
        ]),
        // Performance reviews last 30 days
        EmpSkillPerformance.aggregate([
            {
                $match: {
                    createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
                },
            },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    reviews: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
        ]),
        // Top producers (by sqft)
        DailyProduction.aggregate([
            {
                $match: {
                    createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
                },
            },
            {
                $group: {
                    _id: '$employeeName',
                    totalSqft: { $sum: { $ifNull: ['$squareFeetCompleted', 0] } },
                    totalHours: { $sum: { $ifNull: ['$productionHours', 0] } },
                    entries: { $sum: 1 },
                    onTime: {
                        $sum: {
                            $cond: [{ $eq: ['$wereYouOnTime', 'Yes'] }, 1, 0],
                        },
                    },
                },
            },
            { $sort: { totalSqft: -1 } },
            { $limit: 8 },
        ]),
        // Recent activity logs
        ActivityLog.find()
            .sort({ createdAt: -1 })
            .limit(10)
            .lean<any[]>(),
        // All employees for health grid
        Employee.find().select('employee status position profileImage').lean<any[]>(),
    ])

    // Map task statuses
    const taskStatusMap: Record<string, number> = {}
    for (const row of tasksByStatus) {
        taskStatusMap[row._id || 'No Status'] = row.count
    }

    // Map contract statuses
    const contractStatusMap: Record<string, number> = {}
    for (const row of contractsByStatus) {
        contractStatusMap[row._id || 'unknown'] = row.count
    }

    // Map CRM types
    const crmTypeMap: Record<string, number> = {}
    for (const row of crmByType) {
        crmTypeMap[row._id || 'other'] = row.count
    }

    // Map CRM statuses
    const crmStatusMap: Record<string, number> = {}
    for (const row of crmByStatus) {
        crmStatusMap[row._id || 'unknown'] = row.count
    }

    // Map perf levels
    const perfLevelMap: Record<string, number> = {}
    for (const row of perfByLevel) {
        if (row._id) perfLevelMap[row._id] = row.count
    }

    return {
        success: true,
        data: {
            employees: {
                total: totalEmployees,
                active: activeEmployees,
                inactive: totalEmployees - activeEmployees,
                list: employees.map((e: any) => ({
                    _id: String(e._id),
                    name: e.employee,
                    status: e.status || 'Active',
                    position: e.position || '',
                    image: e.profileImage || '',
                })),
            },
            tasks: {
                total: totalTasks,
                byStatus: taskStatusMap,
            },
            skills: {
                total: totalSkills,
                categories: totalCategories,
                subCategories: totalSubCategories,
            },
            production: {
                total: totalProduction,
                trend: productionLast30.map((d: any) => ({
                    date: d._id,
                    sqft: d.sqft || 0,
                    hours: Math.round((d.hours || 0) * 10) / 10,
                    entries: d.entries || 0,
                })),
                topProducers: topProducers.map((p: any) => ({
                    name: p._id || 'Unknown',
                    sqft: p.totalSqft || 0,
                    hours: Math.round((p.totalHours || 0) * 10) / 10,
                    entries: p.entries || 0,
                    onTimeRate: p.entries > 0 ? Math.round((p.onTime / p.entries) * 100) : 0,
                })),
            },
            communications: {
                total: totalCommunications,
            },
            contracts: {
                total: totalContracts,
                byStatus: contractStatusMap,
            },
            crm: {
                total: totalCrm,
                byType: crmTypeMap,
                byStatus: crmStatusMap,
            },
            stainSignOffs: {
                total: totalSignOffs,
                signed: signedSignOffs,
            },
            performance: {
                total: totalPerformanceRecords,
                byLevel: perfLevelMap,
                trend: perfLast30.map((d: any) => ({
                    date: d._id,
                    reviews: d.reviews || 0,
                })),
            },
            activity: recentActivity.map((a: any) => ({
                _id: String(a._id),
                user: a.user || 'System',
                action: a.action,
                module: a.module,
                description: a.description,
                targetName: a.targetName || '',
                userImage: a.userImage || '',
                createdAt: a.createdAt,
            })),
            recent: {
                production: recentProduction.map((p: any) => ({
                    _id: String(p._id),
                    employeeName: p.employeeName || 'Unknown',
                    date: p.date || p.createdAt,
                    block1Category: p.block1Category || '',
                    squareFeetCompleted: p.squareFeetCompleted || 0,
                    productionHours: p.productionHours || 0,
                })),
                tasks: recentTasks.map((t: any) => ({
                    _id: String(t._id),
                    title: t.title || 'Untitled',
                    status: t.status || 'Backlog',
                    priority: t.priority || 'medium',
                    assigneeName: t.assignee?.name || '',
                    assigneeAvatar: t.assignee?.avatar || '',
                    createdAt: t.createdAt,
                })),
                employees: recentEmployees.map((e: any) => ({
                    _id: String(e._id),
                    employee: e.employee,
                    position: e.position,
                    profileImage: e.profileImage || '',
                    status: e.status || 'Active',
                    createdAt: e.createdAt,
                })),
            },
        },
    }
})
