'use client'

import { useState } from 'react'
import type { ExtractedDeal } from '@/lib/extraction/deals'

type Props = {
  deal: ExtractedDeal
  onConfirm: (deal: ExtractedDeal & { priority: 1 | 2 | 3 }) => void
  onDiscard: () => void
}

export function DealReviewCard({ deal, onConfirm, onDiscard }: Props) {
  const [companyName, setCompanyName] = useState(deal.company_name)
  const [websiteUrl, setWebsiteUrl] = useState(deal.website_url || '')
  const [oneLiner, setOneLiner] = useState(deal.one_liner || '')
  const [sector, setSector] = useState(deal.sector || '')
  const [raiseAmount, setRaiseAmount] = useState(deal.raise_amount?.toString() || '')
  const [currency, setCurrency] = useState(deal.currency || 'EUR')
  const [priority, setPriority] = useState<1 | 2 | 3>(2)

  function handleConfirm() {
    onConfirm({
      company_name: companyName,
      website_url: websiteUrl || null,
      one_liner: oneLiner || null,
      sector: sector || null,
      raise_amount: raiseAmount ? parseFloat(raiseAmount) : null,
      currency: currency || null,
      priority,
    })
  }

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-white">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium text-gray-700">Company</label>
          <input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full px-2 py-1 border rounded text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700">Website</label>
          <input
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            className="w-full px-2 py-1 border rounded text-sm"
          />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700">One-liner</label>
        <input
          value={oneLiner}
          onChange={(e) => setOneLiner(e.target.value)}
          className="w-full px-2 py-1 border rounded text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium text-gray-700">Sector</label>
          <input
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            className="w-full px-2 py-1 border rounded text-sm"
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-sm font-medium text-gray-700">Raise</label>
          <input
            value={raiseAmount}
            onChange={(e) => setRaiseAmount(e.target.value)}
            type="number"
            className="w-full px-2 py-1 border rounded text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700">Currency</label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full px-2 py-1 border rounded text-sm"
          >
            <option>EUR</option>
            <option>USD</option>
            <option>GBP</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700">Priority</label>
          <select
            value={priority}
            onChange={(e) => setPriority(parseInt(e.target.value) as 1 | 2 | 3)}
            className="w-full px-2 py-1 border rounded text-sm"
          >
            <option value={1}>1 - Top</option>
            <option value={2}>2 - Good</option>
            <option value={3}>3 - Interesting</option>
          </select>
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <button
          onClick={handleConfirm}
          className="px-4 py-1.5 bg-black text-white rounded text-sm hover:bg-gray-800"
        >
          Confirm
        </button>
        <button
          onClick={onDiscard}
          className="px-4 py-1.5 border rounded text-sm hover:bg-gray-50"
        >
          Discard
        </button>
      </div>
    </div>
  )
}
