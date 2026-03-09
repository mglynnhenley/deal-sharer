'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

export function DealFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [from, setFrom] = useState(searchParams.get('from') || '')
  const [to, setTo] = useState(searchParams.get('to') || '')

  function applyFilters() {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    router.push(`/deals?${params.toString()}`)
  }

  function clearFilters() {
    setFrom('')
    setTo('')
    router.push('/deals')
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <label className="text-gray-600">From:</label>
      <input
        type="date"
        value={from}
        onChange={(e) => setFrom(e.target.value)}
        className="px-2 py-1 border rounded"
      />
      <label className="text-gray-600">To:</label>
      <input
        type="date"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        className="px-2 py-1 border rounded"
      />
      <button onClick={applyFilters} className="px-3 py-1 bg-black text-white rounded hover:bg-gray-800">
        Filter
      </button>
      {(from || to) && (
        <button onClick={clearFilters} className="px-3 py-1 border rounded hover:bg-gray-50">
          Clear
        </button>
      )}
    </div>
  )
}
