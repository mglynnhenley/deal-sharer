'use client'

import { useState } from 'react'
import type { ExtractedDeal } from '@/lib/extraction/deals'
import { DealReviewCard } from './DealReviewCard'
import { saveDeal } from '@/app/deals/actions'
import { VoiceRecorder } from './VoiceRecorder'

export function DealInput() {
  const [text, setText] = useState('')
  const [extractedDeals, setExtractedDeals] = useState<ExtractedDeal[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleExtract() {
    if (!text.trim()) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/extract-deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setExtractedDeals(data.deals)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Extraction failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirm(deal: ExtractedDeal & { priority: 1 | 2 | 3 }) {
    const result = await saveDeal({
      company_name: deal.company_name,
      website_url: deal.website_url,
      one_liner: deal.one_liner,
      sector: deal.sector,
      raise_amount: deal.raise_amount,
      currency: deal.currency,
      priority: deal.priority,
      status: 'active',
      raw_source_text: text,
    })
    if (result.error) {
      setError(result.error)
      return
    }
    setExtractedDeals((prev) => prev.filter((d) => d.company_name !== deal.company_name))
  }

  function handleDiscard(companyName: string) {
    setExtractedDeals((prev) => prev.filter((d) => d.company_name !== companyName))
  }

  return (
    <div className="space-y-4">
      <div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste deal info here - transcripts, emails, notes..."
          rows={6}
          className="w-full px-3 py-2 border rounded-md text-sm"
        />
        <div className="flex gap-2 mt-2">
          <button
            onClick={handleExtract}
            disabled={loading || !text.trim()}
            className="px-4 py-2 bg-black text-white rounded-md text-sm hover:bg-gray-800 disabled:opacity-50"
          >
            {loading ? 'Extracting...' : 'Extract Deals'}
          </button>
          <VoiceRecorder onTranscript={(t) => setText((prev) => prev ? prev + '\n' + t : t)} />
        </div>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {extractedDeals.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium text-sm text-gray-600">
            {extractedDeals.length} deal(s) extracted - review and confirm:
          </h3>
          {extractedDeals.map((deal) => (
            <DealReviewCard
              key={deal.company_name}
              deal={deal}
              onConfirm={handleConfirm}
              onDiscard={() => handleDiscard(deal.company_name)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
