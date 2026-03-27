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

export function EditableField({
  value,
  onSave,
  type = 'text',
  options,
  placeholder,
  className = '',
}: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(null)

  useEffect(() => setDraft(value), [value])
  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  async function handleBlur() {
    setEditing(false)
    if (draft === value) return
    setSaving(true)
    const result = await onSave(draft)
    if (result.error) {
      alert(result.error)
      setDraft(value)
    }
    setSaving(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { setDraft(value); setEditing(false) }
  }

  if (editing) {
    const inputClass = `w-full px-2 py-1 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-accent/20 ${className}`

    if (type === 'select' && options) {
      return (
        <select ref={inputRef as React.RefObject<HTMLSelectElement>} value={draft}
          onChange={(e) => {
            const newVal = e.target.value
            setDraft(newVal)
            setEditing(false)
            if (newVal !== value) {
              setSaving(true)
              onSave(newVal).then((result) => {
                if (result.error) {
                  alert(result.error)
                  setDraft(value)
                }
                setSaving(false)
              })
            }
          }}
          onBlur={() => setEditing(false)} onKeyDown={handleKeyDown}
          className={inputClass}>
          {options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      )
    }

    if (type === 'textarea') {
      return (
        <textarea ref={inputRef as React.RefObject<HTMLTextAreaElement>} value={draft}
          onChange={(e) => setDraft(e.target.value)} onBlur={handleBlur} onKeyDown={handleKeyDown}
          rows={2} className={inputClass} />
      )
    }

    return (
      <input ref={inputRef as React.RefObject<HTMLInputElement>} value={draft}
        onChange={(e) => setDraft(e.target.value)} onBlur={handleBlur} onKeyDown={handleKeyDown}
        className={inputClass} />
    )
  }

  const displayValue = value || placeholder || '—'
  const isEmpty = !value

  return (
    <span
      onClick={() => setEditing(true)}
      className={`cursor-pointer rounded px-1 -mx-1 hover:bg-muted ${saving ? 'opacity-50' : ''} ${isEmpty ? 'text-secondary italic' : ''} ${className}`}
    >
      {displayValue}
    </span>
  )
}
