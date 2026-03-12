/**
 * Deal deduplication utilities.
 * Matches on: website_url → linkedin_url → fuzzy company name.
 */

function normalizeUrl(url: string): string {
  return url
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '')
    .trim()
}

function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(
      /\b(inc|ltd|llc|gmbh|ag|sa|sas|srl|co|corp|corporation|limited|pvt|pty|plc|the)\b\.?/g,
      '',
    )
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function diceCoefficient(a: string, b: string): number {
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0
  const bigrams = (s: string) => {
    const map = new Map<string, number>()
    for (let i = 0; i < s.length - 1; i++) {
      const bg = s.slice(i, i + 2)
      map.set(bg, (map.get(bg) || 0) + 1)
    }
    return map
  }
  const aBg = bigrams(a)
  const bBg = bigrams(b)
  let intersection = 0
  for (const [bg, count] of aBg) {
    intersection += Math.min(count, bBg.get(bg) || 0)
  }
  return (2 * intersection) / (a.length - 1 + b.length - 1)
}

export type ExistingDeal = {
  id: string
  company_name: string
  website_url: string | null
  linkedin_url: string | null
}

/**
 * Find a matching deal using cascading strategy:
 * 1. Exact match on normalized website_url
 * 2. Exact match on normalized linkedin_url
 * 3. Fuzzy match on company_name (Dice coefficient > 0.6)
 */
export function findMatchingDeal(
  deal: { company_name: string; website_url: string | null; linkedin_url: string | null },
  existing: ExistingDeal[],
): string | null {
  // 1. Match on website_url
  if (deal.website_url) {
    const normalized = normalizeUrl(deal.website_url)
    const match = existing.find(
      (e) => e.website_url && normalizeUrl(e.website_url) === normalized,
    )
    if (match) return match.id
  }

  // 2. Match on linkedin_url
  if (deal.linkedin_url) {
    const normalized = normalizeUrl(deal.linkedin_url)
    const match = existing.find(
      (e) => e.linkedin_url && normalizeUrl(e.linkedin_url) === normalized,
    )
    if (match) return match.id
  }

  // 3. Fuzzy match on company_name
  const normalizedName = normalizeCompanyName(deal.company_name)
  if (!normalizedName) return null

  let bestMatch: { id: string; score: number } | null = null
  for (const e of existing) {
    const eName = normalizeCompanyName(e.company_name)
    if (!eName) continue

    // Exact normalized match
    if (normalizedName === eName) return e.id

    // Substring match (one contains the other)
    if (normalizedName.includes(eName) || eName.includes(normalizedName)) return e.id

    // Dice coefficient
    const score = diceCoefficient(normalizedName, eName)
    if (score > 0.6 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { id: e.id, score }
    }
  }

  return bestMatch?.id ?? null
}
