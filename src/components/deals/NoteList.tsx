'use client'

import type { DealNote } from '@/lib/supabase/types'
import { deleteNote } from '@/app/deals/[id]/actions'

type Props = {
  notes: DealNote[]
  dealId: string
}

export function NoteList({ notes, dealId }: Props) {
  if (notes.length === 0) {
    return <p className="text-secondary text-sm">No notes yet.</p>
  }

  return (
    <div className="space-y-3">
      {notes.map((note) => (
        <div key={note.id} className="border border-border rounded-lg p-4 bg-surface">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {note.summary && (
                <p className="text-sm font-medium text-foreground">{note.summary}</p>
              )}
              <p className="text-sm text-secondary mt-1 whitespace-pre-wrap">{note.content}</p>
              <p className="text-xs text-secondary mt-2">
                {new Date(note.created_at).toLocaleString()}
              </p>
            </div>
            <button
              onClick={async () => {
                if (confirm('Delete this note?')) await deleteNote(note.id, dealId)
              }}
              className="text-sm text-secondary hover:text-red-600 shrink-0"
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
