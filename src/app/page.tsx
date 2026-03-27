import { createClient } from '@/lib/supabase/server'
import { DealInput } from '@/components/deals/DealInput'
import { DealList } from '@/components/deals/DealList'
import { InvestorInput } from '@/components/investors/InvestorInput'
import { InvestorList } from '@/components/investors/InvestorList'
import { ShareListBuilder } from '@/components/share/ShareListBuilder'
import { getLastSharedDates } from '@/app/share/actions'
import type { Deal, Investor } from '@/lib/supabase/types'

type DealRow = {
  id: string
  created_at: string
  company_name: string
  website_url: string | null
  linkedin_url: string | null
  one_liner: string | null
  sectors: string[]
  stage: string | null
  user_deals: {
    id: string
    raise_amount: number | null
    currency: string | null
    status: string
    raw_source_text: string | null
  }[]
}

function flattenDeal(d: DealRow): Deal {
  const ud = d.user_deals[0]
  return {
    id: d.id,
    created_at: d.created_at,
    company_name: d.company_name,
    website_url: d.website_url,
    linkedin_url: d.linkedin_url,
    user_deal_id: ud?.id || null,
    one_liner: d.one_liner || null,
    raise_amount: ud?.raise_amount || null,
    currency: ud?.currency || 'EUR',
    sectors: d.sectors || [],
    stage: d.stage || null,
    status: (ud?.status || 'active') as 'active' | 'passed' | 'closed',
    raw_source_text: ud?.raw_source_text || null,
    is_in_my_list: !!ud,
  }
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; from?: string; to?: string }>
}) {
  const { tab, from: fromParam, to: toParam } = await searchParams
  const activeTab = tab === 'investors' ? 'investors' : tab === 'share' ? 'share' : 'deals'

  // Default share list date range: past week
  const today = new Date().toISOString().slice(0, 10)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const from = activeTab === 'share' ? (fromParam ?? weekAgo) : fromParam
  const to = activeTab === 'share' ? (toParam ?? today) : toParam
  const supabase = await createClient()

  let deals: Deal[] = []
  let investors: Investor[] = []

  if (activeTab === 'deals') {
    // All shared deals + current user's metadata (RLS filters user_deals)
    const { data } = await supabase
      .from('deals')
      .select(
        'id, created_at, company_name, website_url, linkedin_url, one_liner, sectors, stage, user_deals(id, raise_amount, currency, status, raw_source_text)',
      )
      .order('created_at', { ascending: false })
    deals = ((data as DealRow[]) || []).map(flattenDeal)
  } else if (activeTab === 'investors') {
    const { data } = await supabase
      .from('investors')
      .select()
      .order('created_at', { ascending: false })
    investors = (data as Investor[]) || []
  } else {
    // Share lists — need investors + user's active deals
    const { data: investorData } = await supabase
      .from('investors')
      .select()
      .order('contact_name')
    investors = (investorData as Investor[]) || []

    let dealsQuery = supabase
      .from('deals')
      .select(
        'id, created_at, company_name, website_url, linkedin_url, one_liner, sectors, stage, user_deals!inner(id, raise_amount, currency, status, raw_source_text)',
      )
      .eq('user_deals.status', 'active')
      .order('created_at', { ascending: false })

    if (from) dealsQuery = dealsQuery.gte('created_at', `${from}T00:00:00`)
    if (to) dealsQuery = dealsQuery.lte('created_at', `${to}T23:59:59`)

    const { data: dealData } = await dealsQuery
    deals = ((dealData as DealRow[]) || []).map(flattenDeal)
  }

  let lastSharedDates: Record<string, string> = {}
  if (activeTab === 'share') {
    lastSharedDates = await getLastSharedDates()
  }

  return (
    <div
      className={`${activeTab === 'share' ? 'max-w-5xl' : 'max-w-4xl'} mx-auto px-6 py-8 space-y-8`}
    >
      {activeTab === 'deals' ? (
        <>
          <section>
            <DealInput />
          </section>
          <section>
            <DealList deals={deals} />
          </section>
        </>
      ) : activeTab === 'investors' ? (
        <>
          <section>
            <InvestorInput />
          </section>
          <section>
            <InvestorList investors={investors} />
          </section>
        </>
      ) : (
        <>
          <DateRangeForm from={from} to={to} />
          <ShareListBuilder investors={investors} deals={deals} lastSharedDates={lastSharedDates} />
        </>
      )}
    </div>
  )
}

function DateRangeForm({ from, to }: { from?: string; to?: string }) {
  return (
    <form className="flex items-center gap-3 text-sm">
      <input type="hidden" name="tab" value="share" />
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
  )
}
