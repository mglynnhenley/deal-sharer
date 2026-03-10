import { createClient } from '@/lib/supabase/server'

type ShareRecordWithDetails = {
  id: string
  created_at: string
  batch_id: string
  deals: { company_name: string; website_url: string | null; one_liner: string | null }
  investors: { contact_name: string; fund_name: string | null }
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; investor?: string; deal?: string }>
}) {
  const { from, to, investor, deal } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('share_records')
    .select(`
      id,
      created_at,
      batch_id,
      deals (company_name, website_url, one_liner),
      investors (contact_name, fund_name)
    `)
    .order('created_at', { ascending: false })

  if (from) query = query.gte('created_at', `${from}T00:00:00`)
  if (to) query = query.lte('created_at', `${to}T23:59:59`)
  if (investor) query = query.eq('investor_id', investor)
  if (deal) query = query.eq('deal_id', deal)

  const { data: records } = await query

  // Group by batch
  const batches = new Map<string, { date: string; investor: string; deals: string[] }>()
  for (const r of (records || []) as unknown as ShareRecordWithDetails[]) {
    const existing = batches.get(r.batch_id)
    const dealText = `${r.deals.company_name}${r.deals.one_liner ? ' - ' + r.deals.one_liner : ''}`
    if (existing) {
      existing.deals.push(dealText)
    } else {
      batches.set(r.batch_id, {
        date: new Date(r.created_at).toLocaleDateString(),
        investor: `${r.investors.contact_name}${r.investors.fund_name ? ' @ ' + r.investors.fund_name : ''}`,
        deals: [dealText],
      })
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Share History</h1>

      <form className="flex items-center gap-3 text-sm">
        <label className="text-secondary">From:</label>
        <input type="date" name="from" defaultValue={from} className="px-2 py-1 border border-border rounded bg-surface" />
        <label className="text-secondary">To:</label>
        <input type="date" name="to" defaultValue={to} className="px-2 py-1 border border-border rounded bg-surface" />
        <button type="submit" className="px-3 py-1 bg-foreground text-background rounded font-medium hover:opacity-90">
          Filter
        </button>
      </form>

      {batches.size === 0 ? (
        <p className="text-secondary text-sm">No share history yet.</p>
      ) : (
        <div className="space-y-4">
          {Array.from(batches.entries()).map(([batchId, batch]) => (
            <div key={batchId} className="border border-border rounded-lg p-4 bg-surface">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-sm font-medium text-foreground">{batch.investor}</span>
                <span className="text-sm text-secondary">{batch.date}</span>
                <span className="text-sm text-secondary">{batch.deals.length} deal(s)</span>
              </div>
              <ul className="text-sm text-secondary space-y-1">
                {batch.deals.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
