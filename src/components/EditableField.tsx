'use client'

import { useState, useRef, useEffect } from 'react'

type Props = {
  value: string
  onSave: (value: string) => Promise<{ error?: string }>
  type?: 'text' | 'select' | 'textarea'
  options?: { value: string; label: string }[]
  placeholder?: string
  className?: string
}

export function EditableField({ value, onSave, type = 'text', options, placeholder, className = '' }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(null)

  useEffect(() => {
    setDraft(value)
  }, [value])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
    }
  }, [editing])

  async function handleBlur() {
    setEditing(false)
    if (draft === value) return
    setSaving(true)
    const result = await onSave(draft)
    if (result.error) {
      setDraft(value)
    }
    setSaving(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setDraft(value)
      setEditing(false)
    }
  }

  if (editing) {
    const baseClass = 'w-full px-2 py-1 border border-border rounded text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-black/20'

    if (type === 'select' && options) {
      return (
        <select
          ref={inputRef as React.RefObject<HTMLSelectElement>}
          value={draft}
          onChange={(e) => { setDraft(e.target.value); }}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className={`${baseClass} ${className}`}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )
    }

    if (type === 'textarea') {
      return (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          rows={2}
          className={`${baseClass} ${className}`}
        />
      )
    }

    return (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={`${baseClass} ${className}`}
      />
    )
  }

  const displayValue = value || placeholder || '—'
  const isEmpty = !value

  return (
    <span
      onClick={() => setEditing(true)}
      className={`cursor-pointer rounded px-1 -mx-1 hover:bg-black/5 transition-colors ${
        saving ? 'opacity-50' : ''
      } ${isEmpty ? 'text-secondary italic' : ''} ${className}`}
    >
      {displayValue}
    </span>
  )
}
