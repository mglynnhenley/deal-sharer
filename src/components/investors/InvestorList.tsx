'use client'

import type { Investor } from '@/lib/supabase/types'
import { EditableField } from '@/components/EditableField'
import { updateInvestor, deleteInvestor } from '@/app/investors/actions'

const thresholdOptions = [
  { value: '1', label: 'P1 only (top deals)' },
  { value: '2', label: 'P1–2 (top + good)' },
  { value: '3', label: 'P1–3 (everything)' },
]

const frequencyOptions = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'bi-weekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
]

function thresholdBadge(t: number) {
  if (t === 1) return 'bg-amber-50 text-amber-800'
  if (t === 2) return 'bg-stone-100 text-stone-700'
  return 'bg-stone-50 text-stone-500'
}

export function InvestorList({ investors }: { investors: Investor[] }) {
  if (investors.length === 0) {
    return <p className="text-secondary text-sm">No investors yet.</p>
  }

  return (
    <div className="space-y-2">
      {investors.map((inv) => (
        <InvestorRow key={inv.id} investor={inv} />
      ))}
    </div>
  )
}

function InvestorRow({ investor }: { investor: Investor }) {
  async function handleUpdate(field: string, value: string) {
    let parsed: string | number | string[] | null = value || null
    if (field === 'priority_threshold') parsed = parseInt(value)
    if (field === 'sectors')
      parsed = value ? value.split(',').map((s) => s.trim()).filter(Boolean) : []
    return updateInvestor(investor.id, field, parsed)
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
              value={String(investor.priority_threshold)}
              onSave={(v) => handleUpdate('priority_threshold', v)}
              type="select"
              options={thresholdOptions}
              className={`text-xs font-medium px-2 py-0.5 rounded ${thresholdBadge(investor.priority_threshold)}`}
            />
            <EditableField
              value={investor.sharing_frequency}
              onSave={(v) => handleUpdate('sharing_frequency', v)}
              type="select"
              options={frequencyOptions}
              className="text-xs text-secondary"
            />
          </div>
          <div className="mt-1.5">
            <span className="text-xs text-accent">
              <EditableField
                value={investor.sectors?.join(', ') || ''}
                onSave={(v) => handleUpdate('sectors', v)}
                placeholder="Add sectors (comma-separated)..."
                className="text-xs"
              />
            </span>
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
        </div>
        <button
          onClick={async () => { if (confirm('Delete this investor?')) await deleteInvestor(investor.id) }}
          className="text-sm text-secondary hover:text-accent shrink-0"
        >
          Delete
        </button>
      </div>
    </div>
  )
}
