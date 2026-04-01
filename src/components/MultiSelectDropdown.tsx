'use client'

import { useState, useRef, useEffect } from 'react'

type Props = {
  options: readonly string[]
  selected: string[]
  onChange: (selected: string[]) => void
  placeholder?: string
  className?: string
}

export function MultiSelectDropdown({ options, selected, onChange, placeholder = 'Select...', className }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((s) => s !== value))
    } else {
      onChange([...selected, value])
    }
  }

  // Show legacy values (not in options) at the top
  const legacy = selected.filter((s) => !options.includes(s))
  const allOptions = [...legacy, ...options]

  return (
    <div ref={ref} className={`relative inline-block ${className ?? ''}`}>
      <div className="flex items-center gap-1.5 flex-wrap">
        {selected.map((s) => (
          <span
            key={s}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-lg bg-accent-light text-accent border border-accent/30"
          >
            {s}
            <button
              type="button"
              onClick={() => onChange(selected.filter((v) => v !== s))}
              className="hover:text-accent/70"
            >
              &times;
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="px-2.5 py-1 text-xs rounded-lg border transition-colors text-left flex items-center gap-1 bg-surface text-secondary border-border hover:border-accent/30"
        >
          <span>{placeholder}</span>
          <svg className="w-3 h-3 shrink-0 opacity-60" viewBox="0 0 12 12" fill="none">
            <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="absolute z-50 mt-1 min-w-[200px] max-h-[240px] overflow-y-auto bg-surface border border-border rounded-lg shadow-lg py-1">
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="w-full text-left px-3 py-1.5 text-xs text-secondary hover:bg-muted"
            >
              Clear all
            </button>
          )}
          {allOptions.map((opt) => {
            const checked = selected.includes(opt)
            const isLegacy = legacy.includes(opt)
            return (
              <label
                key={opt}
                className="flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-muted"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(opt)}
                  className="accent-accent"
                />
                <span className={isLegacy ? 'italic text-secondary' : 'text-foreground'}>{opt}</span>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}
