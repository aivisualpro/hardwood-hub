// POST /api/contracts/templates/parse-pdf
// Accepts a PDF (base64) and uses Google Vertex AI (Gemini) via the new
// @google/genai SDK to extract the content as HTML and detect template variables.
// Uses GOOGLE_CLOUD_* credentials from .env (service account auth).

import { GoogleGenAI } from '@google/genai'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { pdfBase64, fileName } = body

  if (!pdfBase64) {
    throw createError({
      statusCode: 400,
      message: 'PDF file is required (base64)',
    })
  }

  const runtimeConfig = useRuntimeConfig()

  // Prefer Vertex AI (service account) since the Gemini API key is blocked
  const projectId = runtimeConfig.googleCloudProjectId
  const location = runtimeConfig.googleCloudLocation || 'us-central1'
  const clientEmail = runtimeConfig.googleClientEmail
  const privateKey = runtimeConfig.googlePrivateKey
  const apiKey = runtimeConfig.geminiApiKey

  if (!projectId && !apiKey) {
    throw createError({
      statusCode: 500,
      message: 'Neither Vertex AI credentials nor Gemini API Key configured',
    })
  }

  try {
    let ai: GoogleGenAI
    if (projectId && clientEmail && privateKey) {
      // Use Vertex AI with service account credentials
      ai = new GoogleGenAI({
        vertexai: true,
        project: projectId,
        location,
        googleAuthOptions: {
          credentials: {
            client_email: clientEmail,
            private_key: privateKey.replace(/\\n/g, '\n'),
          },
        },
      })
    } else {
      // Fallback to API key
      ai = new GoogleGenAI({ apiKey })
    }

    const prompt = `You are a document analysis expert. Analyze this PDF document and extract its content.

Your task:
1. **Extract ALL content** from the PDF exactly as it appears — preserve the layout, headings, paragraphs, lists, tables, and formatting as closely as possible.
2. **Convert the content to clean HTML** that can be used in a rich text editor (TipTap). Use semantic HTML tags:
   - <h1>, <h2>, <h3> for headings
   - <p> for paragraphs
   - <ul>/<ol> with <li> for lists
   - <table>, <tr>, <th>, <td> for tables
   - <strong> for bold, <em> for italic, <u> for underline
   - <hr> for horizontal rules/separators
   - Use inline styles for alignment (text-align) when needed
3. **Identify template variables** — look for any fields that appear to be fillable, blanks, placeholders, or dynamic values like:
   - Blank lines meant for names, dates, addresses, signatures
   - Fields with labels like "Name: ___", "Date: ___", "Address:", etc.
   - Any placeholder text in brackets like [Customer Name], {date}, etc.
   - Dollar amounts, percentages, or numbers that would change per contract

   For each variable found, provide:
   - key: a snake_case identifier (e.g., "customer_name", "contract_date", "total_amount")
   - label: a human-readable label (e.g., "Customer Name", "Contract Date")
   - type: one of "text", "date", "number", "currency", "textarea", "signature"
   - scope: "template" if it's filled by the company, "client" if filled by the customer/client
   - Replace the placeholder in the HTML with {{variable_key}} syntax

4. **Preserve the document structure** — maintain sections, spacing, and logical flow.

Return your response as a valid JSON object with this exact structure:
{
  "html": "<the full HTML content with {{variable}} placeholders>",
  "variables": [
    {
      "key": "variable_key",
      "label": "Variable Label",
      "type": "text|date|number|currency|textarea|signature",
      "defaultValue": "",
      "required": false,
      "scope": "template|client"
    }
  ],
  "templateName": "Suggested template name based on the document title or content",
  "description": "Brief description of what this document/template is about",
  "category": "General|Agreements|Change Orders|Legal|Warranties"
}`

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: pdfBase64,
              },
            },
            { text: prompt },
          ],
        },
      ],
      config: {
        temperature: 0.1,
        maxOutputTokens: 65535,
        responseMimeType: 'application/json',
      },
    })

    const text = response.text ?? ''

    // With responseMimeType: 'application/json' this should parse cleanly,
    // but keep fallbacks in case the model wraps it in a code block.
    let parsed: any
    try {
      parsed = JSON.parse(text)
    } catch {
      const cleanJson = text
        .replace(/^```(?:json)?\n?/i, '')
        .replace(/\n?```$/i, '')
        .trim()
      try {
        parsed = JSON.parse(cleanJson)
      } catch {
        const braceMatch = cleanJson.match(/\{[\s\S]*\}/)
        if (braceMatch) {
          parsed = JSON.parse(braceMatch[0])
        } else {
          throw new Error('Could not parse AI response as JSON')
        }
      }
    }

    return {
      success: true,
      data: {
        html: parsed.html || '',
        variables: parsed.variables || [],
        templateName:
          parsed.templateName ||
          fileName?.replace(/\.pdf$/i, '') ||
          'Imported Template',
        description: parsed.description || '',
        category: parsed.category || 'General',
      },
    }
  } catch (error: any) {
    console.error('PDF parsing error:', error)
    throw createError({
      statusCode: 500,
      message: `Failed to parse PDF: ${error?.message || 'Unknown error'}`,
    })
  }
})