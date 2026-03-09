'use client'

import { useState } from 'react'
import type { ExtractedInvestor } from '@/lib/extraction/investors'
import { InvestorReviewCard } from './InvestorReviewCard'
import { saveInvestor } from '@/app/investors/actions'

export function InvestorInput() {
  const [text, setText] = useState('')
  const [extracted, setExtracted] = useState<ExtractedInvestor | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleExtract() {
    if (!text.trim()) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/extract-investor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setExtracted(data.investor)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Extraction failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirm(investor: ExtractedInvestor & {
    priority_threshold: 1 | 2 | 3
    sharing_frequency: 'weekly' | 'bi-weekly' | 'monthly'
  }) {
    const result = await saveInvestor({
      contact_name: investor.contact_name,
      fund_name: investor.fund_name,
      email: investor.email,
      sectors: investor.sectors,
      priority_threshold: investor.priority_threshold,
      sharing_frequency: investor.sharing_frequency,
      thesis_description: investor.thesis_description,
      raw_source_text: text,
    })
    if (result.error) {
      setError(result.error)
      return
    }
    setExtracted(null)
    setText('')
  }

  return (
    <div className="space-y-4">
      <div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Describe an investor... e.g. 'Sarah at Northzone, they do seed in Europe, focus on dev tools'"
          rows={3}
          className="w-full px-3 py-2 border rounded-md text-sm"
        />
        <button
          onClick={handleExtract}
          disabled={loading || !text.trim()}
          className="mt-2 px-4 py-2 bg-black text-white rounded-md text-sm hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? 'Extracting...' : 'Extract Investor'}
        </button>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {extracted && (
        <InvestorReviewCard
          investor={extracted}
          onConfirm={handleConfirm}
          onDiscard={() => setExtracted(null)}
        />
      )}
    </div>
  )
}
