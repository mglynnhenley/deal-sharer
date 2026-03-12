'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function saveShareRecords(
  investorId: string,
  dealIds: string[],
  batchId: string
) {
  const supabase = await createClient()

  const records = dealIds.map((dealId) => ({
    investor_id: investorId,
    deal_id: dealId,
    batch_id: batchId,
  }))

  const { error } = await supabase.from('share_records').insert(records)
  if (error) {
    return { error: error.message }
  }
  revalidatePath('/')
  revalidatePath('/history')
  return { success: true }
}

export async function getSharedDealIds(investorId: string): Promise<string[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('share_records')
    .select('deal_id')
    .eq('investor_id', investorId)

  return data?.map((r) => r.deal_id) || []
}

export async function deleteShareBatch(batchId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('share_records')
    .delete()
    .eq('batch_id', batchId)

  if (error) return { error: error.message }

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
