'use client'

import { useState } from 'react'
import { saveDeals } from '@/app/deals/actions'
import { VoiceRecorder } from '@/components/VoiceRecorder'

export function DealInput() {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleExtract() {
    if (!text.trim()) return
    setLoading(true)
    setMessage(null)

    try {
      const res = await fetch('/api/extract-deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      if (!data.deals || data.deals.length === 0) {
        setMessage({ type: 'error', text: 'No deals found in that text.' })
        return
      }

      const dealsToSave = data.deals.map((d: Record<string, unknown>) => ({
        company_name: d.company_name,
        website_url: d.website_url || null,
        linkedin_url: d.linkedin_url || null,
        one_liner: d.one_liner || null,
        sector: d.sector || null,
        raise_amount: d.raise_amount || null,
        currency: d.currency || 'EUR',
        priority: 3,
        status: 'active' as const,
        raw_source_text: text,
      }))

      const result = await saveDeals(dealsToSave)
      if (result.error) throw new Error(result.error)

      const parts: string[] = []
      if (result.added) parts.push(`${result.added} new`)
      if (result.linked) parts.push(`${result.linked} matched existing`)
      setMessage({ type: 'success', text: parts.join(', ') || 'Deals processed' })
      setText('')
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Extraction failed' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste deal info here — transcripts, emails, notes..."
        rows={4}
        className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-accent/20 placeholder:text-secondary"
      />
      <div className="flex items-center gap-2">
        <button
          onClick={handleExtract}
          disabled={loading || !text.trim()}
          className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 disabled:opacity-40"
        >
          {loading ? 'Extracting...' : 'Extract Deals'}
        </button>
        <VoiceRecorder onTranscript={(t) => setText((prev) => (prev ? prev + '\n' + t : t))} />
      </div>
      {message && (
        <p className={`text-sm ${message.type === 'success' ? 'text-emerald-600' : 'text-accent'}`}>
          {message.text}
        </p>
      )}
    </div>
  )
}
