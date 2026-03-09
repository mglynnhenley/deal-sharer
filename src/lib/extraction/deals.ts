export type ExtractedDeal = {
  company_name: string
  website_url: string | null
  one_liner: string | null
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
      one_liner: d.one_liner ? String(d.one_liner) : null,
      raise_amount: typeof d.raise_amount === 'number' ? d.raise_amount : null,
      currency: d.currency ? String(d.currency) : null,
    }))
  } catch {
    return []
  }
}

export const DEAL_EXTRACTION_PROMPT = `You are a deal extraction assistant. Given unstructured text about investment deals, extract each deal into a structured JSON array.

For each deal, extract:
- company_name: the company name
- website_url: the company website URL (if mentioned)
- one_liner: a concise one-line description of what the company does
- raise_amount: the amount being raised as a number (e.g., 4000000 for 4M), or null if not mentioned
- currency: the currency (EUR, USD, GBP, etc.), or null if not mentioned

Return ONLY a JSON array of objects. No other text.

Example output:
[
  {
    "company_name": "ExampleCo",
    "website_url": "https://example.com",
    "one_liner": "AI-powered widget maker",
    "raise_amount": 5000000,
    "currency": "EUR"
  }
]`
