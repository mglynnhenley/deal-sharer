# UI Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the Deal Sharer UI with Anthropic-inspired visuals, tabbed home page, batch extraction without confirmation, and inline editing.

**Architecture:** Evolve existing components in-place. Replace review card confirmation flow with direct DB saves + inline editing on list items. Merge deals/investors into a tabbed home page. Update color palette and spacing across all components.

**Tech Stack:** Next.js App Router, Tailwind CSS 4, Supabase, OpenAI GPT-4o, React server actions

---

### Task 1: Update global styles and color palette

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx:28-29`

**Step 1: Update globals.css with warm palette**

Replace `src/app/globals.css` entirely with:

```css
@import "tailwindcss";

:root {
  --background: #FAF9F7;
  --foreground: #1A1A1A;
  --secondary: #555555;
  --surface: #FFFFFF;
  --border: #E5E5E3;
  --accent: #000000;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-secondary: var(--secondary);
  --color-surface: var(--surface);
  --color-border: var(--border);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans), Arial, Helvetica, sans-serif;
}
```

**Step 2: Update layout.tsx body class**

In `src/app/layout.tsx`, change line 29 from:
```tsx
className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50`}
```
to:
```tsx
className={`${geistSans.variable} ${geistMono.variable} antialiased`}
```

(The background color now comes from the CSS variable.)

**Step 3: Verify dev server loads without errors**

Run: `npm run dev` and check localhost:3000 loads with warm off-white background.

**Step 4: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx
git commit -m "style: update color palette to warm Anthropic-inspired tones"
```

---

### Task 2: Update Nav component styling

**Files:**
- Modify: `src/components/Nav.tsx`

**Step 1: Update Nav with better contrast and styling**

Replace `src/components/Nav.tsx` entirely with:

```tsx
'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { logout } from '@/app/login/actions'

const links = [
  { href: '/', param: 'deals', label: 'Deals' },
  { href: '/', param: 'investors', label: 'Investors' },
  { href: '/share', label: 'Share Lists' },
  { href: '/history', label: 'History' },
]

export function Nav() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentTab = searchParams.get('tab') || 'deals'

  if (pathname === '/login') return null

  function isActive(link: typeof links[number]) {
    if (link.param) {
      return pathname === '/' && currentTab === link.param
    }
    return pathname.startsWith(link.href)
  }

  function getHref(link: typeof links[number]) {
    if (link.param) return `/?tab=${link.param}`
    return link.href
  }

  return (
    <nav className="border-b border-border bg-surface">
      <div className="max-w-4xl mx-auto px-6 flex items-center justify-between h-14">
        <div className="flex items-center gap-6">
          <span className="font-bold text-foreground">Deal Sharer</span>
          {links.map((link) => (
            <Link
              key={link.label}
              href={getHref(link)}
              className={`text-sm ${
                isActive(link)
                  ? 'text-foreground font-medium'
                  : 'text-secondary hover:text-foreground'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
        <form action={logout}>
          <button type="submit" className="text-sm text-secondary hover:text-foreground">
            Log out
          </button>
        </form>
      </div>
    </nav>
  )
}
```

**Step 2: Verify nav renders, tabs highlight correctly**

Run: check localhost:3000 — Nav should show with warm colors, "Deals" and "Investors" link to `/?tab=deals` and `/?tab=investors`.

**Step 3: Commit**

```bash
git add src/components/Nav.tsx
git commit -m "style: update Nav with tab-aware links and warm palette"
```

---

### Task 3: Add server actions for update and delete

**Files:**
- Modify: `src/app/deals/actions.ts`
- Modify: `src/app/investors/actions.ts`

**Step 1: Add updateDeal, deleteDeal to deals/actions.ts**

Replace `src/app/deals/actions.ts` entirely with:

```ts
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
```

**Step 2: Add updateInvestor, deleteInvestor, saveInvestors to investors/actions.ts**

Replace `src/app/investors/actions.ts` entirely with:

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { InvestorInsert } from '@/lib/supabase/types'

export async function saveInvestor(investor: InvestorInsert) {
  const supabase = await createClient()
  const { error } = await supabase.from('investors').insert(investor)
  if (error) return { error: error.message }
  revalidatePath('/')
  return { success: true }
}

export async function saveInvestors(investors: InvestorInsert[]) {
  const supabase = await createClient()
  const { error } = await supabase.from('investors').insert(investors)
  if (error) return { error: error.message }
  revalidatePath('/')
  return { success: true }
}

export async function updateInvestor(id: string, field: string, value: string | number | string[] | null) {
  const supabase = await createClient()
  const { error } = await supabase.from('investors').update({ [field]: value }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/')
  return { success: true }
}

export async function deleteInvestor(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('investors').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/')
  return { success: true }
}
```

**Step 3: Commit**

```bash
git add src/app/deals/actions.ts src/app/investors/actions.ts
git commit -m "feat: add update, delete, and batch save server actions"
```

---

### Task 4: Update investor extraction to batch mode

**Files:**
- Modify: `src/lib/extraction/investors.ts`
- Modify: `src/app/api/extract-investor/route.ts`
- Modify: `src/test/extraction/investors.test.ts`

**Step 1: Update the investor extraction tests for batch parsing**

Replace `src/test/extraction/investors.test.ts` with:

```ts
import { describe, it, expect } from 'vitest'
import { parseInvestorsFromLLMResponse } from '@/lib/extraction/investors'

describe('parseInvestorsFromLLMResponse', () => {
  it('parses an array of investors from LLM output', () => {
    const llmOutput = JSON.stringify([
      {
        contact_name: 'Sarah',
        fund_name: 'Northzone',
        email: null,
        linkedin_url: 'https://linkedin.com/in/sarah',
        sectors: ['AI/ML', 'Developer Tools'],
        thesis_description: 'Seed/Series A in Europe',
      },
      {
        contact_name: 'John',
        fund_name: 'Acme Ventures',
        email: 'john@acme.vc',
        linkedin_url: null,
        sectors: ['SaaS'],
        thesis_description: 'Early stage B2B SaaS',
      },
    ])

    const result = parseInvestorsFromLLMResponse(llmOutput)
    expect(result).toHaveLength(2)
    expect(result[0].contact_name).toBe('Sarah')
    expect(result[0].linkedin_url).toBe('https://linkedin.com/in/sarah')
    expect(result[0].sectors).toEqual(['AI/ML', 'Developer Tools'])
    expect(result[1].contact_name).toBe('John')
    expect(result[1].email).toBe('john@acme.vc')
  })

  it('handles markdown-wrapped output', () => {
    const llmOutput = '```json\n' + JSON.stringify([
      {
        contact_name: 'Ana',
        fund_name: 'Nauta',
        email: null,
        linkedin_url: null,
        sectors: [],
        thesis_description: null,
      },
    ]) + '\n```'

    const result = parseInvestorsFromLLMResponse(llmOutput)
    expect(result).toHaveLength(1)
    expect(result[0].contact_name).toBe('Ana')
  })

  it('wraps a single object response into an array', () => {
    const llmOutput = JSON.stringify({
      contact_name: 'Solo',
      fund_name: null,
      email: null,
      linkedin_url: null,
      sectors: [],
      thesis_description: null,
    })

    const result = parseInvestorsFromLLMResponse(llmOutput)
    expect(result).toHaveLength(1)
    expect(result[0].contact_name).toBe('Solo')
  })

  it('returns empty array for unparseable output', () => {
    expect(parseInvestorsFromLLMResponse('garbage')).toEqual([])
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/extraction/investors.test.ts`
Expected: FAIL — `parseInvestorsFromLLMResponse` does not exist yet.

**Step 3: Update investor extraction to return array**

Replace `src/lib/extraction/investors.ts` with:

```ts
export type ExtractedInvestor = {
  contact_name: string
  fund_name: string | null
  email: string | null
  linkedin_url: string | null
  sectors: string[]
  thesis_description: string | null
}

export function parseInvestorsFromLLMResponse(output: string): ExtractedInvestor[] {
  let cleaned = output.trim()
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim()
  }

  try {
    const parsed = JSON.parse(cleaned)
    const items = Array.isArray(parsed) ? parsed : [parsed]
    return items
      .filter((p: Record<string, unknown>) => p.contact_name)
      .map((p: Record<string, unknown>) => ({
        contact_name: String(p.contact_name),
        fund_name: p.fund_name ? String(p.fund_name) : null,
        email: p.email ? String(p.email) : null,
        linkedin_url: p.linkedin_url ? String(p.linkedin_url) : null,
        sectors: Array.isArray(p.sectors) ? p.sectors.map(String) : [],
        thesis_description: p.thesis_description ? String(p.thesis_description) : null,
      }))
  } catch {
    return []
  }
}

export const INVESTOR_EXTRACTION_PROMPT = `You are an investor profile extraction assistant. Given a natural language description of one or more investors, extract each investor's details into a structured JSON array.

For each investor, extract:
- contact_name: the person's name
- fund_name: the fund or firm name (if mentioned)
- email: their email address (if mentioned)
- linkedin_url: their LinkedIn profile URL (if mentioned)
- sectors: an array of sector interests (e.g., ["AI/ML", "SaaS"]). Empty array if not mentioned.
- thesis_description: a summary of their investment thesis (if mentioned)

Return ONLY a JSON array of objects. No other text.

Example output:
[
  {
    "contact_name": "Sarah",
    "fund_name": "Northzone",
    "email": null,
    "linkedin_url": null,
    "sectors": ["AI/ML", "Developer Tools"],
    "thesis_description": "Seed/Series A in Europe"
  }
]`
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/test/extraction/investors.test.ts`
Expected: PASS — all 4 tests pass.

**Step 5: Update the API route to return array**

Replace `src/app/api/extract-investor/route.ts` with:

```ts
import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { parseInvestorsFromLLMResponse, INVESTOR_EXTRACTION_PROMPT } from '@/lib/extraction/investors'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

export async function POST(request: NextRequest) {
  const { text } = await request.json()

  if (!text || typeof text !== 'string') {
    return NextResponse.json({ error: 'text field is required' }, { status: 400 })
  }

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 4096,
    messages: [
      { role: 'system', content: INVESTOR_EXTRACTION_PROMPT },
      { role: 'user', content: `Here is the description:\n\n${text}` },
    ],
  })

  const content = completion.choices[0]?.message?.content
  if (!content) {
    return NextResponse.json({ error: 'Unexpected response format' }, { status: 500 })
  }

  const investors = parseInvestorsFromLLMResponse(content)
  return NextResponse.json({ investors })
}
```

**Step 6: Commit**

```bash
git add src/lib/extraction/investors.ts src/app/api/extract-investor/route.ts src/test/extraction/investors.test.ts
git commit -m "feat: update investor extraction to batch mode (array response)"
```

---

### Task 5: Create EditableField component

**Files:**
- Create: `src/components/EditableField.tsx`

**Step 1: Create the inline-editable field component**

Create `src/components/EditableField.tsx`:

```tsx
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
```

**Step 2: Commit**

```bash
git add src/components/EditableField.tsx
git commit -m "feat: add EditableField component for inline editing"
```

---

### Task 6: Create DealList component with weekly grouping and inline editing

**Files:**
- Create: `src/components/deals/DealList.tsx`

**Step 1: Create the DealList component**

Create `src/components/deals/DealList.tsx`:

```tsx
'use client'

import type { Deal } from '@/lib/supabase/types'
import { EditableField } from '@/components/EditableField'
import { updateDeal, deleteDeal } from '@/app/deals/actions'

type WeekGroup = {
  label: string
  deals: Deal[]
}

function getWeekLabel(date: Date): string {
  const now = new Date()
  const startOfThisWeek = new Date(now)
  startOfThisWeek.setDate(now.getDate() - now.getDay() + 1)
  startOfThisWeek.setHours(0, 0, 0, 0)

  const startOfLastWeek = new Date(startOfThisWeek)
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 7)

  if (date >= startOfThisWeek) return 'This Week'
  if (date >= startOfLastWeek) return 'Last Week'

  const weekStart = new Date(date)
  weekStart.setDate(date.getDate() - date.getDay() + 1)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)

  const fmt = (d: Date) => d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })
  return `${fmt(weekStart)} – ${fmt(weekEnd)}`
}

function groupByWeek(deals: Deal[]): WeekGroup[] {
  const groups = new Map<string, Deal[]>()
  const order: string[] = []

  for (const deal of deals) {
    const label = getWeekLabel(new Date(deal.created_at))
    if (!groups.has(label)) {
      groups.set(label, [])
      order.push(label)
    }
    groups.get(label)!.push(deal)
  }

  return order.map((label) => {
    const weekDeals = groups.get(label)!
    weekDeals.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    return { label, deals: weekDeals }
  })
}

const priorityOptions = [
  { value: '1', label: 'P1 — Top' },
  { value: '2', label: 'P2 — Good' },
  { value: '3', label: 'P3 — Interesting' },
]

const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'passed', label: 'Passed' },
  { value: 'closed', label: 'Closed' },
]

function priorityBadgeClass(p: number) {
  if (p === 1) return 'bg-amber-100 text-amber-900'
  if (p === 2) return 'bg-gray-100 text-gray-800'
  return 'bg-gray-50 text-gray-600'
}

export function DealList({ deals }: { deals: Deal[] }) {
  const groups = groupByWeek(deals)

  if (deals.length === 0) {
    return <p className="text-secondary text-sm">No deals yet.</p>
  }

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <div key={group.label}>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-sm font-semibold text-foreground">{group.label}</h3>
            <span className="text-sm text-secondary">{group.deals.length}</span>
          </div>
          <div className="space-y-2">
            {group.deals.map((deal) => (
              <DealRow key={deal.id} deal={deal} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function DealRow({ deal }: { deal: Deal }) {
  async function handleUpdate(field: string, value: string) {
    let parsed: string | number | null = value || null
    if (field === 'priority') parsed = parseInt(value)
    if (field === 'raise_amount') parsed = value ? parseFloat(value) : null
    return updateDeal(deal.id, field, parsed)
  }

  return (
    <div className="border border-border rounded-lg p-4 bg-surface">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-base text-foreground">
              <EditableField
                value={deal.company_name}
                onSave={(v) => handleUpdate('company_name', v)}
              />
            </span>
            <EditableField
              value={String(deal.priority)}
              onSave={(v) => handleUpdate('priority', v)}
              type="select"
              options={priorityOptions}
              className={`text-xs font-medium px-2 py-0.5 rounded ${priorityBadgeClass(deal.priority)}`}
            />
            {deal.sector && (
              <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-50 text-blue-800">
                <EditableField
                  value={deal.sector}
                  onSave={(v) => handleUpdate('sector', v)}
                />
              </span>
            )}
            <EditableField
              value={deal.status}
              onSave={(v) => handleUpdate('status', v)}
              type="select"
              options={statusOptions}
              className="text-xs text-secondary"
            />
          </div>
          <div className="mt-1.5">
            <EditableField
              value={deal.one_liner || ''}
              onSave={(v) => handleUpdate('one_liner', v)}
              placeholder="Add a one-liner..."
              className="text-sm text-secondary"
            />
          </div>
          {deal.website_url && (
            <div className="mt-1">
              <a href={deal.website_url} target="_blank" rel="noopener noreferrer"
                 className="text-sm text-blue-700 hover:underline">
                {deal.website_url}
              </a>
            </div>
          )}
        </div>
        <button
          onClick={async () => { if (confirm('Delete this deal?')) await deleteDeal(deal.id) }}
          className="text-sm text-secondary hover:text-red-600 shrink-0"
        >
          Delete
        </button>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/deals/DealList.tsx
git commit -m "feat: add DealList component with weekly grouping and inline editing"
```

---

### Task 7: Create InvestorList component with inline editing

**Files:**
- Create: `src/components/investors/InvestorList.tsx`

**Step 1: Create the InvestorList component**

Create `src/components/investors/InvestorList.tsx`:

```tsx
'use client'

import type { Investor } from '@/lib/supabase/types'
import { EditableField } from '@/components/EditableField'
import { updateInvestor, deleteInvestor } from '@/app/investors/actions'

const thresholdOptions = [
  { value: '1', label: 'P1 only (top deals)' },
  { value: '2', label: 'P1–2 (top + good)' },
  { value: '3', label: 'P1–3 (everything)' },
]

const frequencyOptions = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'bi-weekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
]

function thresholdBadgeClass(t: number) {
  if (t === 1) return 'bg-amber-100 text-amber-900'
  if (t === 2) return 'bg-gray-100 text-gray-800'
  return 'bg-gray-50 text-gray-600'
}

export function InvestorList({ investors }: { investors: Investor[] }) {
  if (investors.length === 0) {
    return <p className="text-secondary text-sm">No investors yet.</p>
  }

  return (
    <div className="space-y-2">
      {investors.map((inv) => (
        <InvestorRow key={inv.id} investor={inv} />
      ))}
    </div>
  )
}

function InvestorRow({ investor }: { investor: Investor }) {
  async function handleUpdate(field: string, value: string) {
    let parsed: string | number | string[] | null = value || null
    if (field === 'priority_threshold') parsed = parseInt(value)
    if (field === 'sectors') parsed = value ? value.split(',').map((s) => s.trim()).filter(Boolean) : []
    return updateInvestor(investor.id, field, parsed)
  }

  return (
    <div className="border border-border rounded-lg p-4 bg-surface">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-base text-foreground">
              <EditableField
                value={investor.contact_name}
                onSave={(v) => handleUpdate('contact_name', v)}
              />
            </span>
            {investor.fund_name && (
              <span className="text-sm text-secondary">
                @ <EditableField
                  value={investor.fund_name}
                  onSave={(v) => handleUpdate('fund_name', v)}
                />
              </span>
            )}
            <EditableField
              value={String(investor.priority_threshold)}
              onSave={(v) => handleUpdate('priority_threshold', v)}
              type="select"
              options={thresholdOptions}
              className={`text-xs font-medium px-2 py-0.5 rounded ${thresholdBadgeClass(investor.priority_threshold)}`}
            />
            <EditableField
              value={investor.sharing_frequency}
              onSave={(v) => handleUpdate('sharing_frequency', v)}
              type="select"
              options={frequencyOptions}
              className="text-xs text-secondary"
            />
          </div>
          {investor.sectors && investor.sectors.length > 0 && (
            <div className="flex gap-1 mt-1.5 flex-wrap">
              {investor.sectors.map((s) => (
                <span key={s} className="text-xs font-medium px-2 py-0.5 rounded bg-blue-50 text-blue-800">
                  {s}
                </span>
              ))}
            </div>
          )}
          {investor.thesis_description && (
            <div className="mt-1.5">
              <EditableField
                value={investor.thesis_description}
                onSave={(v) => handleUpdate('thesis_description', v)}
                placeholder="Add thesis notes..."
                className="text-sm text-secondary"
              />
            </div>
          )}
          <div className="flex gap-3 mt-1.5">
            {investor.email && (
              <span className="text-sm text-secondary">
                <EditableField
                  value={investor.email}
                  onSave={(v) => handleUpdate('email', v)}
                  placeholder="Add email..."
                />
              </span>
            )}
            {investor.linkedin_url && (
              <a href={investor.linkedin_url} target="_blank" rel="noopener noreferrer"
                 className="text-sm text-blue-700 hover:underline">
                LinkedIn
              </a>
            )}
          </div>
        </div>
        <button
          onClick={async () => { if (confirm('Delete this investor?')) await deleteInvestor(investor.id) }}
          className="text-sm text-secondary hover:text-red-600 shrink-0"
        >
          Delete
        </button>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/investors/InvestorList.tsx
git commit -m "feat: add InvestorList component with inline editing"
```

---

### Task 8: Update DealInput to save directly without review cards

**Files:**
- Modify: `src/components/deals/DealInput.tsx`

**Step 1: Rewrite DealInput to skip review, save directly**

Replace `src/components/deals/DealInput.tsx` with:

```tsx
'use client'

import { useState } from 'react'
import { saveDeals } from '@/app/deals/actions'
import { VoiceRecorder } from './VoiceRecorder'

export function DealInput() {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleExtract() {
    if (!text.trim()) return
    setLoading(true)
    setMessage(null)

    try {
      const res = await fetch('/api/extract-deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      if (!data.deals || data.deals.length === 0) {
        setMessage({ type: 'error', text: 'No deals found in that text.' })
        return
      }

      const dealsToSave = data.deals.map((d: Record<string, unknown>) => ({
        company_name: d.company_name,
        website_url: d.website_url || null,
        one_liner: d.one_liner || null,
        sector: d.sector || null,
        raise_amount: d.raise_amount || null,
        currency: d.currency || 'EUR',
        priority: 3,
        status: 'active' as const,
        raw_source_text: text,
      }))

      const result = await saveDeals(dealsToSave)
      if (result.error) throw new Error(result.error)

      setMessage({ type: 'success', text: `${dealsToSave.length} deal${dealsToSave.length > 1 ? 's' : ''} added` })
      setText('')
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Extraction failed' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste deal info here — transcripts, emails, notes..."
        rows={4}
        className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-black/20 placeholder:text-secondary"
      />
      <div className="flex items-center gap-2">
        <button
          onClick={handleExtract}
          disabled={loading || !text.trim()}
          className="px-4 py-2 bg-foreground text-background rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40"
        >
          {loading ? 'Extracting...' : 'Extract Deals'}
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
```

**Step 2: Commit**

```bash
git add src/components/deals/DealInput.tsx
git commit -m "feat: DealInput saves directly to DB without review cards"
```

---

### Task 9: Update InvestorInput for batch extraction and direct save

**Files:**
- Modify: `src/components/investors/InvestorInput.tsx`

**Step 1: Rewrite InvestorInput for batch mode and direct save**

Replace `src/components/investors/InvestorInput.tsx` with:

```tsx
'use client'

import { useState } from 'react'
import { saveInvestors } from '@/app/investors/actions'

export function InvestorInput() {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleExtract() {
    if (!text.trim()) return
    setLoading(true)
    setMessage(null)

    try {
      const res = await fetch('/api/extract-investor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      if (!data.investors || data.investors.length === 0) {
        setMessage({ type: 'error', text: 'No investors found in that text.' })
        return
      }

      const investorsToSave = data.investors.map((inv: Record<string, unknown>) => ({
        contact_name: inv.contact_name,
        fund_name: inv.fund_name || null,
        email: inv.email || null,
        linkedin_url: inv.linkedin_url || null,
        sectors: Array.isArray(inv.sectors) ? inv.sectors : [],
        thesis_description: inv.thesis_description || null,
        priority_threshold: 3 as const,
        sharing_frequency: 'weekly' as const,
        raw_source_text: text,
      }))

      const result = await saveInvestors(investorsToSave)
      if (result.error) throw new Error(result.error)

      setMessage({ type: 'success', text: `${investorsToSave.length} investor${investorsToSave.length > 1 ? 's' : ''} added` })
      setText('')
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Extraction failed' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Describe investors... e.g. 'Ana @ Nauta, Bodi @ Heartcore, Oskar @ Project A'"
        rows={4}
        className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-black/20 placeholder:text-secondary"
      />
      <div className="flex items-center gap-2">
        <button
          onClick={handleExtract}
          disabled={loading || !text.trim()}
          className="px-4 py-2 bg-foreground text-background rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40"
        >
          {loading ? 'Extracting...' : 'Extract Investors'}
        </button>
      </div>
      {message && (
        <p className={`text-sm ${message.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>
          {message.text}
        </p>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/investors/InvestorInput.tsx
git commit -m "feat: InvestorInput batch extraction with direct DB save"
```

---

### Task 10: Create tabbed home page

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Replace redirect with tabbed home page**

Replace `src/app/page.tsx` with:

```tsx
import { createClient } from '@/lib/supabase/server'
import { DealInput } from '@/components/deals/DealInput'
import { DealList } from '@/components/deals/DealList'
import { InvestorInput } from '@/components/investors/InvestorInput'
import { InvestorList } from '@/components/investors/InvestorList'
import type { Deal, Investor } from '@/lib/supabase/types'
import { TabSwitcher } from '@/components/TabSwitcher'

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  const activeTab = tab === 'investors' ? 'investors' : 'deals'
  const supabase = await createClient()

  let deals: Deal[] = []
  let investors: Investor[] = []

  if (activeTab === 'deals') {
    const { data } = await supabase
      .from('deals')
      .select()
      .order('created_at', { ascending: false })
    deals = (data as Deal[]) || []
  } else {
    const { data } = await supabase
      .from('investors')
      .select()
      .order('priority_threshold', { ascending: true })
      .order('created_at', { ascending: false })
    investors = (data as Investor[]) || []
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
      <TabSwitcher activeTab={activeTab} />

      {activeTab === 'deals' ? (
        <>
          <section>
            <DealInput />
          </section>
          <section>
            <DealList deals={deals} />
          </section>
        </>
      ) : (
        <>
          <section>
            <InvestorInput />
          </section>
          <section>
            <InvestorList investors={investors} />
          </section>
        </>
      )}
    </div>
  )
}
```

**Step 2: Create TabSwitcher component**

Create `src/components/TabSwitcher.tsx`:

```tsx
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
```

**Step 3: Commit**

```bash
git add src/app/page.tsx src/components/TabSwitcher.tsx
git commit -m "feat: tabbed home page with deals and investors"
```

---

### Task 11: Update deals and investors route pages to redirect

**Files:**
- Modify: `src/app/deals/page.tsx`
- Modify: `src/app/investors/page.tsx`

**Step 1: Update deals page to redirect to home**

Replace `src/app/deals/page.tsx` with:

```tsx
import { redirect } from 'next/navigation'

export default function DealsPage() {
  redirect('/?tab=deals')
}
```

**Step 2: Update investors page to redirect to home**

Replace `src/app/investors/page.tsx` with:

```tsx
import { redirect } from 'next/navigation'

export default function InvestorsPage() {
  redirect('/?tab=investors')
}
```

**Step 3: Commit**

```bash
git add src/app/deals/page.tsx src/app/investors/page.tsx
git commit -m "refactor: redirect /deals and /investors to tabbed home page"
```

---

### Task 12: Update VoiceRecorder styling and delete unused review card components

**Files:**
- Modify: `src/components/deals/VoiceRecorder.tsx`
- Delete: `src/components/deals/DealReviewCard.tsx`
- Delete: `src/components/investors/InvestorReviewCard.tsx`
- Delete: `src/components/deals/DealFilters.tsx`

**Step 1: Update VoiceRecorder with warm styling**

Replace `src/components/deals/VoiceRecorder.tsx` with:

```tsx
'use client'

import { useState, useRef } from 'react'

type Props = {
  onTranscript: (text: string) => void
}

export function VoiceRecorder({ onTranscript }: Props) {
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop())
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType })
        await transcribe(blob)
      }

      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start()
      setRecording(true)
    } catch {
      alert('Could not access microphone')
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }

  async function transcribe(blob: Blob) {
    setTranscribing(true)
    try {
      const formData = new FormData()
      formData.append('audio', blob)
      const res = await fetch('/api/transcribe', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (data.text) onTranscript(data.text)
    } catch {
      alert('Transcription failed')
    } finally {
      setTranscribing(false)
    }
  }

  return (
    <button
      onClick={recording ? stopRecording : startRecording}
      disabled={transcribing}
      className={`px-4 py-2 rounded-lg text-sm font-medium ${
        recording
          ? 'bg-red-600 text-white hover:bg-red-700'
          : transcribing
            ? 'border border-border opacity-40 cursor-not-allowed'
            : 'border border-border text-foreground hover:bg-black/5'
      }`}
    >
      {recording ? 'Stop Recording' : transcribing ? 'Transcribing...' : 'Record Voice'}
    </button>
  )
}
```

**Step 2: Delete unused files**

```bash
rm src/components/deals/DealReviewCard.tsx
rm src/components/investors/InvestorReviewCard.tsx
rm src/components/deals/DealFilters.tsx
```

**Step 3: Commit**

```bash
git add -u src/components/deals/DealReviewCard.tsx src/components/investors/InvestorReviewCard.tsx src/components/deals/DealFilters.tsx src/components/deals/VoiceRecorder.tsx
git commit -m "refactor: update VoiceRecorder styling, delete unused review cards and filters"
```

---

### Task 13: Update share and history pages with warm styling

**Files:**
- Modify: `src/app/share/page.tsx`
- Modify: `src/app/history/page.tsx`

**Step 1: Read current share and history pages**

Read `src/app/share/page.tsx` and `src/app/history/page.tsx` to see current styling.

**Step 2: Update color classes across both pages**

In both files, apply these replacements:
- `bg-white` → `bg-surface`
- `border` (standalone) → `border border-border`
- `text-gray-500` → `text-secondary`
- `text-gray-600` → `text-secondary`
- `text-gray-400` → `text-secondary`
- `text-gray-700` → `text-foreground`
- `bg-gray-50` → `bg-background`
- `bg-gray-100` → `bg-black/5`
- `hover:bg-gray-50` → `hover:bg-black/5`
- `text-blue-600` → `text-blue-700`
- `rounded` (on cards) → `rounded-lg`

These are mechanical find-and-replace operations on Tailwind classes to match the warm palette.

**Step 3: Commit**

```bash
git add src/app/share/page.tsx src/app/history/page.tsx
git commit -m "style: update share and history pages with warm palette"
```

---

### Task 14: Run tests and verify build

**Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass (deal parsing + investor parsing).

**Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds with no type errors.

**Step 3: Fix any issues found**

Address any type errors or test failures.

**Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address build and test issues from UI redesign"
```
