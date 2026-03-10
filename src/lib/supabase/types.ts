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
  notes_summary: string | null
}

export type Investor = {
  id: string
  created_at: string
  contact_name: string
  fund_name: string | null
  email: string | null
  linkedin_url: string | null
  priority_threshold: 1 | 2 | 3
  sharing_frequency: 'weekly' | 'bi-weekly' | 'monthly'
  sectors: string[]
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

export type DealNote = {
  id: string
  deal_id: string
  content: string
  summary: string | null
  created_at: string
}

export type DealInsert = Omit<Deal, 'id' | 'created_at'>
export type DealNoteInsert = Omit<DealNote, 'id' | 'created_at'>
export type InvestorInsert = Omit<Investor, 'id' | 'created_at'>
