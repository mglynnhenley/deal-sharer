'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { InvestorInsert } from '@/lib/supabase/types'

export async function saveInvestor(investor: InvestorInsert) {
  const supabase = await createClient()
  const { error } = await supabase.from('investors').insert(investor)
  if (error) return { error: error.message }
  revalidatePath('/')
  return { success: true }
}

export async function saveInvestors(investors: InvestorInsert[]) {
  const supabase = await createClient()
  const { error } = await supabase.from('investors').insert(investors)
  if (error) return { error: error.message }
  revalidatePath('/')
  return { success: true }
}

export async function updateInvestor(id: string, field: string, value: string | number | string[] | null) {
  const supabase = await createClient()
  const { error } = await supabase.from('investors').update({ [field]: value }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/')
  return { success: true }
}

export async function deleteInvestor(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('investors').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/')
  return { success: true }
}
