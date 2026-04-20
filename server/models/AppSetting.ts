import mongoose from 'mongoose'

const AppSettingSchema = new mongoose.Schema(
    {
        key: { type: String, required: true, unique: true, trim: true },
        value: { type: mongoose.Schema.Types.Mixed, required: true },
        description: { type: String, default: '' },
    },
    { timestamps: true, collection: 'hardwoodDB_AppSettings' },
)

export const AppSetting = (mongoose.models.AppSetting || mongoose.model('AppSetting', AppSettingSchema)) as any
