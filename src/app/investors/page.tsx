import { createClient } from '@/lib/supabase/server'
import { InvestorInput } from '@/components/investors/InvestorInput'
import type { Investor } from '@/lib/supabase/types'

export default async function InvestorsPage() {
  const supabase = await createClient()
  const { data: investors } = await supabase
    .from('investors')
    .select()
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-bold">Investors</h1>

      <section>
        <h2 className="text-lg font-semibold mb-3">Add Investor</h2>
        <InvestorInput />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">All Investors</h2>
        {investors && investors.length > 0 ? (
          <InvestorList investors={investors as Investor[]} />
        ) : (
          <p className="text-gray-500 text-sm">No investors yet.</p>
        )}
      </section>
    </div>
  )
}

function InvestorList({ investors }: { investors: Investor[] }) {
  return (
    <div className="space-y-2">
      {investors.map((inv) => (
        <div key={inv.id} className="border rounded-lg p-3 bg-white">
          <div className="flex items-center gap-2">
            <span className="font-medium">{inv.contact_name}</span>
            {inv.fund_name && <span className="text-sm text-gray-500">@ {inv.fund_name}</span>}
            <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100">
              P1{inv.priority_threshold > 1 ? `-${inv.priority_threshold}` : ''}
            </span>
            <span className="text-xs text-gray-500">{inv.sharing_frequency}</span>
          </div>
          {inv.thesis_description && (
            <p className="text-sm text-gray-600 mt-1">{inv.thesis_description}</p>
          )}
        </div>
      ))}
    </div>
  )
}
