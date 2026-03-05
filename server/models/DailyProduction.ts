import mongoose, { Schema, Document } from 'mongoose'

export interface IDailyProduction extends Document {
    employeeName?: string
    jobClient?: string
    wereYouOnTime?: string
    didYouLeaveTheJobForAnythingOtherThanLunch?: string
    totalMinutesOffSiteNotIncludingLunch?: number | null
    reasonForLeaving?: string
    totalMinutesLate?: number | null
    whatWorkDidYouPerformTodaySelectAllThatApply?: string[]
    block1Category?: string
    productionHours?: number | null
    squareFeetCompleted?: number | null
    linearFeetCompleted?: number | null
    count?: number | null
    didYouDoASecondTypeOfWorkToday?: string
    block2Category?: string
    productionHoursBlock2?: number | null
    squareFeetCompletedBlock2?: number | null
    linearFeetCompletedBlock2?: number | null
    countBlock2?: number | null
    didYouDoAThirdTypeOfWorkToday?: string
    block3Category?: string
    productionHoursBlock3?: number | null
    squareFeetCompletedBlock3?: number | null
    linearFeetCompletedBlock3?: number | null
    countBlock3?: number | null
    anyBlockersThatSlowedYouDownToday?: string
    issuesWithTheFormMissingDataThatNeedsToBeCaptured?: string
    createdBy?: string
}

const DailyProductionSchema = new Schema(
    {
        employeeName: { type: String, default: null },
        jobClient: { type: String, default: null },
        wereYouOnTime: { type: String, default: null },
        didYouLeaveTheJobForAnythingOtherThanLunch: { type: String, default: null },
        totalMinutesOffSiteNotIncludingLunch: { type: Number, default: null },
        reasonForLeaving: { type: String, default: null },
        totalMinutesLate: { type: Number, default: null },
        whatWorkDidYouPerformTodaySelectAllThatApply: { type: [String], default: [] },
        block1Category: { type: String, default: null },
        productionHours: { type: Number, default: null },
        squareFeetCompleted: { type: Number, default: null },
        linearFeetCompleted: { type: Number, default: null },
        count: { type: Number, default: null },
        didYouDoASecondTypeOfWorkToday: { type: String, default: null },
        block2Category: { type: String, default: null },
        productionHoursBlock2: { type: Number, default: null },
        squareFeetCompletedBlock2: { type: Number, default: null },
        linearFeetCompletedBlock2: { type: Number, default: null },
        countBlock2: { type: Number, default: null },
        didYouDoAThirdTypeOfWorkToday: { type: String, default: null },
        block3Category: { type: String, default: null },
        productionHoursBlock3: { type: Number, default: null },
        squareFeetCompletedBlock3: { type: Number, default: null },
        linearFeetCompletedBlock3: { type: Number, default: null },
        countBlock3: { type: Number, default: null },
        anyBlockersThatSlowedYouDownToday: { type: String, default: null },
        issuesWithTheFormMissingDataThatNeedsToBeCaptured: { type: String, default: null },
        createdBy: { type: String, default: null },
    },
    { timestamps: true }
)

export const DailyProduction = mongoose.models.DailyProduction || mongoose.model<IDailyProduction>('DailyProduction', DailyProductionSchema, 'hardwoodDB_DailyProduction')
