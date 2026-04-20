import { GoogleGenAI } from '@google/genai';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const env = envFile.split('\n').reduce((acc, line) => {
  const [key, ...value] = line.split('=');
  if (key && value) acc[key.trim()] = value.join('=').trim().replace(/^"|"$/g, '');
  return acc;
}, {});

const test = async () => {
    const ai = new GoogleGenAI({
      vertexai: true,
      project: env.GOOGLE_CLOUD_PROJECT_ID,
      location: env.GOOGLE_CLOUD_LOCATION || 'us-central1',
      googleAuthOptions: {
        credentials: {
          client_email: env.GOOGLE_CLIENT_EMAIL,
          private_key: env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }
      }
    });

  const tryModel = async (modelName) => {
    try {
      console.log(`Calling Vertex AI ${modelName}...`);
      const res = await ai.models.generateContent({
        model: modelName,
        contents: "Hello, what is 2+2?"
      });
      console.log(`Success ${modelName}:`, res.text);
    } catch (err) {
      console.error(`ERROR ${modelName}:`, err.message);
    }
  }

  await tryModel('gemini-2.5-flash');
  await tryModel('gemini-2.0-flash');
};
test();
