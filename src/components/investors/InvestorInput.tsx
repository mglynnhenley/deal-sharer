'use client'

import { useState } from 'react'
import { saveInvestors } from '@/app/investors/actions'

export function InvestorInput() {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleExtract() {
    if (!text.trim()) return
    setLoading(true)
    setMessage(null)

    try {
      const res = await fetch('/api/extract-investor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      if (!data.investors || data.investors.length === 0) {
        setMessage({ type: 'error', text: 'No investors found in that text.' })
        return
      }

      const investorsToSave = data.investors.map((inv: Record<string, unknown>) => ({
        contact_name: inv.contact_name,
        fund_name: inv.fund_name || null,
        email: inv.email || null,
        phone: inv.phone || null,
        linkedin_url: inv.linkedin_url || null,
        sectors: Array.isArray(inv.sectors) ? inv.sectors : [],
        thesis_description: inv.thesis_description || null,
        priority_threshold: 3 as const,
        sharing_frequency: 'weekly' as const,
        raw_source_text: text,
      }))

      const result = await saveInvestors(investorsToSave)
      if (result.error) throw new Error(result.error)

      setMessage({
        type: 'success',
        text: `${investorsToSave.length} investor${investorsToSave.length > 1 ? 's' : ''} added`,
      })
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
        placeholder="Describe investors... e.g. 'Ana @ Nauta, Bodi @ Heartcore, Oskar @ Project A'"
        rows={4}
        className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-accent/20 placeholder:text-secondary"
      />
      <button
        onClick={handleExtract}
        disabled={loading || !text.trim()}
        className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 disabled:opacity-40"
      >
        {loading ? 'Extracting...' : 'Extract Investors'}
      </button>
      {message && (
        <p className={`text-sm ${message.type === 'success' ? 'text-emerald-600' : 'text-accent'}`}>
          {message.text}
        </p>
      )}
    </div>
  )
}
