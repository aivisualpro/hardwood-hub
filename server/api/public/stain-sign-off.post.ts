import { connectDB } from '../../utils/mongoose'
import { StainSignOff } from '../../models/StainSignOff'

export default defineEventHandler(async (event) => {
    // Only allow POST requests for the public endpoint
    if (event.method !== 'POST') {
        throw createError({ statusCode: 405, message: 'Method not allowed' })
    }

    try {
        await connectDB()
        const body = await readBody(event)

        // Ensure we only accept the allowed fields from a public submission
        const doc = await StainSignOff.create({
            clientName: body.clientName,
            email: body.email,
            stainColorAdditive: body.stainColorAdditive,
            isStainSamplesThrough: body.isStainSamplesThrough,
            isScreensNotAnAccurate: body.isScreensNotAnAccurate,
            isWoodNaturalProduct: body.isWoodNaturalProduct,
            isAnyChangesColorsYourExpense: body.isAnyChangesColorsYourExpense,
            isMaplePineOther: body.isMaplePineOther,
            specialNotes: body.specialNotes,
            isSigned: body.isSigned,
            signature: body.signature,
            createdBy: 'Client (Public Form)',
        })

        return { success: true, data: { _id: doc._id } }
    } catch (e: any) {
        throw createError({ statusCode: 500, message: e.message })
    }
})
