'use client'

import { useState, useEffect } from 'react'
import type { Deal, Investor } from '@/lib/supabase/types'
import { saveShareRecords, getSharedDealIds } from '@/app/share/actions'

type Props = {
  investors: Investor[]
  deals: Deal[]
}

export function ShareListBuilder({ investors, deals }: Props) {
  const [selectedInvestorId, setSelectedInvestorId] = useState<string | null>(
    investors[0]?.id || null
  )
  const [selectedDealIds, setSelectedDealIds] = useState<Set<string>>(new Set())
  const [alreadySharedIds, setAlreadySharedIds] = useState<Set<string>>(new Set())
  const [output, setOutput] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const selectedInvestor = investors.find((i) => i.id === selectedInvestorId)

  // Filter deals by investor priority threshold
  const eligibleDeals = selectedInvestor
    ? deals.filter((d) => d.priority <= selectedInvestor.priority_threshold && d.status === 'active')
    : []

  useEffect(() => {
    if (!selectedInvestorId) return
    getSharedDealIds(selectedInvestorId).then((ids) => {
      setAlreadySharedIds(new Set(ids))
    })
    setSelectedDealIds(new Set())
    setOutput(null)
  }, [selectedInvestorId])

  // Auto-select eligible deals that haven't been shared yet
  useEffect(() => {
    const unshared = eligibleDeals.filter((d) => !alreadySharedIds.has(d.id))
    setSelectedDealIds(new Set(unshared.map((d) => d.id)))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alreadySharedIds, selectedInvestorId])

  function toggleDeal(dealId: string) {
    setSelectedDealIds((prev) => {
      const next = new Set(prev)
      if (next.has(dealId)) next.delete(dealId)
      else next.add(dealId)
      return next
    })
  }

  async function handleFinalise() {
    if (!selectedInvestorId || selectedDealIds.size === 0) return
    setSaving(true)

    const batchId = crypto.randomUUID()
    const result = await saveShareRecords(
      selectedInvestorId,
      Array.from(selectedDealIds),
      batchId
    )

    if (result.error) {
      alert(result.error)
      setSaving(false)
      return
    }

    // Generate shareable text
    const selectedDeals = deals.filter((d) => selectedDealIds.has(d.id))
    const lines = selectedDeals.map((d) => {
      const url = d.website_url || d.company_name
      const desc = d.one_liner ? ` - ${d.one_liner}` : ''
      return `${url}${desc}`
    })
    setOutput(`Some deals I've been looking at!\n\n${lines.join('\n')}`)

    // Update shared set
    setAlreadySharedIds((prev) => {
      const next = new Set(prev)
      selectedDealIds.forEach((id) => next.add(id))
      return next
    })
    setSelectedDealIds(new Set())
    setSaving(false)
  }

  function copyToClipboard() {
    if (output) navigator.clipboard.writeText(output)
  }

  if (investors.length === 0) {
    return <p className="text-secondary text-sm">Add some investors first.</p>
  }

  return (
    <div className="flex gap-6">
      {/* Investor sidebar */}
      <div className="w-56 shrink-0 space-y-1">
        <h3 className="text-sm font-medium text-secondary mb-2">Investors</h3>
        {investors.map((inv) => (
          <button
            key={inv.id}
            onClick={() => setSelectedInvestorId(inv.id)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
              inv.id === selectedInvestorId
                ? 'bg-foreground text-background'
                : 'hover:bg-black/5'
            }`}
          >
            {inv.contact_name}
            {inv.fund_name && <span className="text-xs opacity-70 ml-1">@ {inv.fund_name}</span>}
          </button>
        ))}
      </div>

      {/* Deal list */}
      <div className="flex-1 space-y-4">
        {selectedInvestor && (
          <>
            <div className="text-sm text-secondary">
              Showing deals P1{selectedInvestor.priority_threshold > 1 ? `-${selectedInvestor.priority_threshold}` : ''} for {selectedInvestor.contact_name}
            </div>

            {eligibleDeals.length === 0 ? (
              <p className="text-secondary text-sm">No deals match this investor&apos;s threshold.</p>
            ) : (
              <div className="space-y-2">
                {eligibleDeals.map((deal) => {
                  const shared = alreadySharedIds.has(deal.id)
                  const selected = selectedDealIds.has(deal.id)
                  return (
                    <label
                      key={deal.id}
                      className={`flex items-start gap-3 border border-border rounded-lg p-3 cursor-pointer ${
                        shared ? 'opacity-50 bg-background' : 'bg-surface'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleDeal(deal.id)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-foreground">{deal.company_name}</span>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-black/5 text-foreground">P{deal.priority}</span>
                          {shared && <span className="text-xs text-orange-600">Previously shared</span>}
                        </div>
                        {deal.one_liner && (
                          <p className="text-sm text-secondary">{deal.one_liner}</p>
                        )}
                      </div>
                    </label>
                  )
                })}
              </div>
            )}

            {!output && eligibleDeals.length > 0 && (
              <button
                onClick={handleFinalise}
                disabled={saving || selectedDealIds.size === 0}
                className="px-4 py-2 bg-foreground text-background rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40"
              >
                {saving ? 'Saving...' : `Finalise (${selectedDealIds.size} deals)`}
              </button>
            )}

            {output && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-secondary">Share list ready:</h3>
                <pre className="bg-background border border-border rounded-lg p-4 text-sm whitespace-pre-wrap">{output}</pre>
                <button
                  onClick={copyToClipboard}
                  className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-black/5"
                >
                  Copy to clipboard
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
