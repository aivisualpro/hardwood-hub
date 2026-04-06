import { connectDB } from '../../utils/mongoose'
import { ActivityLog } from '../../models/ActivityLog'
import { Category } from '../../models/Category'
import { Skill } from '../../models/Skill'
import { Employee } from '../../models/Employee'
import { Task } from '../../models/Task'
import { ProjectCommunication } from '../../models/ProjectCommunication'
import { DailyProduction } from '../../models/DailyProduction'
import { Customer } from '../../models/Customer'
import { CrmSubmission } from '../../models/CrmSubmission'
import { Contract } from '../../models/Contract'
import { StainSignOff } from '../../models/StainSignOff'

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
        totalsByType
    ] = await Promise.all([
        Category.countDocuments(),
        Skill.countDocuments(),
        ActivityLog.countDocuments({ isRead: false }),
        Employee.countDocuments(),
        Task.countDocuments(),
        ProjectCommunication.countDocuments(),
        DailyProduction.countDocuments(),
        Customer.countDocuments(),
        Contract.countDocuments(),
        StainSignOff.countDocuments(),
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
        '/crm/customers': totalCustomers,
        '/crm/contracts': totalContracts,
        '/external/stain-sign-off': totalStainSignOff,
        '/crm/appointments': crmCounts['appointment'] || 0,
        '/crm/fast-quotes': crmCounts['fast-quote'] || 0,
        '/crm/flooring-estimate': crmCounts['flooring-estimate'] || 0,
        '/crm/subscribers': crmCounts['subscriber'] || 0,
        '/crm/conditional-logic': crmCounts['conditional-logic'] || 0,
    }

    return {
        success: true,
        data: counts
    }
})
