export type ExtractedInvestor = {
  contact_name: string
  fund_name: string | null
  email: string | null
  linkedin_url: string | null
  sectors: string[]
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
      linkedin_url: parsed.linkedin_url ? String(parsed.linkedin_url) : null,
      sectors: Array.isArray(parsed.sectors) ? parsed.sectors.map(String) : [],
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
- linkedin_url: their LinkedIn profile URL (if mentioned), e.g. "https://linkedin.com/in/username"
- sectors: an array of sector interests inferred from the description (e.g., ["AI/ML", "SaaS", "Climate Tech"]). Use short labels. Empty array if not mentioned.
- thesis_description: a summary of their investment thesis, stage focus, geographic focus, and any other relevant details

Return ONLY a JSON object. No other text.

Example output:
{
  "contact_name": "Sarah",
  "fund_name": "Northzone",
  "email": null,
  "linkedin_url": "https://linkedin.com/in/sarah-northzone",
  "sectors": ["AI/ML", "Developer Tools"],
  "thesis_description": "Seed/Series A in Europe, typical checks 500k-2M"
}`
