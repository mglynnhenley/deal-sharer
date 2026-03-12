'use client'

import { useRouter } from 'next/navigation'
import { deleteShareBatch } from '@/app/share/actions'
import type { HistoryBatch } from './page'

export function HistoryList({ batches }: { batches: HistoryBatch[] }) {
  const router = useRouter()

  if (batches.length === 0) {
    return <p className="text-secondary text-sm">No share history yet.</p>
  }

  async function handleDelete(batchId: string) {
    if (!confirm('Delete this share record?')) return
    const result = await deleteShareBatch(batchId)
    if (result.error) alert(result.error)
    else router.refresh()
  }

  return (
    <div className="space-y-3">
      {batches.map((batch) => (
        <div key={batch.batchId} className="border border-border rounded-lg p-4 bg-surface">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-foreground">{batch.investor}</span>
              <span className="text-xs text-secondary">{batch.date}</span>
              <span className="text-xs text-secondary">{batch.deals.length} deal{batch.deals.length > 1 ? 's' : ''}</span>
            </div>
            <button
              onClick={() => handleDelete(batch.batchId)}
              className="text-xs text-secondary hover:text-accent"
            >
              Delete
            </button>
          </div>
          <ul className="text-sm text-secondary space-y-1">
            {batch.deals.map((d, i) => <li key={i}>{d}</li>)}
          </ul>
        </div>
      ))}
    </div>
  )
}
