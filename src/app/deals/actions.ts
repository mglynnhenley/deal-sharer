'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { DealInsert } from '@/lib/supabase/types'

export async function saveDeal(deal: DealInsert) {
  const supabase = await createClient()
  const { error } = await supabase.from('deals').insert(deal)
  if (error) {
    return { error: error.message }
  }
  revalidatePath('/deals')
  return { success: true }
}
