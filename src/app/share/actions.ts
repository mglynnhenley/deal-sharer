'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function saveShareRecords(
  investorIds: string[],
  dealIds: string[],
  batchId: string
) {
  const supabase = await createClient()

  const records = investorIds.flatMap((investorId) =>
    dealIds.map((dealId) => ({
      investor_id: investorId,
      deal_id: dealId,
      batch_id: batchId,
    }))
  )

  const { error } = await supabase.from('share_records').insert(records)
  if (error) {
    return { error: error.message }
  }
  revalidatePath('/')
  revalidatePath('/history')
  return { success: true }
}

export async function getSharedDealIdsForInvestors(investorIds: string[]): Promise<Record<string, Set<string>>> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('share_records')
    .select('investor_id, deal_id')
    .in('investor_id', investorIds)

  const result: Record<string, Set<string>> = {}
  for (const id of investorIds) result[id] = new Set()
  for (const r of data || []) {
    result[r.investor_id]?.add(r.deal_id)
  }
  return result
}

export async function deleteShareBatch(batchId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('share_records')
    .delete()
    .eq('batch_id', batchId)
    .select('id')

  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: 'Share record not found or no permission to delete' }

  revalidatePath('/')
  revalidatePath('/history')
  return { success: true }
}

export async function getLastSharedDates(): Promise<Record<string, string>> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('share_records')
    .select('investor_id, created_at')
    .order('created_at', { ascending: false })

  if (!data) return {}

  const result: Record<string, string> = {}
  for (const row of data) {
    if (!result[row.investor_id]) {
      result[row.investor_id] = row.created_at
    }
  }
  return result
}
