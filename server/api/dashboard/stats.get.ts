// GET /api/dashboard/stats — aggregated dashboard metrics
import { connectDB } from '../../utils/mongoose'
import { Employee } from '../../models/Employee'
import { Task } from '../../models/Task'
import { DailyProduction } from '../../models/DailyProduction'
import { Skill } from '../../models/Skill'
import { Category } from '../../models/Category'
import { SubCategory } from '../../models/SubCategory'
import { ProjectCommunication } from '../../models/ProjectCommunication'

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
    ])

    // Map task statuses
    const taskStatusMap: Record<string, number> = {}
    for (const row of tasksByStatus) {
        taskStatusMap[row._id || 'No Status'] = row.count
    }

    return {
        success: true,
        data: {
            employees: {
                total: totalEmployees,
                active: activeEmployees,
                inactive: totalEmployees - activeEmployees,
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
            },
            communications: {
                total: totalCommunications,
            },
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
