'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { InvestorInsert } from '@/lib/supabase/types'

export async function saveInvestor(investor: InvestorInsert) {
  const supabase = await createClient()
  const { error } = await supabase.from('investors').insert(investor)
  if (error) {
    return { error: error.message }
  }
  revalidatePath('/investors')
  return { success: true }
}
