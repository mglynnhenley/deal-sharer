import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { EditableField } from '@/components/EditableField'
import { NoteInput } from '@/components/deals/NoteInput'
import { NoteList } from '@/components/deals/NoteList'
import { updateDeal } from '@/app/deals/actions'
import type { Deal, DealNote } from '@/lib/supabase/types'

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: deal } = await supabase
    .from('deals')
    .select()
    .eq('id', id)
    .single()

  if (!deal) notFound()

  const { data: notes } = await supabase
    .from('deal_notes')
    .select()
    .eq('deal_id', id)
    .order('created_at', { ascending: false })

  const typedDeal = deal as Deal
  const typedNotes = (notes || []) as DealNote[]
  const existingSummaries = typedNotes
    .map((n) => n.summary)
    .filter(Boolean) as string[]

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
      <Link href="/?tab=deals" className="text-sm text-secondary hover:text-foreground">
        &larr; Back to deals
      </Link>

      <DealHeader deal={typedDeal} />

      {typedDeal.notes_summary && (
        <section className="border border-border rounded-lg p-4 bg-amber-50/50">
          <h2 className="text-sm font-semibold text-foreground mb-1">Summary</h2>
          <p className="text-sm text-secondary">{typedDeal.notes_summary}</p>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Notes</h2>
        <NoteInput dealId={id} existingSummaries={existingSummaries} />
        <NoteList notes={typedNotes} dealId={id} />
      </section>
    </div>
  )
}

function DealHeader({ deal }: { deal: Deal }) {
  async function handleUpdate(field: string, value: string) {
    'use server'
    let parsed: string | number | null = value || null
    if (field === 'priority') parsed = parseInt(value)
    if (field === 'raise_amount') parsed = value ? parseFloat(value) : null
    return updateDeal(deal.id, field, parsed)
  }

  const priorityOptions = [
    { value: '1', label: 'P1 — Top' },
    { value: '2', label: 'P2 — Good' },
    { value: '3', label: 'P3 — Interesting' },
  ]

  function priorityBadgeClass(p: number) {
    if (p === 1) return 'bg-amber-100 text-amber-900'
    if (p === 2) return 'bg-gray-100 text-gray-800'
    return 'bg-gray-50 text-gray-600'
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-foreground">
          <EditableField
            value={deal.company_name}
            onSave={(v) => handleUpdate('company_name', v)}
          />
        </h1>
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
      </div>
      {deal.one_liner && (
        <p className="text-sm text-secondary">
          <EditableField
            value={deal.one_liner}
            onSave={(v) => handleUpdate('one_liner', v)}
          />
        </p>
      )}
      {deal.website_url && (
        <a href={deal.website_url} target="_blank" rel="noopener noreferrer"
           className="text-sm text-blue-700 hover:underline">
          {deal.website_url}
        </a>
      )}
    </div>
  )
}
