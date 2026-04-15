// POST /api/contracts/templates/parse-pdf
// Accepts a PDF (base64) and uses Google Vertex AI (Gemini) to extract
// the content as HTML and detect template variables.

import { VertexAI } from '@google-cloud/vertexai'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { pdfBase64, fileName } = body

  if (!pdfBase64) {
    throw createError({ statusCode: 400, message: 'PDF file is required (base64)' })
  }

  const config = useRuntimeConfig()
  const projectId = config.googleCloudProjectId
  const location = config.googleCloudLocation || 'us-central1'
  const clientEmail = config.googleClientEmail
  const privateKey = config.googlePrivateKey

  if (!projectId || !clientEmail || !privateKey) {
    throw createError({ statusCode: 500, message: 'Google Cloud credentials not configured' })
  }

  try {
    // Initialize Vertex AI
    const vertexAI = new VertexAI({
      project: projectId,
      location,
      googleAuthOptions: {
        credentials: {
          client_email: clientEmail,
          private_key: privateKey.replace(/\\n/g, '\n'),
        },
      },
    })

    const model = vertexAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
    })

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

IMPORTANT: Return your response as a valid JSON object with this exact structure:
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
}

Return ONLY the JSON object, no markdown code blocks, no extra text.`

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: pdfBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 65536,
      },
    })

    const response = result.response
    const text = response?.candidates?.[0]?.content?.parts?.[0]?.text || ''

    // Parse the JSON response — handle possible markdown code blocks
    let parsed
    try {
      // Try direct JSON parse first
      parsed = JSON.parse(text)
    } catch {
      // Try to extract JSON from markdown code block
      const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1].trim())
      } else {
        // Try to find JSON object in the text
        const braceMatch = text.match(/\{[\s\S]*\}/)
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
        templateName: parsed.templateName || fileName?.replace('.pdf', '') || 'Imported Template',
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
