'use client'

import { useState, useEffect, useMemo } from 'react'
import type { Deal, Investor } from '@/lib/supabase/types'
import { saveShareRecords, getSharedDealIds } from '@/app/share/actions'

type Props = {
  investors: Investor[]
  deals: Deal[]
  lastSharedDates: Record<string, string>
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function ShareListBuilder({ investors, deals, lastSharedDates }: Props) {
  const [selectedInvestorId, setSelectedInvestorId] = useState<string | null>(
    investors[0]?.id || null,
  )
  const [selectedDealIds, setSelectedDealIds] = useState<Set<string>>(new Set())
  const [alreadySharedIds, setAlreadySharedIds] = useState<Set<string>>(new Set())
  const [output, setOutput] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [sharedDates, setSharedDates] = useState(lastSharedDates)
  const [investorSearch, setInvestorSearch] = useState('')

  const selectedInvestor = investors.find((i) => i.id === selectedInvestorId)

  const filteredInvestors = useMemo(() => {
    if (!investorSearch.trim()) return investors
    const q = investorSearch.toLowerCase()
    return investors.filter(
      (inv) =>
        inv.contact_name.toLowerCase().includes(q) ||
        (inv.fund_name?.toLowerCase().includes(q) ?? false) ||
        (inv.email?.toLowerCase().includes(q) ?? false),
    )
  }, [investors, investorSearch])

  const eligibleDeals = selectedInvestor
    ? deals.filter((d) => d.priority <= selectedInvestor.priority_threshold && d.status === 'active')
    : []

  useEffect(() => {
    if (!selectedInvestorId) return
    getSharedDealIds(selectedInvestorId).then((ids) => setAlreadySharedIds(new Set(ids)))
    setSelectedDealIds(new Set())
    setOutput(null)
  }, [selectedInvestorId])

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
    const result = await saveShareRecords(selectedInvestorId, Array.from(selectedDealIds), batchId)

    if (result.error) {
      alert(result.error)
      setSaving(false)
      return
    }

    const selectedDeals = deals.filter((d) => selectedDealIds.has(d.id))
    const lines = selectedDeals.map((d) => {
      const links = [d.website_url, d.linkedin_url].filter(Boolean).join(', ')
      const parts: string[] = [d.company_name]
      if (d.one_liner) parts.push(`- ${d.one_liner}`)
      if (links) parts.push(`(${links})`)
      return parts.join(' ')
    })
    setOutput(`Some deals I've been looking at!\n\n${lines.join('\n\n')}`)

    setAlreadySharedIds((prev) => {
      const next = new Set(prev)
      selectedDealIds.forEach((id) => next.add(id))
      return next
    })
    setSharedDates((prev) => ({ ...prev, [selectedInvestorId]: new Date().toISOString() }))
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
      <div className="w-60 shrink-0 space-y-2">
        <input
          type="text"
          value={investorSearch}
          onChange={(e) => setInvestorSearch(e.target.value)}
          placeholder="Search investors..."
          className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-accent/20 placeholder:text-secondary"
        />
        <div className="space-y-0.5 max-h-[60vh] overflow-y-auto">
          {filteredInvestors.length === 0 ? (
            <p className="text-secondary text-xs px-3 py-2">No match</p>
          ) : (
            filteredInvestors.map((inv) => {
              const active = inv.id === selectedInvestorId
              return (
                <button
                  key={inv.id}
                  onClick={() => setSelectedInvestorId(inv.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
                    active
                      ? 'bg-accent text-white'
                      : 'hover:bg-muted text-foreground'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate">
                      {inv.contact_name}
                      {inv.fund_name && (
                        <span className={`text-xs ml-1 ${active ? 'opacity-70' : 'text-secondary'}`}>
                          @ {inv.fund_name}
                        </span>
                      )}
                    </span>
                    {sharedDates[inv.id] && (
                      <span className={`text-xs shrink-0 ${active ? 'opacity-70' : 'text-secondary'}`}>
                        {formatDate(sharedDates[inv.id])}
                      </span>
                    )}
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Deal list */}
      <div className="flex-1 space-y-4">
        {selectedInvestor && (
          <>
            <p className="text-sm text-secondary">
              Showing P1{selectedInvestor.priority_threshold > 1 ? `–${selectedInvestor.priority_threshold}` : ''} for{' '}
              <span className="font-medium text-foreground">{selectedInvestor.contact_name}</span>
            </p>

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
                      className={`flex items-start gap-3 border rounded-lg p-3 cursor-pointer ${
                        shared
                          ? 'opacity-50 bg-muted border-border'
                          : selected
                            ? 'bg-accent-light border-accent/20'
                            : 'bg-surface border-border'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleDeal(deal.id)}
                        className="mt-1 accent-accent"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-foreground">{deal.company_name}</span>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-secondary">P{deal.priority}</span>
                          {shared && <span className="text-xs text-amber-600">Previously shared</span>}
                        </div>
                        {deal.one_liner && <p className="text-sm text-secondary mt-0.5">{deal.one_liner}</p>}
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
                className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 disabled:opacity-40"
              >
                {saving ? 'Saving...' : `Finalise (${selectedDealIds.size} deals)`}
              </button>
            )}

            {output && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-foreground">Share list ready</h3>
                <textarea
                  value={output}
                  onChange={(e) => setOutput(e.target.value)}
                  rows={Math.max(5, output.split('\n').length + 1)}
                  className="w-full bg-muted border border-border rounded-lg p-4 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
                <div className="flex items-center gap-2">
                  <button onClick={copyToClipboard}
                    className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted">
                    Copy to clipboard
                  </button>
                  {selectedInvestor?.phone && (
                    <a
                      href={`https://api.whatsapp.com/send?phone=${selectedInvestor.phone.replace(/[^0-9]/g, '')}&text=${encodeURIComponent(output)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">
                      Send via WhatsApp
                    </a>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
