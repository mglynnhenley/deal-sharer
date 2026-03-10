'use client'

import { useRouter, useSearchParams } from 'next/navigation'

const tabs = [
  { key: 'deals', label: 'Deals' },
  { key: 'investors', label: 'Investors' },
]

export function TabSwitcher({ activeTab }: { activeTab: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function handleTabClick(key: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', key)
    router.push(`/?${params.toString()}`)
  }

  return (
    <div className="flex gap-1 border-b border-border">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => handleTabClick(tab.key)}
          className={`px-4 py-2.5 text-sm font-medium -mb-px transition-colors ${
            activeTab === tab.key
              ? 'text-foreground border-b-2 border-foreground'
              : 'text-secondary hover:text-foreground'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
