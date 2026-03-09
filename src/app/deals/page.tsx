import { createClient } from '@/lib/supabase/server'
import { DealInput } from '@/components/deals/DealInput'
import type { Deal } from '@/lib/supabase/types'

export default async function DealsPage() {
  const supabase = await createClient()
  const { data: deals } = await supabase
    .from('deals')
    .select()
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-bold">Deals</h1>

      <section>
        <h2 className="text-lg font-semibold mb-3">Add Deals</h2>
        <DealInput />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">All Deals</h2>
        {deals && deals.length > 0 ? (
          <DealList deals={deals as Deal[]} />
        ) : (
          <p className="text-gray-500 text-sm">No deals yet.</p>
        )}
      </section>
    </div>
  )
}

function DealList({ deals }: { deals: Deal[] }) {
  return (
    <div className="space-y-2">
      {deals.map((deal) => (
        <div key={deal.id} className="border rounded-lg p-3 bg-white flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{deal.company_name}</span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100">
                P{deal.priority}
              </span>
              <span className="text-xs text-gray-500">
                {new Date(deal.created_at).toLocaleDateString()}
              </span>
            </div>
            {deal.one_liner && (
              <p className="text-sm text-gray-600 mt-1">{deal.one_liner}</p>
            )}
          </div>
          {deal.website_url && (
            <a href={deal.website_url} target="_blank" rel="noopener noreferrer"
               className="text-xs text-blue-600 hover:underline shrink-0">
              Website
            </a>
          )}
        </div>
      ))}
    </div>
  )
}
