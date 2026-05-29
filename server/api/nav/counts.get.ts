import { connectDB } from '../../utils/mongoose'
import { ActivityLog } from '../../models/ActivityLog'
import { Category } from '../../models/Category'
import { Skill } from '../../models/Skill'
import { Employee } from '../../models/Employee'
import { Task } from '../../models/Task'
import { ProjectCommunication } from '../../models/ProjectCommunication'
import { DailyProduction } from '../../models/DailyProduction'
import { Pipeline } from '../../models/Pipeline'
import { CrmSubmission } from '../../models/CrmSubmission'
import { Contract } from '../../models/Contract'
import { StainSignOff } from '../../models/StainSignOff'
import { Product } from '../../models/Product'

export default defineEventHandler(async (event) => {
    await connectDB()

    const [
        totalCategory,
        totalSkills,
        unreadActivities,
        totalEmployees,
        totalTasks,
        totalProjComm,
        totalDailyProd,
        totalCustomers,
        totalContracts,
        totalStainSignOff,
        totalProducts,
        totalsByType
    ] = await Promise.all([
        Category.countDocuments(),
        Skill.countDocuments(),
        ActivityLog.countDocuments({ isRead: false }),
        Employee.countDocuments(),
        Task.countDocuments(),
        ProjectCommunication.countDocuments(),
        DailyProduction.countDocuments(),
        Pipeline.countDocuments(),
        Contract.countDocuments(),
        StainSignOff.countDocuments(),
        Product.countDocuments(),
        CrmSubmission.aggregate([
            { $group: { _id: '$type', count: { $sum: 1 } } }
        ])
    ])

    const crmCounts: Record<string, number> = {}
    for (const r of totalsByType) {
        crmCounts[r._id] = r.count
    }

    const counts: Record<string, number> = {
        '/admin/category-tree': totalCategory,
        '/admin/skills': totalSkills,
        '/admin/activities': unreadActivities,
        '/hr/employees': totalEmployees,
        '/tasks': totalTasks,
        '/project-communication': totalProjComm,
        '/daily-production': totalDailyProd,
        '/crm/pipeline': totalCustomers,
        '/crm/products': totalProducts,
        '/crm/contracts': totalContracts,
        '/external/stain-sign-off': totalStainSignOff,
        '/crm/appointments': crmCounts['appointment'] || 0,
        '/crm/flooring-estimate': crmCounts['flooring-estimate'] || 0,
    }

    return {
        success: true,
        data: counts
    }
})
