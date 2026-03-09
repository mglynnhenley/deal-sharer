import { createClient } from '@/lib/supabase/server'
import { ShareListBuilder } from '@/components/share/ShareListBuilder'
import type { Deal, Investor } from '@/lib/supabase/types'

export default async function SharePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const { from, to } = await searchParams
  const supabase = await createClient()

  const { data: investors } = await supabase
    .from('investors')
    .select()
    .order('contact_name')

  let dealsQuery = supabase
    .from('deals')
    .select()
    .eq('status', 'active')
    .order('priority')
    .order('created_at', { ascending: false })

  if (from) dealsQuery = dealsQuery.gte('created_at', `${from}T00:00:00`)
  if (to) dealsQuery = dealsQuery.lte('created_at', `${to}T23:59:59`)

  const { data: deals } = await dealsQuery

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Share Lists</h1>

      <DateRangeForm from={from} to={to} />

      <ShareListBuilder
        investors={(investors || []) as Investor[]}
        deals={(deals || []) as Deal[]}
      />
    </div>
  )
}

function DateRangeForm({ from, to }: { from?: string; to?: string }) {
  return (
    <form className="flex items-center gap-3 text-sm">
      <label className="text-gray-600">From:</label>
      <input type="date" name="from" defaultValue={from} className="px-2 py-1 border rounded" />
      <label className="text-gray-600">To:</label>
      <input type="date" name="to" defaultValue={to} className="px-2 py-1 border rounded" />
      <button type="submit" className="px-3 py-1 bg-black text-white rounded hover:bg-gray-800">
        Filter
      </button>
    </form>
  )
}
