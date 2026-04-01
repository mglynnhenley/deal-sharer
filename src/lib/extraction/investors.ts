import { DEAL_STAGES, DEAL_SECTORS } from '@/lib/supabase/types'

export type ExtractedInvestor = {
  contact_name: string
  fund_name: string | null
  email: string | null
  phone: string | null
  linkedin_url: string | null
  sectors: string[]
  stages: string[]
  thesis_description: string | null
}

export function parseInvestorsFromLLMResponse(output: string): ExtractedInvestor[] {
  let cleaned = output.trim()
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim()
  }

  try {
    const parsed = JSON.parse(cleaned)
    const items = Array.isArray(parsed) ? parsed : [parsed]
    return items
      .filter((p: Record<string, unknown>) => p.contact_name)
      .map((p: Record<string, unknown>) => ({
        contact_name: String(p.contact_name),
        fund_name: p.fund_name ? String(p.fund_name) : null,
        email: p.email ? String(p.email) : null,
        phone: p.phone ? String(p.phone) : null,
        linkedin_url: p.linkedin_url ? String(p.linkedin_url) : null,
        sectors: Array.isArray(p.sectors) ? p.sectors.map(String).filter((s) => (DEAL_SECTORS as readonly string[]).includes(s)) : [],
        stages: Array.isArray(p.stages)
          ? p.stages.map(String).filter((s) => (DEAL_STAGES as readonly string[]).includes(s))
          : [],
        thesis_description: p.thesis_description ? String(p.thesis_description) : null,
      }))
  } catch {
    return []
  }
}

export const INVESTOR_EXTRACTION_PROMPT = `You are an investor profile extraction assistant. Given a natural language description of one or more investors, extract each investor's details into a structured JSON array.

For each investor, extract:
- contact_name: the person's name
- fund_name: the fund or firm name (if mentioned)
- email: their email address (if mentioned)
- phone: their phone number (if mentioned)
- linkedin_url: their LinkedIn profile URL (if mentioned)
- sectors: an array of sector interests. Valid values: "AI/ML", "SaaS", "Fintech", "Climate Tech", "Healthcare", "Biotech", "Robotics", "Deep Tech", "Defence", "Cybersecurity", "Energy", "AgTech", "Consumer", "Marketplace", "Developer Tools", "EdTech", "PropTech". Use ONLY these exact values. Empty array if not mentioned.
- stages: an array of investment stages they focus on. Valid values: "pre-seed", "seed", "series-a", "series-b", "series-c", "growth". Infer from context: "early stage" means ["pre-seed", "seed"], "growth" means ["series-b", "series-c", "growth"], "seed to series A" means ["seed", "series-a"]. Empty array if not mentioned or unclear.
- thesis_description: a summary of their investment thesis (if mentioned)

Return ONLY a JSON array of objects. No other text.

Example output:
[
  {
    "contact_name": "Sarah",
    "fund_name": "Northzone",
    "email": null,
    "phone": null,
    "linkedin_url": null,
    "sectors": ["AI/ML", "Developer Tools"],
    "stages": ["seed", "series-a"],
    "thesis_description": "Seed/Series A in Europe, focused on dev tools and AI"
  }
]`
