# Deal Notes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add voice/text notes to each deal with per-note summaries and a rolling overall summary.

**Architecture:** New `deal_notes` table + `notes_summary` column on `deals`. New `/deals/[id]` detail page. New `/api/summarize-note` API route that generates per-note summary and regenerates overall summary via GPT. Reuses existing VoiceRecorder component.

**Tech Stack:** Next.js App Router, Supabase, OpenAI GPT-4o, Whisper

---

### Task 1: Database migration and types

**Files:**
- Create: `supabase/migrations/002_deal_notes.sql`
- Modify: `src/lib/supabase/types.ts`

**Step 1: Create the migration file**

Create `supabase/migrations/002_deal_notes.sql`:

```sql
-- Deal notes table
create table deal_notes (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals(id) on delete cascade,
  content text not null,
  summary text,
  created_at timestamptz not null default now()
);

create index idx_deal_notes_deal_id on deal_notes(deal_id);
create index idx_deal_notes_created_at on deal_notes(created_at desc);

-- Add notes summary to deals
alter table deals add column notes_summary text;
```

**Step 2: Add TypeScript types**

Add to `src/lib/supabase/types.ts` after the `ShareRecord` type:

```ts
export type DealNote = {
  id: string
  deal_id: string
  content: string
  summary: string | null
  created_at: string
}

export type DealNoteInsert = Omit<DealNote, 'id' | 'created_at'>
```

Also update the `Deal` type to add:
```ts
  notes_summary: string | null
```

**Step 3: Commit**

```bash
git add supabase/migrations/002_deal_notes.sql src/lib/supabase/types.ts
git commit -m "feat: add deal_notes table and notes_summary column"
```

---

### Task 2: Server actions for notes

**Files:**
- Create: `src/app/deals/[id]/actions.ts`

**Step 1: Create the server actions file**

Create `src/app/deals/[id]/actions.ts`:

```ts
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
```

**Step 2: Commit**

```bash
git add src/app/deals/\[id\]/actions.ts
git commit -m "feat: add server actions for deal notes"
```

---

### Task 3: Note summarization API route

**Files:**
- Create: `src/app/api/summarize-note/route.ts`

**Step 1: Create the API route**

Create `src/app/api/summarize-note/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

export async function POST(request: NextRequest) {
  const { content, existingSummaries } = await request.json()

  if (!content || typeof content !== 'string') {
    return NextResponse.json({ error: 'content is required' }, { status: 400 })
  }

  // Generate mini-summary for this note
  const noteSummaryRes = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 100,
    messages: [
      {
        role: 'system',
        content: 'Summarize the following note about a deal/company in one concise sentence. Return ONLY the summary sentence.',
      },
      { role: 'user', content },
    ],
  })

  const noteSummary = noteSummaryRes.choices[0]?.message?.content?.trim() || null

  // Generate overall summary from all note summaries
  let overallSummary: string | null = null
  const allSummaries = [...(existingSummaries || []), noteSummary].filter(Boolean)

  if (allSummaries.length > 0) {
    const overallRes = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 300,
      messages: [
        {
          role: 'system',
          content: 'You are given a list of note summaries about a deal/company. Write a concise overall summary that captures the key information across all notes. Keep it to 2-3 sentences. Return ONLY the summary.',
        },
        { role: 'user', content: allSummaries.join('\n') },
      ],
    })
    overallSummary = overallRes.choices[0]?.message?.content?.trim() || null
  }

  return NextResponse.json({ noteSummary, overallSummary })
}
```

**Step 2: Commit**

```bash
git add src/app/api/summarize-note/route.ts
git commit -m "feat: add note summarization API route"
```

---

### Task 4: NoteInput component

**Files:**
- Create: `src/components/deals/NoteInput.tsx`

**Step 1: Create the NoteInput component**

Create `src/components/deals/NoteInput.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { VoiceRecorder } from './VoiceRecorder'
import { addNote } from '@/app/deals/[id]/actions'
import { updateDealSummary } from '@/app/deals/[id]/actions'

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
```

**Step 2: Commit**

```bash
git add src/components/deals/NoteInput.tsx
git commit -m "feat: add NoteInput component with voice and text support"
```

---

### Task 5: NoteList component

**Files:**
- Create: `src/components/deals/NoteList.tsx`

**Step 1: Create the NoteList component**

Create `src/components/deals/NoteList.tsx`:

```tsx
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
```

**Step 2: Commit**

```bash
git add src/components/deals/NoteList.tsx
git commit -m "feat: add NoteList component"
```

---

### Task 6: Deal detail page

**Files:**
- Create: `src/app/deals/[id]/page.tsx`

**Step 1: Create the deal detail page**

Create `src/app/deals/[id]/page.tsx`:

```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { EditableField } from '@/components/EditableField'
import { NoteInput } from '@/components/deals/NoteInput'
import { NoteList } from '@/components/deals/NoteList'
import { updateDeal } from '@/app/deals/actions'
import type { Deal, DealNote } from '@/lib/supabase/types'

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: deal } = await supabase
    .from('deals')
    .select()
    .eq('id', id)
    .single()

  if (!deal) notFound()

  const { data: notes } = await supabase
    .from('deal_notes')
    .select()
    .eq('deal_id', id)
    .order('created_at', { ascending: false })

  const typedDeal = deal as Deal & { notes_summary: string | null }
  const typedNotes = (notes || []) as DealNote[]
  const existingSummaries = typedNotes
    .map((n) => n.summary)
    .filter(Boolean) as string[]

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
      <Link href="/?tab=deals" className="text-sm text-secondary hover:text-foreground">
        &larr; Back to deals
      </Link>

      <DealHeader deal={typedDeal} />

      {typedDeal.notes_summary && (
        <section className="border border-border rounded-lg p-4 bg-amber-50/50">
          <h2 className="text-sm font-semibold text-foreground mb-1">Summary</h2>
          <p className="text-sm text-secondary">{typedDeal.notes_summary}</p>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Notes</h2>
        <NoteInput dealId={id} existingSummaries={existingSummaries} />
        <NoteList notes={typedNotes} dealId={id} />
      </section>
    </div>
  )
}

function DealHeader({ deal }: { deal: Deal }) {
  async function handleUpdate(field: string, value: string) {
    'use server'
    let parsed: string | number | null = value || null
    if (field === 'priority') parsed = parseInt(value)
    if (field === 'raise_amount') parsed = value ? parseFloat(value) : null
    return updateDeal(deal.id, field, parsed)
  }

  const priorityOptions = [
    { value: '1', label: 'P1 — Top' },
    { value: '2', label: 'P2 — Good' },
    { value: '3', label: 'P3 — Interesting' },
  ]

  function priorityBadgeClass(p: number) {
    if (p === 1) return 'bg-amber-100 text-amber-900'
    if (p === 2) return 'bg-gray-100 text-gray-800'
    return 'bg-gray-50 text-gray-600'
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-foreground">
          <EditableField
            value={deal.company_name}
            onSave={(v) => handleUpdate('company_name', v)}
          />
        </h1>
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
      </div>
      {deal.one_liner && (
        <p className="text-sm text-secondary">
          <EditableField
            value={deal.one_liner}
            onSave={(v) => handleUpdate('one_liner', v)}
          />
        </p>
      )}
      {deal.website_url && (
        <a href={deal.website_url} target="_blank" rel="noopener noreferrer"
           className="text-sm text-blue-700 hover:underline">
          {deal.website_url}
        </a>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/deals/\[id\]/page.tsx
git commit -m "feat: add deal detail page with notes"
```

---

### Task 7: Link deals in home page list to detail page

**Files:**
- Modify: `src/components/deals/DealList.tsx`

**Step 1: Make company name a link to the detail page**

In `src/components/deals/DealList.tsx`, add `import Link from 'next/link'` at the top.

Then in the `DealRow` component, wrap the company name `EditableField` in a Link. Replace the company name span block (lines 113-118):

```tsx
<Link href={`/deals/${deal.id}`} className="font-semibold text-base text-foreground hover:underline">
  {deal.company_name}
</Link>
```

This replaces the `EditableField` for company name in the list view — inline editing for that field is still available on the detail page.

**Step 2: Commit**

```bash
git add src/components/deals/DealList.tsx
git commit -m "feat: link deal names to detail page"
```

---

### Task 8: Update deals redirect and verify build

**Files:**
- Modify: `src/app/deals/page.tsx`

**Step 1: Keep /deals redirect but don't conflict with /deals/[id]**

The current `src/app/deals/page.tsx` redirects to `/?tab=deals`. The new `src/app/deals/[id]/page.tsx` is a separate route, so no conflict. Verify this works.

**Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds with new `/deals/[id]` route showing as dynamic.

**Step 3: Fix any issues**

Address type errors or build failures.

**Step 4: Commit if fixes needed**

```bash
git add -A
git commit -m "fix: address build issues for deal notes feature"
```
