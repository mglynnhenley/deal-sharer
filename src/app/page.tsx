import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { DealInput } from '@/components/deals/DealInput'
import { DealList } from '@/components/deals/DealList'
import { InvestorInput } from '@/components/investors/InvestorInput'
import { InvestorList } from '@/components/investors/InvestorList'
import type { Deal, Investor } from '@/lib/supabase/types'
import { TabSwitcher } from '@/components/TabSwitcher'

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  const activeTab = tab === 'investors' ? 'investors' : 'deals'
  const supabase = await createClient()

  let deals: Deal[] = []
  let investors: Investor[] = []

  if (activeTab === 'deals') {
    const { data } = await supabase
      .from('deals')
      .select()
      .order('created_at', { ascending: false })
    deals = (data as Deal[]) || []
  } else {
    const { data } = await supabase
      .from('investors')
      .select()
      .order('priority_threshold', { ascending: true })
      .order('created_at', { ascending: false })
    investors = (data as Investor[]) || []
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
      <Suspense>
        <TabSwitcher activeTab={activeTab} />
      </Suspense>

      {activeTab === 'deals' ? (
        <>
          <section>
            <DealInput />
          </section>
          <section>
            <DealList deals={deals} />
          </section>
        </>
      ) : (
        <>
          <section>
            <InvestorInput />
          </section>
          <section>
            <InvestorList investors={investors} />
          </section>
        </>
      )}
    </div>
  )
}
