import { createClient } from '@/lib/supabase/server'
import { HistoryList } from './history-list'

type ShareRecordWithDetails = {
  id: string
  created_at: string
  batch_id: string
  deals: { company_name: string; website_url: string | null; linkedin_url: string | null; one_liner: string | null }
  investors: { contact_name: string; fund_name: string | null }
}

export type HistoryBatch = {
  batchId: string
  date: string
  investor: string
  deals: string[]
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; investor?: string; deal?: string }>
}) {
  const { from: fromParam, to: toParam, investor, deal } = await searchParams
  const supabase = await createClient()

  const today = new Date().toISOString().slice(0, 10)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const from = fromParam ?? weekAgo
  const to = toParam ?? today

  let query = supabase
    .from('share_records')
    .select('id, created_at, batch_id, deals (company_name, website_url, linkedin_url, one_liner), investors (contact_name, fund_name)')
    .order('created_at', { ascending: false })
    .gte('created_at', `${from}T00:00:00`)
    .lte('created_at', `${to}T23:59:59`)
  if (investor) query = query.eq('investor_id', investor)
  if (deal) query = query.eq('deal_id', deal)

  const { data: records } = await query

  const batchMap = new Map<string, { date: string; investor: string; deals: string[] }>()
  for (const r of (records || []) as unknown as ShareRecordWithDetails[]) {
    const existing = batchMap.get(r.batch_id)
    const oneLiner = r.deals.one_liner
    const links = [r.deals.website_url, r.deals.linkedin_url].filter(Boolean).join(', ')
    const dealText = `${r.deals.company_name}${oneLiner ? ' - ' + oneLiner : ''}${links ? ' (' + links + ')' : ''}`
    if (existing) {
      existing.deals.push(dealText)
    } else {
      batchMap.set(r.batch_id, {
        date: new Date(r.created_at).toLocaleDateString(),
        investor: `${r.investors.contact_name}${r.investors.fund_name ? ' @ ' + r.investors.fund_name : ''}`,
        deals: [dealText],
      })
    }
  }

  const batches: HistoryBatch[] = Array.from(batchMap.entries()).map(([batchId, b]) => ({
    batchId,
    ...b,
  }))

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Share History</h1>

      <form className="flex items-center gap-3 text-sm">
        <label className="text-secondary">From:</label>
        <input type="date" name="from" defaultValue={from}
          className="px-2 py-1.5 border border-border rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-accent/20" />
        <label className="text-secondary">To:</label>
        <input type="date" name="to" defaultValue={to}
          className="px-2 py-1.5 border border-border rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-accent/20" />
        <button type="submit" className="px-3 py-1.5 bg-accent text-white rounded-lg font-medium hover:bg-accent/90">
          Filter
        </button>
      </form>

      <HistoryList batches={batches} />
    </div>
  )
}
