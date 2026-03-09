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
  revalidatePath('/share')
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
