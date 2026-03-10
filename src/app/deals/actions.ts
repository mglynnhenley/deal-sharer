'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { DealInsert } from '@/lib/supabase/types'

export async function saveDeal(deal: DealInsert) {
  const supabase = await createClient()
  const { error } = await supabase.from('deals').insert(deal)
  if (error) return { error: error.message }
  revalidatePath('/')
  return { success: true }
}

export async function saveDeals(deals: DealInsert[]) {
  const supabase = await createClient()
  const { error } = await supabase.from('deals').insert(deals)
  if (error) return { error: error.message }
  revalidatePath('/')
  return { success: true }
}

export async function updateDeal(id: string, field: string, value: string | number | null) {
  const supabase = await createClient()
  const { error } = await supabase.from('deals').update({ [field]: value }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/')
  return { success: true }
}

export async function deleteDeal(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('deals').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/')
  return { success: true }
}
