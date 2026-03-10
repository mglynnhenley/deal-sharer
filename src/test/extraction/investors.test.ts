import { describe, it, expect } from 'vitest'
import { parseInvestorsFromLLMResponse } from '@/lib/extraction/investors'

describe('parseInvestorsFromLLMResponse', () => {
  it('parses an array of investors from LLM output', () => {
    const llmOutput = JSON.stringify([
      {
        contact_name: 'Sarah',
        fund_name: 'Northzone',
        email: null,
        linkedin_url: 'https://linkedin.com/in/sarah',
        sectors: ['AI/ML', 'Developer Tools'],
        thesis_description: 'Seed/Series A in Europe',
      },
      {
        contact_name: 'John',
        fund_name: 'Acme Ventures',
        email: 'john@acme.vc',
        linkedin_url: null,
        sectors: ['SaaS'],
        thesis_description: 'Early stage B2B SaaS',
      },
    ])

    const result = parseInvestorsFromLLMResponse(llmOutput)
    expect(result).toHaveLength(2)
    expect(result[0].contact_name).toBe('Sarah')
    expect(result[0].linkedin_url).toBe('https://linkedin.com/in/sarah')
    expect(result[0].sectors).toEqual(['AI/ML', 'Developer Tools'])
    expect(result[1].contact_name).toBe('John')
    expect(result[1].email).toBe('john@acme.vc')
  })

  it('handles markdown-wrapped output', () => {
    const llmOutput = '```json\n' + JSON.stringify([
      {
        contact_name: 'Ana',
        fund_name: 'Nauta',
        email: null,
        linkedin_url: null,
        sectors: [],
        thesis_description: null,
      },
    ]) + '\n```'

    const result = parseInvestorsFromLLMResponse(llmOutput)
    expect(result).toHaveLength(1)
    expect(result[0].contact_name).toBe('Ana')
  })

  it('wraps a single object response into an array', () => {
    const llmOutput = JSON.stringify({
      contact_name: 'Solo',
      fund_name: null,
      email: null,
      linkedin_url: null,
      sectors: [],
      thesis_description: null,
    })

    const result = parseInvestorsFromLLMResponse(llmOutput)
    expect(result).toHaveLength(1)
    expect(result[0].contact_name).toBe('Solo')
  })

  it('returns empty array for unparseable output', () => {
    expect(parseInvestorsFromLLMResponse('garbage')).toEqual([])
  })
})
