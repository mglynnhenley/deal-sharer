'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { findMatchingDeal, type ExistingDeal } from '@/lib/dedup'
import type { DealInsert } from '@/lib/supabase/types'

export async function saveDeals(deals: DealInsert[]) {
  const supabase = await createClient()

  // Fetch user's fund_id for deal inserts
  const { data: profile } = await supabase
    .from('profiles')
    .select('fund_id')
    .single()
  if (!profile) return { error: 'User profile not found' }
  const fundId = profile.fund_id

  // Fetch all existing shared deals for dedup (RLS scopes to user's fund)
  const { data: existingData } = await supabase
    .from('deals')
    .select('id, company_name, website_url, linkedin_url')

  const existing: ExistingDeal[] = existingData || []
  let added = 0
  let linked = 0

  for (const deal of deals) {
    const matchId = findMatchingDeal(deal, existing)
    let dealId: string

    if (matchId) {
      dealId = matchId
      linked++
    } else {
      // Insert new shared deal
      const { data: newDeal, error } = await supabase
        .from('deals')
        .insert({
          company_name: deal.company_name,
          website_url: deal.website_url,
          linkedin_url: deal.linkedin_url,
          one_liner: deal.one_liner,
          fund_id: fundId,
        })
        .select('id')
        .single()

      if (error) return { error: error.message }
      dealId = newDeal.id

      // Track for subsequent dedup within the same batch
      existing.push({
        id: dealId,
        company_name: deal.company_name,
        website_url: deal.website_url,
        linkedin_url: deal.linkedin_url,
      })
      added++
    }

    // Insert user's deal metadata (ignore if already linked)
    const { error: udError } = await supabase.from('user_deals').insert({
      deal_id: dealId,
      one_liner: deal.one_liner,
      raise_amount: deal.raise_amount,
      currency: deal.currency || 'EUR',
      sector: deal.sector,
      priority: deal.priority,
      status: deal.status,
      raw_source_text: deal.raw_source_text,
    })

    // 23505 = unique_violation (user already has this deal)
    if (udError && udError.code !== '23505') {
      return { error: udError.message }
    }
  }

  revalidatePath('/')
  return { success: true, added, linked }
}

const SHARED_FIELDS = new Set(['company_name', 'website_url', 'linkedin_url'])
const USER_FIELDS = new Set(['one_liner', 'priority', 'status', 'sector', 'raise_amount', 'currency'])

export async function updateDeal(dealId: string, field: string, value: string | number | null) {
  if (!SHARED_FIELDS.has(field) && !USER_FIELDS.has(field)) {
    return { error: 'Invalid field' }
  }

  const supabase = await createClient()

  if (SHARED_FIELDS.has(field)) {
    // Shared fields update the deals table
    const { error } = await supabase
      .from('deals')
      .update({ [field]: value })
      .eq('id', dealId)
    if (error) return { error: error.message }
  } else {
    // Per-user fields — update or create user_deal
    const { data: existing } = await supabase
      .from('user_deals')
      .select('id')
      .eq('deal_id', dealId)
      .maybeSingle()

    if (existing) {
      const { error } = await supabase
        .from('user_deals')
        .update({ [field]: value })
        .eq('id', existing.id)
      if (error) return { error: error.message }
    } else {
      // Auto-create user_deal when user first edits a team deal
      const { error } = await supabase
        .from('user_deals')
        .insert({ deal_id: dealId, [field]: value })
      if (error) return { error: error.message }
    }
  }

  revalidatePath('/')
  return { success: true }
}

export async function deleteDeal(dealId: string) {
  const supabase = await createClient()

  // Remove the user's link to this deal (not the shared deal itself)
  const { data, error } = await supabase
    .from('user_deals')
    .delete()
    .eq('deal_id', dealId)
    .select()

  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: 'Deal not found or no permission to delete' }

  revalidatePath('/')
  return { success: true }
}

export async function addDealToMyList(dealId: string, oneLiner?: string | null) {
  const supabase = await createClient()

  const { error } = await supabase.from('user_deals').insert({
    deal_id: dealId,
    priority: 3,
    status: 'active',
    ...(oneLiner ? { one_liner: oneLiner } : {}),
  })

  if (error && error.code !== '23505') return { error: error.message }

  revalidatePath('/')
  return { success: true }
}

export async function deleteTeamDeal(dealId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('deals')
    .delete()
    .eq('id', dealId)

  if (error) return { error: error.message }

  revalidatePath('/')
  return { success: true }
}
