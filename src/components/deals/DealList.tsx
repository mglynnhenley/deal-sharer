'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Deal } from '@/lib/supabase/types'
import { DEAL_STAGES, DEAL_SECTORS } from '@/lib/supabase/types'
import { EditableField } from '@/components/EditableField'
import { MultiSelectDropdown } from '@/components/MultiSelectDropdown'
import { updateDeal, deleteDeal, addDealToMyList, deleteTeamDeal } from '@/app/deals/actions'

type WeekGroup = { label: string; deals: Deal[] }

function getWeekLabel(date: Date): string {
  const now = new Date()
  const startOfThisWeek = new Date(now)
  startOfThisWeek.setDate(now.getDate() - now.getDay() + 1)
  startOfThisWeek.setHours(0, 0, 0, 0)

  const startOfLastWeek = new Date(startOfThisWeek)
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 7)

  if (date >= startOfThisWeek) return 'This Week'
  if (date >= startOfLastWeek) return 'Last Week'

  const weekStart = new Date(date)
  weekStart.setDate(date.getDate() - date.getDay() + 1)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)

  const fmt = (d: Date) => d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })
  return `${fmt(weekStart)} – ${fmt(weekEnd)}`
}

function groupByWeek(deals: Deal[]): WeekGroup[] {
  const groups = new Map<string, Deal[]>()
  const order: string[] = []

  for (const deal of deals) {
    const label = getWeekLabel(new Date(deal.created_at))
    if (!groups.has(label)) {
      groups.set(label, [])
      order.push(label)
    }
    groups.get(label)!.push(deal)
  }

  return order.map((label) => {
    const weekDeals = groups.get(label)!
    weekDeals.sort((a, b) => {
      if (a.is_in_my_list !== b.is_in_my_list) return a.is_in_my_list ? -1 : 1
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    return { label, deals: weekDeals }
  })
}

const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'passed', label: 'Passed' },
  { value: 'closed', label: 'Closed' },
]

const stageOptions = [
  { value: '', label: 'No stage' },
  ...DEAL_STAGES.map((s) => ({ value: s, label: s.replace('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase()) })),
]

function matchesSearch(deal: Deal, query: string): boolean {
  const q = query.toLowerCase()
  return (
    deal.company_name.toLowerCase().includes(q) ||
    (deal.one_liner?.toLowerCase().includes(q) ?? false) ||
    deal.sectors.some((s) => s.toLowerCase().includes(q)) ||
    (deal.website_url?.toLowerCase().includes(q) ?? false) ||
    deal.status.toLowerCase().includes(q)
  )
}

export function DealList({ deals }: { deals: Deal[] }) {
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState<string[]>([])
  const [sectorFilter, setSectorFilter] = useState<string[]>([])

  if (deals.length === 0) {
    return <p className="text-secondary text-sm">No deals yet.</p>
  }

  let filtered = deals
  if (stageFilter.length > 0) {
    filtered = filtered.filter((d) => !d.stage || stageFilter.includes(d.stage))
  }
  if (sectorFilter.length > 0) {
    filtered = filtered.filter((d) => d.sectors.length === 0 || d.sectors.some((s) => sectorFilter.includes(s)))
  }
  if (search.trim()) {
    filtered = filtered.filter((d) => matchesSearch(d, search.trim()))
  }
  const groups = groupByWeek(filtered)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search deals..."
          className="flex-1 min-w-[200px] px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-accent/20 placeholder:text-secondary"
        />
        <MultiSelectDropdown
          options={[...DEAL_STAGES]}
          selected={stageFilter}
          onChange={setStageFilter}
          placeholder="Stage..."
        />
        <MultiSelectDropdown
          options={[...DEAL_SECTORS]}
          selected={sectorFilter}
          onChange={setSectorFilter}
          placeholder="Sector..."
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-secondary text-sm">No deals match your filters.</p>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.label}>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-semibold text-foreground">{group.label}</h3>
                <span className="text-xs text-secondary bg-muted px-1.5 py-0.5 rounded-full">
                  {group.deals.length}
                </span>
              </div>
              <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
                {group.deals.map((deal) => (
                  <DealRow key={deal.id} deal={deal} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function DealRow({ deal }: { deal: Deal }) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)

  async function handleUpdate(field: string, value: string) {
    let parsed: string | number | string[] | null = value || null
    if (field === 'raise_amount') parsed = value ? parseFloat(value) : null
    if (field === 'sectors') parsed = value ? value.split(',').map((s) => s.trim()).filter(Boolean) : []
    return updateDeal(deal.id, field, parsed)
  }

  async function handleAddToList() {
    setAdding(true)
    const result = await addDealToMyList(deal.id, deal.one_liner)
    if (result.error) alert(result.error)
    else router.refresh()
    setAdding(false)
  }

  async function handleDeleteFromTeam() {
    if (!confirm('Delete this deal from the team? This removes it for everyone.')) return
    const result = await deleteTeamDeal(deal.id)
    if (result.error) alert(result.error)
    else router.refresh()
  }

  if (!deal.is_in_my_list) {
    return (
      <div className="p-4 bg-muted/30">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-secondary">{deal.company_name}</span>
              <span className="text-xs text-secondary/60">Team deal</span>
            </div>
            {deal.one_liner && (
              <p className="text-sm text-secondary mt-0.5">{deal.one_liner}</p>
            )}
            {deal.website_url && (
              <a href={deal.website_url} target="_blank" rel="noopener noreferrer"
                className="text-sm text-accent hover:underline">
                {deal.website_url}
              </a>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={handleAddToList} disabled={adding}
              className="px-3 py-1.5 border border-accent/30 text-accent rounded-lg text-sm font-medium hover:bg-accent-light disabled:opacity-40">
              {adding ? 'Adding...' : 'Add to my list'}
            </button>
            <button onClick={handleDeleteFromTeam}
              className="text-sm text-secondary hover:text-accent">
              Delete
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 bg-surface">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground">
              <EditableField
                value={deal.company_name}
                onSave={(v) => handleUpdate('company_name', v)}
              />
            </span>
            {deal.stage ? (
              <EditableField
                value={deal.stage}
                onSave={(v) => handleUpdate('stage', v)}
                type="select"
                options={stageOptions}
                className="text-xs font-medium px-2 py-0.5 rounded bg-violet-50 text-violet-800"
              />
            ) : (
              <EditableField
                value=""
                onSave={(v) => handleUpdate('stage', v)}
                type="select"
                options={stageOptions}
                className="text-xs text-secondary"
                placeholder="Stage"
              />
            )}
            <MultiSelectDropdown
              options={[...DEAL_SECTORS]}
              selected={deal.sectors}
              onChange={async (sectors) => {
                const result = await updateDeal(deal.id, 'sectors', sectors)
                if (result.error) alert(result.error)
                else router.refresh()
              }}
              placeholder="Sectors..."
            />
            <EditableField
              value={deal.status}
              onSave={(v) => handleUpdate('status', v)}
              type="select"
              options={statusOptions}
              className="text-xs text-secondary"
            />
          </div>
          <div className="mt-1.5">
            <EditableField
              value={deal.one_liner || ''}
              onSave={(v) => handleUpdate('one_liner', v)}
              placeholder="Add a one-liner..."
              className="text-sm text-secondary"
            />
          </div>
          <div className="flex gap-3 mt-1">
            {deal.website_url && (
              <a href={deal.website_url} target="_blank" rel="noopener noreferrer"
                className="text-sm text-accent hover:underline">
                {deal.website_url}
              </a>
            )}
            <span className="text-sm text-accent">
              <EditableField
                value={deal.linkedin_url || ''}
                onSave={(v) => handleUpdate('linkedin_url', v)}
                placeholder="Add LinkedIn..."
              />
            </span>
          </div>
        </div>
        <button
          onClick={async () => {
            if (confirm('Remove this deal from your list?')) {
              const result = await deleteDeal(deal.id)
              if (result.error) alert(result.error)
              else router.refresh()
            }
          }}
          className="text-sm text-secondary hover:text-accent shrink-0"
        >
          Remove
        </button>
      </div>
    </div>
  )
}
