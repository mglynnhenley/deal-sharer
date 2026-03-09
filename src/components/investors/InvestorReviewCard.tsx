'use client'

import { useState } from 'react'
import type { ExtractedInvestor } from '@/lib/extraction/investors'

type Props = {
  investor: ExtractedInvestor
  onConfirm: (investor: ExtractedInvestor & {
    priority_threshold: 1 | 2 | 3
    sharing_frequency: 'weekly' | 'bi-weekly' | 'monthly'
  }) => void
  onDiscard: () => void
}

export function InvestorReviewCard({ investor, onConfirm, onDiscard }: Props) {
  const [contactName, setContactName] = useState(investor.contact_name)
  const [fundName, setFundName] = useState(investor.fund_name || '')
  const [email, setEmail] = useState(investor.email || '')
  const [thesis, setThesis] = useState(investor.thesis_description || '')
  const [sectors, setSectors] = useState(investor.sectors.join(', '))
  const [threshold, setThreshold] = useState<1 | 2 | 3>(3)
  const [frequency, setFrequency] = useState<'weekly' | 'bi-weekly' | 'monthly'>('weekly')

  function handleConfirm() {
    onConfirm({
      contact_name: contactName,
      fund_name: fundName || null,
      email: email || null,
      sectors: sectors ? sectors.split(',').map((s) => s.trim()).filter(Boolean) : [],
      thesis_description: thesis || null,
      priority_threshold: threshold,
      sharing_frequency: frequency,
    })
  }

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-white">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium text-gray-700">Contact Name</label>
          <input value={contactName} onChange={(e) => setContactName(e.target.value)}
                 className="w-full px-2 py-1 border rounded text-sm" />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700">Fund</label>
          <input value={fundName} onChange={(e) => setFundName(e.target.value)}
                 className="w-full px-2 py-1 border rounded text-sm" />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700">Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email"
               className="w-full px-2 py-1 border rounded text-sm" />
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700">Sectors</label>
        <input value={sectors} onChange={(e) => setSectors(e.target.value)}
               placeholder="e.g. AI/ML, SaaS, Climate Tech"
               className="w-full px-2 py-1 border rounded text-sm" />
        <p className="text-xs text-gray-400 mt-0.5">Comma-separated, optional</p>
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700">Thesis / Notes</label>
        <textarea value={thesis} onChange={(e) => setThesis(e.target.value)} rows={2}
                  className="w-full px-2 py-1 border rounded text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium text-gray-700">Send deals rated</label>
          <select value={threshold} onChange={(e) => setThreshold(parseInt(e.target.value) as 1 | 2 | 3)}
                  className="w-full px-2 py-1 border rounded text-sm">
            <option value={1}>1 only (top deals)</option>
            <option value={2}>1-2 (top + good)</option>
            <option value={3}>1-3 (everything)</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700">Sharing frequency</label>
          <select value={frequency} onChange={(e) => setFrequency(e.target.value as 'weekly' | 'bi-weekly' | 'monthly')}
                  className="w-full px-2 py-1 border rounded text-sm">
            <option value="weekly">Weekly</option>
            <option value="bi-weekly">Bi-weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <button onClick={handleConfirm}
                className="px-4 py-1.5 bg-black text-white rounded text-sm hover:bg-gray-800">
          Confirm
        </button>
        <button onClick={onDiscard}
                className="px-4 py-1.5 border rounded text-sm hover:bg-gray-50">
          Discard
        </button>
      </div>
    </div>
  )
}
