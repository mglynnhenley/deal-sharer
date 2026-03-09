import { describe, it, expect } from 'vitest'
import { parseInvestorFromLLMResponse } from '@/lib/extraction/investors'

describe('parseInvestorFromLLMResponse', () => {
  it('parses investor details from LLM output', () => {
    const llmOutput = JSON.stringify({
      contact_name: 'Sarah',
      fund_name: 'Northzone',
      email: null,
      linkedin_url: 'https://linkedin.com/in/sarah',
      sectors: ['AI/ML', 'Developer Tools'],
      thesis_description: 'Seed/Series A in Europe',
    })

    const result = parseInvestorFromLLMResponse(llmOutput)
    expect(result).not.toBeNull()
    expect(result!.contact_name).toBe('Sarah')
    expect(result!.fund_name).toBe('Northzone')
    expect(result!.linkedin_url).toBe('https://linkedin.com/in/sarah')
    expect(result!.sectors).toEqual(['AI/ML', 'Developer Tools'])
  })

  it('handles markdown-wrapped output', () => {
    const llmOutput = '```json\n' + JSON.stringify({
      contact_name: 'John',
      fund_name: 'Acme Ventures',
      email: 'john@acme.vc',
      linkedin_url: null,
      sectors: ['SaaS'],
      thesis_description: 'Early stage B2B SaaS',
    }) + '\n```'

    const result = parseInvestorFromLLMResponse(llmOutput)
    expect(result).not.toBeNull()
    expect(result!.email).toBe('john@acme.vc')
  })

  it('returns null for unparseable output', () => {
    expect(parseInvestorFromLLMResponse('garbage')).toBeNull()
  })
})
