import { VertexAI } from '@google-cloud/vertexai'
import fs from 'fs'

const project = 'pragmatic-aegis-493321-v1'
const location = 'us-central1'
const client_email = 'hardwoodcrm@pragmatic-aegis-493321-v1.iam.gserviceaccount.com'
const private_key = process.env.PRIVATE_KEY.replace(/\\n/g, '\n')

const vertexAI = new VertexAI({
  project,
  location,
  googleAuthOptions: { credentials: { client_email, private_key } }
})

const testModel = async (modelName) => {
  try {
    const model = vertexAI.getGenerativeModelPreview({ model: modelName })
    const res = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: 'say hi' }] }] })
    console.log(modelName, 'SUCCESS:', res.response.candidates[0].content.parts[0].text)
  } catch (e) {
    console.error(modelName, 'ERROR:', e.message)
  }
}

async function run() {
  await testModel('gemini-1.5-flash')
  await testModel('gemini-1.5-flash-001')
  await testModel('gemini-1.5-pro')
}
run()
