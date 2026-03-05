import mongoose, { Schema, Document } from 'mongoose'

export interface IProjectCommunication extends Document {
    leadTechnicianSupervisorTechnician?: string
    pleaseMarkIfThisProjectIsFullyCompleteOrNot?: string
    leaveAnyNotesAboutThingsThatStillNeedToBeDoneForFutureCrews?: string
    whatTypeOfWoodFlooringWasUsedOnTheProjectSelectAllThatApply?: string[]
    gradeOfFlooring?: string[]
    widthOfFlooring?: string[]
    cutOfFlooring?: string[]
    fidBox?: string[]
    stain?: string[]
    ifMixWhatColorsAndRatio?: string
    whatSealerWasUsed?: string[]
    whatWasTheFirstCoatOfFinish?: string[]
    whatWasTheFinalCoatOfFinish?: string[]
    whatSheen?: string[]
    whatAdditivesToFinish?: string[]
    allTasksAssignedToProjectLeadFromQcAreCompleted?: string
    ifNoWhatNeedsToBeDone?: string
    wasThereAChangeOrderFilledOut?: string
    wasThereAnyWorkAdded?: string
    wasThereAnyWorkNotCompletedThatShouldBeRemovedFromTheInvoice?: string
    listAnyWorkRemovedOrAddedPleaseGiveAsMuchDetailAsPossibleForBilling?: string
    howWouldYouRateYourTeamsPerformanceOnThisProject?: string
    howWouldYouRateYourInteractionsWithTheClient?: string
    anyOtherNotesAboutThisProject?: string
    didYouTakeFinalPictures?: string
}

const ProjectCommunicationSchema = new Schema(
    {
        leadTechnicianSupervisorTechnician: { type: String, default: '' },
        pleaseMarkIfThisProjectIsFullyCompleteOrNot: { type: String, default: '' },
        leaveAnyNotesAboutThingsThatStillNeedToBeDoneForFutureCrews: { type: String, default: '' },
        whatTypeOfWoodFlooringWasUsedOnTheProjectSelectAllThatApply: { type: [String], default: [] },
        gradeOfFlooring: { type: [String], default: [] },
        widthOfFlooring: { type: [String], default: [] },
        cutOfFlooring: { type: [String], default: [] },
        fidBox: { type: [String], default: [] },
        stain: { type: [String], default: [] },
        ifMixWhatColorsAndRatio: { type: String, default: '' },
        whatSealerWasUsed: { type: [String], default: [] },
        whatWasTheFirstCoatOfFinish: { type: [String], default: [] },
        whatWasTheFinalCoatOfFinish: { type: [String], default: [] },
        whatSheen: { type: [String], default: [] },
        whatAdditivesToFinish: { type: [String], default: [] },
        allTasksAssignedToProjectLeadFromQcAreCompleted: { type: String, default: '' },
        ifNoWhatNeedsToBeDone: { type: String, default: '' },
        wasThereAChangeOrderFilledOut: { type: String, default: '' },
        wasThereAnyWorkAdded: { type: String, default: '' },
        wasThereAnyWorkNotCompletedThatShouldBeRemovedFromTheInvoice: { type: String, default: '' },
        listAnyWorkRemovedOrAddedPleaseGiveAsMuchDetailAsPossibleForBilling: { type: String, default: '' },
        howWouldYouRateYourTeamsPerformanceOnThisProject: { type: String, default: '' },
        howWouldYouRateYourInteractionsWithTheClient: { type: String, default: '' },
        anyOtherNotesAboutThisProject: { type: String, default: '' },
        didYouTakeFinalPictures: { type: String, default: '' },
    },
    { timestamps: true }
)

export const ProjectCommunication = mongoose.models.ProjectCommunication || mongoose.model<IProjectCommunication>('ProjectCommunication', ProjectCommunicationSchema, 'hardwoodDB_ProjectCommunicationData')
