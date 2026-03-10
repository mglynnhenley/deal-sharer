'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { DealNoteInsert } from '@/lib/supabase/types'

export async function addNote(note: DealNoteInsert) {
  const supabase = await createClient()
  const { error } = await supabase.from('deal_notes').insert(note)
  if (error) return { error: error.message }
  revalidatePath(`/deals/${note.deal_id}`)
  return { success: true }
}

export async function deleteNote(noteId: string, dealId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('deal_notes').delete().eq('id', noteId)
  if (error) return { error: error.message }
  revalidatePath(`/deals/${dealId}`)
  return { success: true }
}

export async function updateDealSummary(dealId: string, summary: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('deals').update({ notes_summary: summary }).eq('id', dealId)
  if (error) return { error: error.message }
  revalidatePath(`/deals/${dealId}`)
  return { success: true }
}
