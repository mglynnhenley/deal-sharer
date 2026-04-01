import { describe, it, expect } from 'vitest'
import { parseDealsFromLLMResponse } from '@/lib/extraction/deals'

describe('parseDealsFromLLMResponse', () => {
  it('parses a JSON array of deals from LLM output', () => {
    const llmOutput = JSON.stringify([
      {
        company_name: 'Jaipur Robotics',
        website_url: 'https://jaipurrobotics.com/',
        one_liner: 'AI detection of hazardous materials in mixed waste',
        sector: 'Climate Tech',
        raise_amount: 4000000,
        currency: 'EUR',
      },
      {
        company_name: 'Polybot',
        website_url: 'https://polybot.eu/',
        one_liner: 'Greenhouse crop harvesting robotics',
        sector: 'AgTech',
        raise_amount: 4000000,
        currency: 'EUR',
      },
    ])

    const result = parseDealsFromLLMResponse(llmOutput)
    expect(result).toHaveLength(2)
    expect(result[0].company_name).toBe('Jaipur Robotics')
    expect(result[0].raise_amount).toBe(4000000)
    expect(result[0].sectors).toEqual(['Climate Tech'])
    expect(result[1].company_name).toBe('Polybot')
    expect(result[1].sectors).toEqual(['AgTech'])
  })

  it('filters out sectors not in DEAL_SECTORS', () => {
    const llmOutput = JSON.stringify([
      {
        company_name: 'TestCo',
        sectors: ['AI/ML', 'Made Up Sector', 'SaaS'],
      },
    ])
    const result = parseDealsFromLLMResponse(llmOutput)
    expect(result[0].sectors).toEqual(['AI/ML', 'SaaS'])
  })

  it('handles LLM output wrapped in markdown code block', () => {
    const llmOutput = '```json\n' + JSON.stringify([
      {
        company_name: 'Nerva AI',
        website_url: 'http://nerva-ai.com/',
        one_liner: 'Energy optimization for datacenters',
        sector: 'Energy',
        raise_amount: null,
        currency: null,
      },
    ]) + '\n```'

    const result = parseDealsFromLLMResponse(llmOutput)
    expect(result).toHaveLength(1)
    expect(result[0].company_name).toBe('Nerva AI')
  })

  it('returns empty array for unparseable output', () => {
    const result = parseDealsFromLLMResponse('not valid json at all')
    expect(result).toEqual([])
  })
})
