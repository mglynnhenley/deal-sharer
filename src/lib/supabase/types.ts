export type Deal = {
  id: string
  created_at: string
  company_name: string
  website_url: string | null
  one_liner: string | null
  raise_amount: number | null
  currency: string | null
  sector: string | null
  priority: 1 | 2 | 3
  status: 'active' | 'passed' | 'closed'
  raw_source_text: string | null
}

export type Investor = {
  id: string
  created_at: string
  contact_name: string
  fund_name: string | null
  email: string | null
  priority_threshold: 1 | 2 | 3
  sharing_frequency: 'weekly' | 'bi-weekly' | 'monthly'
  thesis_description: string | null
  raw_source_text: string | null
}

export type ShareRecord = {
  id: string
  created_at: string
  investor_id: string
  deal_id: string
  batch_id: string
}

export type DealInsert = Omit<Deal, 'id' | 'created_at'>
export type InvestorInsert = Omit<Investor, 'id' | 'created_at'>
