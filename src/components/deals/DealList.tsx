'use client'

import type { Deal } from '@/lib/supabase/types'
import { EditableField } from '@/components/EditableField'
import { updateDeal, deleteDeal } from '@/app/deals/actions'

type WeekGroup = {
  label: string
  deals: Deal[]
}

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
      if (a.priority !== b.priority) return a.priority - b.priority
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    return { label, deals: weekDeals }
  })
}

const priorityOptions = [
  { value: '1', label: 'P1 — Top' },
  { value: '2', label: 'P2 — Good' },
  { value: '3', label: 'P3 — Interesting' },
]

const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'passed', label: 'Passed' },
  { value: 'closed', label: 'Closed' },
]

function priorityBadgeClass(p: number) {
  if (p === 1) return 'bg-amber-100 text-amber-900'
  if (p === 2) return 'bg-gray-100 text-gray-800'
  return 'bg-gray-50 text-gray-600'
}

export function DealList({ deals }: { deals: Deal[] }) {
  const groups = groupByWeek(deals)

  if (deals.length === 0) {
    return <p className="text-secondary text-sm">No deals yet.</p>
  }

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <div key={group.label}>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-sm font-semibold text-foreground">{group.label}</h3>
            <span className="text-sm text-secondary">{group.deals.length}</span>
          </div>
          <div className="space-y-2">
            {group.deals.map((deal) => (
              <DealRow key={deal.id} deal={deal} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function DealRow({ deal }: { deal: Deal }) {
  async function handleUpdate(field: string, value: string) {
    let parsed: string | number | null = value || null
    if (field === 'priority') parsed = parseInt(value)
    if (field === 'raise_amount') parsed = value ? parseFloat(value) : null
    return updateDeal(deal.id, field, parsed)
  }

  return (
    <div className="border border-border rounded-lg p-4 bg-surface">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-base text-foreground">
              <EditableField
                value={deal.company_name}
                onSave={(v) => handleUpdate('company_name', v)}
              />
            </span>
            <EditableField
              value={String(deal.priority)}
              onSave={(v) => handleUpdate('priority', v)}
              type="select"
              options={priorityOptions}
              className={`text-xs font-medium px-2 py-0.5 rounded ${priorityBadgeClass(deal.priority)}`}
            />
            {deal.sector && (
              <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-50 text-blue-800">
                <EditableField
                  value={deal.sector}
                  onSave={(v) => handleUpdate('sector', v)}
                />
              </span>
            )}
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
          {deal.website_url && (
            <div className="mt-1">
              <a href={deal.website_url} target="_blank" rel="noopener noreferrer"
                 className="text-sm text-blue-700 hover:underline">
                {deal.website_url}
              </a>
            </div>
          )}
        </div>
        <button
          onClick={async () => { if (confirm('Delete this deal?')) await deleteDeal(deal.id) }}
          className="text-sm text-secondary hover:text-red-600 shrink-0"
        >
          Delete
        </button>
      </div>
    </div>
  )
}
