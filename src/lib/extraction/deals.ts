import { DEAL_STAGES, DEAL_SECTORS } from '@/lib/supabase/types'

export type ExtractedDeal = {
  company_name: string
  website_url: string | null
  linkedin_url: string | null
  one_liner: string | null
  sectors: string[]
  stage: string | null
  raise_amount: number | null
  currency: string | null
}

export function parseDealsFromLLMResponse(output: string): ExtractedDeal[] {
  // Strip markdown code fences if present
  let cleaned = output.trim()
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim()
  }

  try {
    const parsed = JSON.parse(cleaned)
    if (!Array.isArray(parsed)) return []
    return parsed.map((d: Record<string, unknown>) => ({
      company_name: String(d.company_name || ''),
      website_url: d.website_url ? String(d.website_url) : null,
      linkedin_url: d.linkedin_url ? String(d.linkedin_url) : null,
      one_liner: d.one_liner ? String(d.one_liner) : null,
      sectors: Array.isArray(d.sectors)
        ? d.sectors.map(String).filter((s) => (DEAL_SECTORS as readonly string[]).includes(s))
        : d.sector && (DEAL_SECTORS as readonly string[]).includes(String(d.sector))
          ? [String(d.sector)]
          : [],
      stage:
        typeof d.stage === 'string' && (DEAL_STAGES as readonly string[]).includes(d.stage)
          ? d.stage
          : null,
      raise_amount: typeof d.raise_amount === 'number' ? d.raise_amount : null,
      currency: d.currency ? String(d.currency) : null,
    }))
  } catch {
    return []
  }
}

export const DEAL_EXTRACTION_PROMPT = `You are a deal extraction assistant. Given unstructured text about investment deals, extract each deal into a structured JSON array.

For each deal, extract:
- company_name: the company name. If no company name is given, use the founder/CEO name instead.
- website_url: the company website URL (if mentioned). If no website is given but a LinkedIn company page or founder profile URL is available, put that here instead.
- linkedin_url: a LinkedIn profile URL for the founder/CEO (if mentioned). Can be null if not available.
- one_liner: a sharp, VC-style one-liner. Lead with what the company actually builds or does in plain language (no buzzwords). Then add the most useful context: geography, traction metrics, founder pedigree (e.g. "ex-Stripe", "2x founder"), raise size, or notable investors — but only what's mentioned. Aim for the kind of line a partner would skim in a deal memo. Examples: "Builds real-time carbon accounting for supply chains. Berlin, raising €4M seed. CEO ex-McKinsey.", "Mobile bank for gig workers in LatAm. 50K MAU, $2M ARR run-rate."
- sectors: an array of applicable industry sectors. Valid values: "AI/ML", "SaaS", "Fintech", "Climate Tech", "Healthcare", "Biotech", "Robotics", "Deep Tech", "Defence", "Cybersecurity", "Energy", "AgTech", "Consumer", "Marketplace", "Developer Tools", "EdTech", "PropTech". Use ONLY these exact values. Infer from the description.
- stage: the investment stage, one of: "pre-seed", "seed", "series-a", "series-b", "series-c", "growth". Infer from context: <500K is likely pre-seed, 500K-3M is likely pre-seed/seed, 3M-8M is likely seed, 8M-20M is likely series-a, 20M-50M is likely series-b, 50M+ is likely series-c or growth. Use null if not determinable.
- raise_amount: the amount being raised as a number (e.g., 4000000 for 4M), or null if not mentioned
- currency: the currency (EUR, USD, GBP, etc.), or null if not mentioned

Return ONLY a JSON array of objects. No other text.

Example output:
[
  {
    "company_name": "ExampleCo",
    "website_url": "https://example.com",
    "linkedin_url": "https://linkedin.com/in/johndoe",
    "one_liner": "Berlin-based AI-powered widget maker, raising 5M EUR. Serial founder, ex-Google.",
    "sectors": ["AI/ML", "SaaS"],
    "stage": "seed",
    "raise_amount": 5000000,
    "currency": "EUR"
  }
]`
