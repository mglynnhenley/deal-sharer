'use client'

import { useState } from 'react'
import { VoiceRecorder } from './VoiceRecorder'
import { addNote, updateDealSummary } from '@/app/deals/[id]/actions'

type Props = {
  dealId: string
  existingSummaries: string[]
}

export function NoteInput({ dealId, existingSummaries }: Props) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleAddNote() {
    if (!text.trim()) return
    setLoading(true)
    setMessage(null)

    try {
      // Get summaries from API
      const res = await fetch('/api/summarize-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text, existingSummaries }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      // Save note to DB
      const noteResult = await addNote({
        deal_id: dealId,
        content: text,
        summary: data.noteSummary,
      })
      if (noteResult.error) throw new Error(noteResult.error)

      // Update overall summary on deal
      if (data.overallSummary) {
        await updateDealSummary(dealId, data.overallSummary)
      }

      setMessage({ type: 'success', text: 'Note added' })
      setText('')
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Failed to add note' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add a note... type or use voice"
        rows={3}
        className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-black/20 placeholder:text-secondary"
      />
      <div className="flex items-center gap-2">
        <button
          onClick={handleAddNote}
          disabled={loading || !text.trim()}
          className="px-4 py-2 bg-foreground text-background rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40"
        >
          {loading ? 'Adding...' : 'Add Note'}
        </button>
        <VoiceRecorder onTranscript={(t) => setText((prev) => prev ? prev + '\n' + t : t)} />
      </div>
      {message && (
        <p className={`text-sm ${message.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>
          {message.text}
        </p>
      )}
    </div>
  )
}
