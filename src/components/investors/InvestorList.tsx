'use client'

import { useState } from 'react'
import type { Investor } from '@/lib/supabase/types'
import { DEAL_STAGES, DEAL_SECTORS } from '@/lib/supabase/types'
import { EditableField } from '@/components/EditableField'
import { MultiSelectDropdown } from '@/components/MultiSelectDropdown'
import { updateInvestor, deleteInvestor } from '@/app/investors/actions'

const frequencyOptions = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'bi-weekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
]

function formatStage(stage: string): string {
  return stage.replace('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function matchesSearch(inv: Investor, query: string): boolean {
  const q = query.toLowerCase()
  return (
    inv.contact_name.toLowerCase().includes(q) ||
    (inv.fund_name?.toLowerCase().includes(q) ?? false) ||
    (inv.email?.toLowerCase().includes(q) ?? false) ||
    (inv.thesis_description?.toLowerCase().includes(q) ?? false) ||
    inv.sectors.some((s) => s.toLowerCase().includes(q)) ||
    (inv.stages || []).some((s) => s.toLowerCase().includes(q))
  )
}

export function InvestorList({ investors }: { investors: Investor[] }) {
  const [search, setSearch] = useState('')

  if (investors.length === 0) {
    return <p className="text-secondary text-sm">No investors yet.</p>
  }

  const searched = search.trim()
    ? investors.filter((inv) => matchesSearch(inv, search.trim()))
    : investors
  const filtered = [...searched].sort((a, b) => {
    if (a.starred !== b.starred) return a.starred ? -1 : 1
    return a.contact_name.localeCompare(b.contact_name)
  })

  return (
    <div className="space-y-4">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search investors..."
        className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-accent/20 placeholder:text-secondary"
      />
      {filtered.length === 0 ? (
        <p className="text-secondary text-sm">No investors match your search.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((inv) => (
            <InvestorRow key={inv.id} investor={inv} />
          ))}
        </div>
      )}
    </div>
  )
}

function InvestorRow({ investor }: { investor: Investor }) {
  const [starred, setStarred] = useState(investor.starred)
  const [stages, setStages] = useState<Set<string>>(new Set(investor.stages || []))
  const [sectors, setSectors] = useState<string[]>(investor.sectors || [])

  async function handleUpdate(field: string, value: string) {
    let parsed: string | number | string[] | null = value || null
    return updateInvestor(investor.id, field, parsed)
  }

  async function toggleStage(stage: string) {
    const next = new Set(stages)
    if (next.has(stage)) next.delete(stage)
    else next.add(stage)
    setStages(next)
    const result = await updateInvestor(investor.id, 'stages', Array.from(next))
    if (result.error) {
      // Revert on error
      setStages(new Set(investor.stages || []))
      alert(result.error)
    }
  }

  return (
    <div className="border border-border rounded-lg p-4 bg-surface">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground">
              <EditableField
                value={investor.contact_name}
                onSave={(v) => handleUpdate('contact_name', v)}
              />
            </span>
            {investor.fund_name && (
              <span className="text-sm text-secondary">
                @ <EditableField value={investor.fund_name} onSave={(v) => handleUpdate('fund_name', v)} />
              </span>
            )}
            <EditableField
              value={investor.sharing_frequency}
              onSave={(v) => handleUpdate('sharing_frequency', v)}
              type="select"
              options={frequencyOptions}
              className="text-xs text-secondary"
            />
          </div>
          <div className="mt-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-secondary shrink-0">Stages:</span>
              {DEAL_STAGES.map((s) => {
                const active = stages.has(s)
                return (
                  <button
                    key={s}
                    onClick={() => toggleStage(s)}
                    className={`px-2 py-0.5 text-xs rounded-lg border transition-colors ${
                      active
                        ? 'bg-violet-100 text-violet-800 border-violet-300'
                        : 'bg-surface text-secondary border-border hover:border-violet-300'
                    }`}
                  >
                    {formatStage(s)}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="mt-1.5">
            <MultiSelectDropdown
              options={[...DEAL_SECTORS]}
              selected={sectors}
              onChange={async (next) => {
                setSectors(next)
                const result = await updateInvestor(investor.id, 'sectors', next)
                if (result.error) {
                  setSectors(investor.sectors || [])
                  alert(result.error)
                }
              }}
              placeholder="Add sectors..."
            />
          </div>
          <div className="mt-1">
            <EditableField
              value={investor.thesis_description || ''}
              onSave={(v) => handleUpdate('thesis_description', v)}
              placeholder="Add thesis notes..."
              className="text-sm text-secondary"
            />
          </div>
          <div className="flex gap-3 mt-1.5 flex-wrap">
            <span className="text-sm text-secondary">
              <EditableField value={investor.email || ''} onSave={(v) => handleUpdate('email', v)} placeholder="Add email..." />
            </span>
            <span className="text-sm text-secondary">
              <EditableField value={investor.phone || ''} onSave={(v) => handleUpdate('phone', v)} placeholder="Add phone..." />
            </span>
            <span className="text-sm text-accent">
              <EditableField value={investor.linkedin_url || ''} onSave={(v) => handleUpdate('linkedin_url', v)} placeholder="Add LinkedIn URL..." />
            </span>
          </div>
          <div className="flex items-center justify-end gap-3 mt-2">
            <button
              onClick={async () => {
                const next = !starred
                setStarred(next)
                const result = await updateInvestor(investor.id, 'starred', next as unknown as string)
                if (result.error) {
                  setStarred(starred)
                  alert(result.error)
                }
              }}
              className={`text-lg ${starred ? 'text-orange-400' : 'text-gray-300 hover:text-orange-300'}`}
              title={starred ? 'Unstar' : 'Star'}
            >
              {starred ? '\u2605' : '\u2606'}
            </button>
            <button
              onClick={async () => { if (confirm('Delete this investor?')) await deleteInvestor(investor.id) }}
              className="text-sm text-secondary hover:text-accent"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
