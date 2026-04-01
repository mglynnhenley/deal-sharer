'use client'

import { useState, useEffect, useMemo } from 'react'
import type { Deal, Investor } from '@/lib/supabase/types'
import { DEAL_STAGES, DEAL_SECTORS } from '@/lib/supabase/types'
import { MultiSelectDropdown } from '@/components/MultiSelectDropdown'
import { saveShareRecords, getSharedDealIdsForInvestors } from '@/app/share/actions'

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

function formatStage(stage: string): string {
  return stage.replace('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function hasSectorOverlap(deal: Deal, investor: Investor): boolean {
  if (!investor.sectors.length || !deal.sectors.length) return true
  return deal.sectors.some((s) => investor.sectors.includes(s))
}

function hasStageMismatch(deal: Deal, investor: Investor): boolean {
  if (!deal.stage || !investor.stages.length) return false
  return !investor.stages.includes(deal.stage)
}

// Check against union of multiple investors
function hasSectorOverlapAny(deal: Deal, investors: Investor[]): boolean {
  if (investors.length === 0) return true
  const allSectors = investors.flatMap((i) => i.sectors)
  if (allSectors.length === 0 || deal.sectors.length === 0) return true
  return deal.sectors.some((s) => allSectors.includes(s))
}

function hasStageMismatchAll(deal: Deal, investors: Investor[]): boolean {
  if (!deal.stage || investors.length === 0) return false
  const allStages = new Set(investors.flatMap((i) => i.stages))
  if (allStages.size === 0) return false
  return !allStages.has(deal.stage)
}

export function ShareListBuilder({ investors, deals, lastSharedDates }: Props) {
  const [selectedInvestorIds, setSelectedInvestorIds] = useState<Set<string>>(new Set())
  const [selectedDealIds, setSelectedDealIds] = useState<Set<string>>(new Set())
  // Map of investor_id -> Set of deal_ids already shared
  const [alreadySharedMap, setAlreadySharedMap] = useState<Record<string, Set<string>>>({})
  const [output, setOutput] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [sharedDates, setSharedDates] = useState(lastSharedDates)
  const [investorSearch, setInvestorSearch] = useState('')

  // Filters — sets of selected values (empty = show all)
  const [stageFilters, setStageFilters] = useState<Set<string>>(new Set())
  const [sectorFilters, setSectorFilters] = useState<Set<string>>(new Set())

  const selectedInvestors = useMemo(
    () => investors.filter((i) => selectedInvestorIds.has(i.id)),
    [investors, selectedInvestorIds],
  )

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

  // Collect all unique sectors from deals for the filter dropdown
  const allSectors = useMemo(() => {
    const set = new Set<string>()
    for (const d of deals) {
      for (const s of d.sectors) set.add(s)
    }
    return Array.from(set).sort()
  }, [deals])

  // Union of stages/sectors from selected investors (for pre-populating filters)
  const selectedInvestorStages = useMemo(() => {
    return [...new Set(selectedInvestors.flatMap((i) => i.stages))]
  }, [selectedInvestors])

  const selectedInvestorSectors = useMemo(() => {
    return [...new Set(selectedInvestors.flatMap((i) => i.sectors))]
  }, [selectedInvestors])

  // Auto-populate filters from selected investors' preferences
  useEffect(() => {
    setStageFilters(new Set(selectedInvestorStages))
    setSectorFilters(new Set(selectedInvestorSectors))
  }, [selectedInvestorStages, selectedInvestorSectors])

  function toggleStageFilter(stage: string) {
    setStageFilters((prev) => {
      const next = new Set(prev)
      if (next.has(stage)) next.delete(stage)
      else next.add(stage)
      return next
    })
  }


  // Filter deals by status + stage + sector selections
  const filteredDeals = useMemo(() => {
    let result = deals.filter((d) => d.status === 'active')
    if (stageFilters.size > 0) {
      result = result.filter((d) => !d.stage || stageFilters.has(d.stage))
    }
    if (sectorFilters.size > 0) {
      result = result.filter((d) => d.sectors.length === 0 || d.sectors.some((s) => sectorFilters.has(s)))
    }
    return result
  }, [deals, stageFilters, sectorFilters])

  // Split deals into matched (sector overlap + no stage mismatch vs selected investors) and other
  const { matchedDeals, otherDeals } = useMemo(() => {
    if (selectedInvestors.length === 0) return { matchedDeals: filteredDeals, otherDeals: [] as Deal[] }
    const matched: Deal[] = []
    const other: Deal[] = []
    for (const deal of filteredDeals) {
      const sectorMatch = hasSectorOverlapAny(deal, selectedInvestors)
      const stageMismatch = hasStageMismatchAll(deal, selectedInvestors)
      if (sectorMatch && !stageMismatch) {
        matched.push(deal)
      } else {
        other.push(deal)
      }
    }
    return { matchedDeals: matched, otherDeals: other }
  }, [selectedInvestors, filteredDeals])

  // A deal is "already shared" if shared with ALL selected investors
  const alreadySharedWithAll = useMemo(() => {
    if (selectedInvestorIds.size === 0) return new Set<string>()
    const ids = Array.from(selectedInvestorIds)
    const allDeals = deals.map((d) => d.id)
    const sharedWithAll = new Set<string>()
    for (const dealId of allDeals) {
      if (ids.every((invId) => alreadySharedMap[invId]?.has(dealId))) {
        sharedWithAll.add(dealId)
      }
    }
    return sharedWithAll
  }, [selectedInvestorIds, alreadySharedMap, deals])

  // Fetch shared deal IDs when investor selection changes
  useEffect(() => {
    const ids = Array.from(selectedInvestorIds)
    if (ids.length === 0) {
      setAlreadySharedMap({})
      return
    }
    getSharedDealIdsForInvestors(ids).then((result) => {
      // Convert plain objects back to Sets (server actions serialize Sets as plain objects)
      const map: Record<string, Set<string>> = {}
      for (const [invId, dealIds] of Object.entries(result)) {
        map[invId] = dealIds instanceof Set ? dealIds : new Set(Object.values(dealIds as Record<string, string>))
      }
      setAlreadySharedMap(map)
    })
    setSelectedDealIds(new Set())
    setOutput(null)
  }, [selectedInvestorIds])

  // Auto-select matched deals that haven't been shared with all selected investors
  useEffect(() => {
    const unshared = matchedDeals.filter((d) => !alreadySharedWithAll.has(d.id))
    setSelectedDealIds(new Set(unshared.map((d) => d.id)))
  }, [alreadySharedWithAll, matchedDeals])

  function toggleInvestor(id: string) {
    setSelectedInvestorIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleDeal(dealId: string) {
    setSelectedDealIds((prev) => {
      const next = new Set(prev)
      if (next.has(dealId)) next.delete(dealId)
      else next.add(dealId)
      return next
    })
  }

  async function handleFinalise() {
    if (selectedInvestorIds.size === 0 || selectedDealIds.size === 0) return
    setSaving(true)

    const batchId = crypto.randomUUID()
    const investorIds = Array.from(selectedInvestorIds)
    const dealIds = Array.from(selectedDealIds)
    const result = await saveShareRecords(investorIds, dealIds, batchId)

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

    // Update already-shared state
    setAlreadySharedMap((prev) => {
      const next = { ...prev }
      for (const invId of investorIds) {
        const existing = next[invId] ? new Set(next[invId]) : new Set<string>()
        for (const dealId of dealIds) existing.add(dealId)
        next[invId] = existing
      }
      return next
    })
    const now = new Date().toISOString()
    setSharedDates((prev) => {
      const next = { ...prev }
      for (const invId of investorIds) next[invId] = now
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

  // For a deal, how many selected investors has it already been shared with?
  function sharedStatus(dealId: string): { sharedWithAll: boolean; count: number; total: number } {
    const ids = Array.from(selectedInvestorIds)
    const count = ids.filter((invId) => alreadySharedMap[invId]?.has(dealId)).length
    return { sharedWithAll: count === ids.length && ids.length > 0, count, total: ids.length }
  }

  function renderDealCard(deal: Deal) {
    const { sharedWithAll, count, total } = sharedStatus(deal.id)
    const selected = selectedDealIds.has(deal.id)
    const stageMismatch = selectedInvestors.length > 0 ? hasStageMismatchAll(deal, selectedInvestors) : false

    return (
      <label
        key={deal.id}
        className={`flex items-start gap-3 border rounded-lg p-3 cursor-pointer ${
          sharedWithAll
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
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-foreground">{deal.company_name}</span>
            {deal.stage && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-violet-50 text-violet-800">
                {formatStage(deal.stage)}
              </span>
            )}
            {deal.sectors.length > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-accent-light text-accent">
                {deal.sectors.join(', ')}
              </span>
            )}
            {stageMismatch && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">
                Stage mismatch
              </span>
            )}
            {sharedWithAll && <span className="text-xs text-amber-600">Previously shared</span>}
            {!sharedWithAll && count > 0 && (
              <span className="text-xs text-amber-600">Shared with {count}/{total}</span>
            )}
          </div>
          {deal.one_liner && <p className="text-sm text-secondary mt-0.5">{deal.one_liner}</p>}
        </div>
      </label>
    )
  }

  // Only show WhatsApp if exactly 1 investor selected and they have a phone
  const singleInvestor = selectedInvestors.length === 1 ? selectedInvestors[0] : null

  return (
    <div className="flex gap-6">
      {/* Investor sidebar — multi-select with checkboxes */}
      <div className="w-64 shrink-0 space-y-2">
        <input
          type="text"
          value={investorSearch}
          onChange={(e) => setInvestorSearch(e.target.value)}
          placeholder="Search investors..."
          className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-accent/20 placeholder:text-secondary"
        />
        {selectedInvestorIds.size > 0 && (
          <button
            onClick={() => setSelectedInvestorIds(new Set())}
            className="text-xs text-secondary hover:text-foreground"
          >
            Clear selection ({selectedInvestorIds.size})
          </button>
        )}
        <div className="space-y-0.5 max-h-[60vh] overflow-y-auto">
          {filteredInvestors.length === 0 ? (
            <p className="text-secondary text-xs px-3 py-2">No match</p>
          ) : (
            filteredInvestors.map((inv) => {
              const checked = selectedInvestorIds.has(inv.id)
              return (
                <label
                  key={inv.id}
                  className={`flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg text-sm cursor-pointer ${
                    checked ? 'bg-accent/10' : 'hover:bg-muted'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleInvestor(inv.id)}
                    className="accent-accent shrink-0"
                  />
                  <div className="flex items-center justify-between gap-1 flex-1 min-w-0">
                    <span className="truncate text-foreground">
                      {inv.contact_name}
                      {inv.fund_name && (
                        <span className="text-xs ml-1 text-secondary">
                          @ {inv.fund_name}
                        </span>
                      )}
                    </span>
                    {sharedDates[inv.id] && (
                      <span className="text-xs shrink-0 text-secondary">
                        {formatDate(sharedDates[inv.id])}
                      </span>
                    )}
                  </div>
                </label>
              )
            })
          )}
        </div>
      </div>

      {/* Deal list */}
      <div className="flex-1 space-y-4">
        {/* Filter bar: stage + sector multi-select pills */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-secondary shrink-0">Stage:</span>
            {DEAL_STAGES.map((s) => {
              const active = stageFilters.has(s)
              return (
                <button
                  key={s}
                  onClick={() => toggleStageFilter(s)}
                  className={`px-2 py-1 text-xs rounded-lg border transition-colors ${
                    active
                      ? 'bg-violet-100 text-violet-800 border-violet-300'
                      : 'bg-surface text-secondary border-border hover:border-violet-300'
                  }`}
                >
                  {formatStage(s)}
                </button>
              )
            })}
            {stageFilters.size > 0 && (
              <button onClick={() => setStageFilters(new Set())} className="text-xs text-secondary hover:text-foreground ml-1">
                Clear
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-secondary shrink-0">Sector:</span>
            <MultiSelectDropdown
              options={[...DEAL_SECTORS]}
              selected={Array.from(sectorFilters)}
              onChange={(sectors) => setSectorFilters(new Set(sectors))}
              placeholder="All sectors"
            />
          </div>
        </div>

        {selectedInvestorIds.size === 0 ? (
          <p className="text-secondary text-sm">Select one or more investors from the sidebar.</p>
        ) : (
          <>
            <p className="text-sm text-secondary">
              Sharing with{' '}
              <span className="font-medium text-foreground">
                {selectedInvestors.map((i) => i.contact_name).join(', ')}
              </span>
              {' '}&middot; {filteredDeals.length} deals
            </p>

            {filteredDeals.length === 0 ? (
              <p className="text-secondary text-sm">No deals match your filters.</p>
            ) : (
              <div className="space-y-4">
                {matchedDeals.length > 0 && (
                  <div className="space-y-2">
                    {matchedDeals.map(renderDealCard)}
                  </div>
                )}
                {otherDeals.length > 0 && (
                  <div className="space-y-2">
                    {matchedDeals.length > 0 && (
                      <p className="text-xs text-secondary font-medium pt-2">Other deals</p>
                    )}
                    {otherDeals.map(renderDealCard)}
                  </div>
                )}
              </div>
            )}

            {!output && filteredDeals.length > 0 && (
              <button
                onClick={handleFinalise}
                disabled={saving || selectedDealIds.size === 0}
                className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 disabled:opacity-40"
              >
                {saving
                  ? 'Saving...'
                  : `Finalise (${selectedDealIds.size} deals → ${selectedInvestorIds.size} investor${selectedInvestorIds.size > 1 ? 's' : ''})`}
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
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={copyToClipboard}
                    className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted">
                    Copy to clipboard
                  </button>
                  {singleInvestor?.phone && (
                    <a
                      href={`https://api.whatsapp.com/send?phone=${singleInvestor.phone.replace(/[^0-9]/g, '')}&text=${encodeURIComponent(output)}`}
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
