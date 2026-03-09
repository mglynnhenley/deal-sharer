export type ExtractedInvestor = {
  contact_name: string
  fund_name: string | null
  email: string | null
  thesis_description: string | null
}

export function parseInvestorFromLLMResponse(output: string): ExtractedInvestor | null {
  let cleaned = output.trim()
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim()
  }

  try {
    const parsed = JSON.parse(cleaned)
    if (!parsed.contact_name) return null
    return {
      contact_name: String(parsed.contact_name),
      fund_name: parsed.fund_name ? String(parsed.fund_name) : null,
      email: parsed.email ? String(parsed.email) : null,
      thesis_description: parsed.thesis_description ? String(parsed.thesis_description) : null,
    }
  } catch {
    return null
  }
}

export const INVESTOR_EXTRACTION_PROMPT = `You are an investor profile extraction assistant. Given a natural language description of an investor, extract their details into a structured JSON object.

Extract:
- contact_name: the person's name
- fund_name: the fund or firm name (if mentioned)
- email: their email address (if mentioned)
- thesis_description: a summary of their investment thesis, stage focus, sector focus, geographic focus, and any other relevant details

Return ONLY a JSON object. No other text.

Example output:
{
  "contact_name": "Sarah",
  "fund_name": "Northzone",
  "email": null,
  "thesis_description": "Seed/Series A in Europe, focus on developer tools and AI infrastructure, typical checks 500k-2M"
}`
