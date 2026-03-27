/** Fund — one per email domain (or one per personal-email user) */
export type Fund = {
  id: string
  domain: string | null
  is_personal: boolean
  created_at: string
}

/** User profile — links auth user to fund */
export type Profile = {
  id: string
  fund_id: string
  email_domain: string
  created_at: string
}

/** Shared deal record — visible to all fund members */
export type SharedDeal = {
  id: string
  created_at: string
  created_by: string
  fund_id: string
  company_name: string
  website_url: string | null
  linkedin_url: string | null
  one_liner: string | null
  sectors: string[]
  stage: string | null
}

/** Per-user deal metadata */
export type UserDeal = {
  id: string
  deal_id: string
  raise_amount: number | null
  currency: string | null
  status: 'active' | 'passed' | 'closed'
  raw_source_text: string | null
}

/** Combined deal view used by UI components */
export type Deal = {
  id: string
  created_at: string
  company_name: string
  website_url: string | null
  linkedin_url: string | null
  user_deal_id: string | null
  one_liner: string | null
  raise_amount: number | null
  currency: string | null
  sectors: string[]
  stage: string | null
  status: 'active' | 'passed' | 'closed'
  raw_source_text: string | null
  is_in_my_list: boolean
}

export type Investor = {
  id: string
  created_at: string
  contact_name: string
  fund_name: string | null
  email: string | null
  phone: string | null
  linkedin_url: string | null
  sharing_frequency: 'weekly' | 'bi-weekly' | 'monthly'
  sectors: string[]
  stages: string[]
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

/** Input for saving a new deal (before splitting into shared + per-user) */
export type DealInsert = {
  company_name: string
  website_url: string | null
  linkedin_url: string | null
  one_liner: string | null
  raise_amount: number | null
  currency: string | null
  sectors: string[]
  stage: string | null
  status: 'active' | 'passed' | 'closed'
  raw_source_text: string | null
}

export type InvestorInsert = Omit<Investor, 'id' | 'created_at'>

export const DEAL_STAGES = ['pre-seed', 'seed', 'series-a', 'series-b', 'series-c', 'growth'] as const
export type DealStage = (typeof DEAL_STAGES)[number]
