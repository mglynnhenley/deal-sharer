# Deal Sharer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a web app that ingests unstructured text/voice about deals and investors, extracts structured data via Claude API, and generates personalised deal-sharing lists filtered by priority.

**Architecture:** Next.js App Router with Supabase (Postgres + Auth). Claude API for text extraction. Whisper API or browser Web Speech API for voice-to-text. Single-user auth. Four main pages: Deals, Investors, Share Lists, History.

**Tech Stack:** Next.js 15 (App Router, TypeScript), Supabase (`@supabase/ssr`), Anthropic SDK (`@anthropic-ai/sdk`), Tailwind CSS, Vitest + React Testing Library

---

### Task 1: Project Scaffolding

**Files:**
- Create: entire Next.js project structure

**Step 1: Create Next.js app**

Run:
```bash
cd /Users/matildaglynn/Documents/projects/deal_sharer
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

Select defaults when prompted.

**Step 2: Install dependencies**

Run:
```bash
npm install @supabase/ssr @supabase/supabase-js @anthropic-ai/sdk
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

**Step 3: Create Vitest config**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

Create `src/test/setup.ts`:
```typescript
import '@testing-library/jest-dom/vitest'
```

**Step 4: Add test script to package.json**

Add to `scripts` in `package.json`:
```json
"test": "vitest",
"test:run": "vitest run"
```

**Step 5: Create env file**

Create `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
ANTHROPIC_API_KEY=your-anthropic-key
```

Add `.env.local` to `.gitignore` if not already there.

**Step 6: Verify setup**

Run:
```bash
npm run build
npm run test:run
```

Expected: Build succeeds, test runner starts (no tests yet).

**Step 7: Commit**

```bash
git init
git add -A
git commit -m "chore: scaffold Next.js project with Supabase and testing deps"
```

---

### Task 2: Supabase Schema & Client Utilities

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/types.ts`

**Step 1: Write the database migration**

Create `supabase/migrations/001_initial_schema.sql`:
```sql
-- Deals table
create table deals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  company_name text not null,
  website_url text,
  one_liner text,
  raise_amount numeric,
  currency text default 'EUR',
  priority int not null check (priority in (1, 2, 3)),
  status text not null default 'active' check (status in ('active', 'passed', 'closed')),
  raw_source_text text
);

-- Investors table
create table investors (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  contact_name text not null,
  fund_name text,
  email text,
  priority_threshold int not null default 3 check (priority_threshold in (1, 2, 3)),
  sharing_frequency text not null default 'weekly' check (sharing_frequency in ('weekly', 'bi-weekly', 'monthly')),
  thesis_description text,
  raw_source_text text
);

-- Share records table
create table share_records (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  investor_id uuid not null references investors(id) on delete cascade,
  deal_id uuid not null references deals(id) on delete cascade,
  batch_id uuid not null
);

-- Indexes for common queries
create index idx_deals_created_at on deals(created_at desc);
create index idx_deals_priority on deals(priority);
create index idx_share_records_investor on share_records(investor_id);
create index idx_share_records_deal on share_records(deal_id);
create index idx_share_records_batch on share_records(batch_id);
```

**Step 2: Apply migration via Supabase dashboard**

Go to Supabase dashboard > SQL Editor > paste and run the migration SQL.

**Step 3: Create TypeScript types**

Create `src/lib/supabase/types.ts`:
```typescript
export type Deal = {
  id: string
  created_at: string
  company_name: string
  website_url: string | null
  one_liner: string | null
  raise_amount: number | null
  currency: string | null
  priority: 1 | 2 | 3
  status: 'active' | 'passed' | 'closed'
  raw_source_text: string | null
}

export type Investor = {
  id: string
  created_at: string
  contact_name: string
  fund_name: string | null
  email: string | null
  priority_threshold: 1 | 2 | 3
  sharing_frequency: 'weekly' | 'bi-weekly' | 'monthly'
  thesis_description: string | null
  raw_source_text: string | null
}

export type ShareRecord = {
  id: string
  created_at: string
  investor_id: string
  deal_id: string
  batch_id: string
}

export type DealInsert = Omit<Deal, 'id' | 'created_at'>
export type InvestorInsert = Omit<Investor, 'id' | 'created_at'>
```

**Step 4: Create server-side Supabase client**

Create `src/lib/supabase/server.ts`:
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from Server Component - ignored, middleware handles refresh
          }
        },
      },
    }
  )
}
```

**Step 5: Create browser-side Supabase client**

Create `src/lib/supabase/client.ts`:
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**Step 6: Commit**

```bash
git add supabase/ src/lib/supabase/
git commit -m "feat: add Supabase schema, migration, and client utilities"
```

---

### Task 3: Auth (Login Page + Middleware)

**Files:**
- Create: `src/middleware.ts`
- Create: `src/app/login/page.tsx`
- Create: `src/app/login/actions.ts`
- Modify: `src/app/layout.tsx`

**Step 1: Create auth middleware**

Create `src/middleware.ts`:
```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/auth')
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

**Step 2: Create login server actions**

Create `src/app/login/actions.ts`:
```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
```

**Step 3: Create login page**

Create `src/app/login/page.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { login } from './actions'

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
    const result = await login(formData)
    if (result?.error) {
      setError(result.error)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-bold text-center">Deal Sharer</h1>
        <form action={handleSubmit} className="space-y-4">
          <input
            name="email"
            type="email"
            placeholder="Email"
            required
            className="w-full px-3 py-2 border rounded-md"
          />
          <input
            name="password"
            type="password"
            placeholder="Password"
            required
            className="w-full px-3 py-2 border rounded-md"
          />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            className="w-full py-2 bg-black text-white rounded-md hover:bg-gray-800"
          >
            Log in
          </button>
        </form>
      </div>
    </div>
  )
}
```

**Step 4: Update root layout with logout**

Modify `src/app/layout.tsx` to include a simple nav shell. The exact styling can be adjusted later - for now just ensure the layout renders children.

**Step 5: Create user in Supabase**

Go to Supabase dashboard > Authentication > Users > Add user. Create your account with email/password.

**Step 6: Test login flow manually**

Run: `npm run dev`
Navigate to `http://localhost:3000` - should redirect to `/login`.
Log in with your credentials - should redirect to `/`.

**Step 7: Commit**

```bash
git add src/middleware.ts src/app/login/ src/app/layout.tsx
git commit -m "feat: add Supabase auth with login page and middleware"
```

---

### Task 4: Deal Extraction API Route

**Files:**
- Create: `src/lib/extraction/deals.ts`
- Create: `src/app/api/extract-deals/route.ts`
- Create: `src/test/extraction/deals.test.ts`

**Step 1: Write the failing test for deal extraction parsing**

Create `src/test/extraction/deals.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { parseDealsFromLLMResponse } from '@/lib/extraction/deals'

describe('parseDealsFromLLMResponse', () => {
  it('parses a JSON array of deals from LLM output', () => {
    const llmOutput = JSON.stringify([
      {
        company_name: 'Jaipur Robotics',
        website_url: 'https://jaipurrobotics.com/',
        one_liner: 'AI detection of hazardous materials in mixed waste',
        raise_amount: 4000000,
        currency: 'EUR',
      },
      {
        company_name: 'Polybot',
        website_url: 'https://polybot.eu/',
        one_liner: 'Greenhouse crop harvesting robotics',
        raise_amount: 4000000,
        currency: 'EUR',
      },
    ])

    const result = parseDealsFromLLMResponse(llmOutput)
    expect(result).toHaveLength(2)
    expect(result[0].company_name).toBe('Jaipur Robotics')
    expect(result[0].raise_amount).toBe(4000000)
    expect(result[1].company_name).toBe('Polybot')
  })

  it('handles LLM output wrapped in markdown code block', () => {
    const llmOutput = '```json\n' + JSON.stringify([
      {
        company_name: 'Nerva AI',
        website_url: 'http://nerva-ai.com/',
        one_liner: 'Energy optimization for datacenters',
        raise_amount: null,
        currency: null,
      },
    ]) + '\n```'

    const result = parseDealsFromLLMResponse(llmOutput)
    expect(result).toHaveLength(1)
    expect(result[0].company_name).toBe('Nerva AI')
  })

  it('returns empty array for unparseable output', () => {
    const result = parseDealsFromLLMResponse('not valid json at all')
    expect(result).toEqual([])
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/extraction/deals.test.ts`
Expected: FAIL - module not found

**Step 3: Implement deal extraction logic**

Create `src/lib/extraction/deals.ts`:
```typescript
export type ExtractedDeal = {
  company_name: string
  website_url: string | null
  one_liner: string | null
  raise_amount: number | null
  currency: string | null
}

export function parseDealsFromLLMResponse(output: string): ExtractedDeal[] {
  // Strip markdown code fences if present
  let cleaned = output.trim()
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim()
  }

  try {
    const parsed = JSON.parse(cleaned)
    if (!Array.isArray(parsed)) return []
    return parsed.map((d: Record<string, unknown>) => ({
      company_name: String(d.company_name || ''),
      website_url: d.website_url ? String(d.website_url) : null,
      one_liner: d.one_liner ? String(d.one_liner) : null,
      raise_amount: typeof d.raise_amount === 'number' ? d.raise_amount : null,
      currency: d.currency ? String(d.currency) : null,
    }))
  } catch {
    return []
  }
}

export const DEAL_EXTRACTION_PROMPT = `You are a deal extraction assistant. Given unstructured text about investment deals, extract each deal into a structured JSON array.

For each deal, extract:
- company_name: the company name
- website_url: the company website URL (if mentioned)
- one_liner: a concise one-line description of what the company does
- raise_amount: the amount being raised as a number (e.g., 4000000 for 4M), or null if not mentioned
- currency: the currency (EUR, USD, GBP, etc.), or null if not mentioned

Return ONLY a JSON array of objects. No other text.

Example output:
[
  {
    "company_name": "ExampleCo",
    "website_url": "https://example.com",
    "one_liner": "AI-powered widget maker",
    "raise_amount": 5000000,
    "currency": "EUR"
  }
]`
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/extraction/deals.test.ts`
Expected: PASS

**Step 5: Create the API route**

Create `src/app/api/extract-deals/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { parseDealsFromLLMResponse, DEAL_EXTRACTION_PROMPT } from '@/lib/extraction/deals'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(request: NextRequest) {
  const { text } = await request.json()

  if (!text || typeof text !== 'string') {
    return NextResponse.json({ error: 'text field is required' }, { status: 400 })
  }

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `${DEAL_EXTRACTION_PROMPT}\n\nHere is the unstructured text:\n\n${text}`,
      },
    ],
  })

  const content = message.content[0]
  if (content.type !== 'text') {
    return NextResponse.json({ error: 'Unexpected response format' }, { status: 500 })
  }

  const deals = parseDealsFromLLMResponse(content.text)
  return NextResponse.json({ deals })
}
```

**Step 6: Commit**

```bash
git add src/lib/extraction/deals.ts src/app/api/extract-deals/ src/test/extraction/
git commit -m "feat: add deal extraction from unstructured text via Claude API"
```

---

### Task 5: Deals Page - Text Input & Extraction Review

**Files:**
- Create: `src/app/deals/page.tsx`
- Create: `src/components/deals/DealInput.tsx`
- Create: `src/components/deals/DealReviewCard.tsx`
- Create: `src/app/deals/actions.ts`

**Step 1: Create deal save server action**

Create `src/app/deals/actions.ts`:
```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { DealInsert } from '@/lib/supabase/types'

export async function saveDeal(deal: DealInsert) {
  const supabase = await createClient()
  const { error } = await supabase.from('deals').insert(deal)
  if (error) {
    return { error: error.message }
  }
  revalidatePath('/deals')
  return { success: true }
}
```

**Step 2: Create the DealReviewCard component**

Create `src/components/deals/DealReviewCard.tsx`:
```tsx
'use client'

import { useState } from 'react'
import type { ExtractedDeal } from '@/lib/extraction/deals'

type Props = {
  deal: ExtractedDeal
  onConfirm: (deal: ExtractedDeal & { priority: 1 | 2 | 3 }) => void
  onDiscard: () => void
}

export function DealReviewCard({ deal, onConfirm, onDiscard }: Props) {
  const [companyName, setCompanyName] = useState(deal.company_name)
  const [websiteUrl, setWebsiteUrl] = useState(deal.website_url || '')
  const [oneLiner, setOneLiner] = useState(deal.one_liner || '')
  const [raiseAmount, setRaiseAmount] = useState(deal.raise_amount?.toString() || '')
  const [currency, setCurrency] = useState(deal.currency || 'EUR')
  const [priority, setPriority] = useState<1 | 2 | 3>(2)

  function handleConfirm() {
    onConfirm({
      company_name: companyName,
      website_url: websiteUrl || null,
      one_liner: oneLiner || null,
      raise_amount: raiseAmount ? parseFloat(raiseAmount) : null,
      currency: currency || null,
      priority,
    })
  }

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-white">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium text-gray-700">Company</label>
          <input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full px-2 py-1 border rounded text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700">Website</label>
          <input
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            className="w-full px-2 py-1 border rounded text-sm"
          />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700">One-liner</label>
        <input
          value={oneLiner}
          onChange={(e) => setOneLiner(e.target.value)}
          className="w-full px-2 py-1 border rounded text-sm"
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-sm font-medium text-gray-700">Raise</label>
          <input
            value={raiseAmount}
            onChange={(e) => setRaiseAmount(e.target.value)}
            type="number"
            className="w-full px-2 py-1 border rounded text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700">Currency</label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full px-2 py-1 border rounded text-sm"
          >
            <option>EUR</option>
            <option>USD</option>
            <option>GBP</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700">Priority</label>
          <select
            value={priority}
            onChange={(e) => setPriority(parseInt(e.target.value) as 1 | 2 | 3)}
            className="w-full px-2 py-1 border rounded text-sm"
          >
            <option value={1}>1 - Top</option>
            <option value={2}>2 - Good</option>
            <option value={3}>3 - Interesting</option>
          </select>
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <button
          onClick={handleConfirm}
          className="px-4 py-1.5 bg-black text-white rounded text-sm hover:bg-gray-800"
        >
          Confirm
        </button>
        <button
          onClick={onDiscard}
          className="px-4 py-1.5 border rounded text-sm hover:bg-gray-50"
        >
          Discard
        </button>
      </div>
    </div>
  )
}
```

**Step 3: Create the DealInput component**

Create `src/components/deals/DealInput.tsx`:
```tsx
'use client'

import { useState } from 'react'
import type { ExtractedDeal } from '@/lib/extraction/deals'
import { DealReviewCard } from './DealReviewCard'
import { saveDeal } from '@/app/deals/actions'

export function DealInput() {
  const [text, setText] = useState('')
  const [extractedDeals, setExtractedDeals] = useState<ExtractedDeal[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleExtract() {
    if (!text.trim()) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/extract-deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setExtractedDeals(data.deals)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Extraction failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirm(deal: ExtractedDeal & { priority: 1 | 2 | 3 }) {
    const result = await saveDeal({
      company_name: deal.company_name,
      website_url: deal.website_url,
      one_liner: deal.one_liner,
      raise_amount: deal.raise_amount,
      currency: deal.currency,
      priority: deal.priority,
      status: 'active',
      raw_source_text: text,
    })
    if (result.error) {
      setError(result.error)
      return
    }
    setExtractedDeals((prev) => prev.filter((d) => d.company_name !== deal.company_name))
  }

  function handleDiscard(companyName: string) {
    setExtractedDeals((prev) => prev.filter((d) => d.company_name !== companyName))
  }

  return (
    <div className="space-y-4">
      <div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste deal info here - transcripts, emails, notes..."
          rows={6}
          className="w-full px-3 py-2 border rounded-md text-sm"
        />
        <button
          onClick={handleExtract}
          disabled={loading || !text.trim()}
          className="mt-2 px-4 py-2 bg-black text-white rounded-md text-sm hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? 'Extracting...' : 'Extract Deals'}
        </button>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {extractedDeals.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium text-sm text-gray-600">
            {extractedDeals.length} deal(s) extracted - review and confirm:
          </h3>
          {extractedDeals.map((deal) => (
            <DealReviewCard
              key={deal.company_name}
              deal={deal}
              onConfirm={handleConfirm}
              onDiscard={() => handleDiscard(deal.company_name)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

**Step 4: Create the deals page**

Create `src/app/deals/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'
import { DealInput } from '@/components/deals/DealInput'
import type { Deal } from '@/lib/supabase/types'

export default async function DealsPage() {
  const supabase = await createClient()
  const { data: deals } = await supabase
    .from('deals')
    .select()
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-bold">Deals</h1>

      <section>
        <h2 className="text-lg font-semibold mb-3">Add Deals</h2>
        <DealInput />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">All Deals</h2>
        {deals && deals.length > 0 ? (
          <DealList deals={deals as Deal[]} />
        ) : (
          <p className="text-gray-500 text-sm">No deals yet.</p>
        )}
      </section>
    </div>
  )
}

function DealList({ deals }: { deals: Deal[] }) {
  return (
    <div className="space-y-2">
      {deals.map((deal) => (
        <div key={deal.id} className="border rounded-lg p-3 bg-white flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{deal.company_name}</span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100">
                P{deal.priority}
              </span>
              <span className="text-xs text-gray-500">
                {new Date(deal.created_at).toLocaleDateString()}
              </span>
            </div>
            {deal.one_liner && (
              <p className="text-sm text-gray-600 mt-1">{deal.one_liner}</p>
            )}
          </div>
          {deal.website_url && (
            <a href={deal.website_url} target="_blank" rel="noopener noreferrer"
               className="text-xs text-blue-600 hover:underline shrink-0">
              Website
            </a>
          )}
        </div>
      ))}
    </div>
  )
}
```

**Step 5: Verify manually**

Run: `npm run dev`
Navigate to `/deals`, paste some deal text, confirm extraction works.

**Step 6: Commit**

```bash
git add src/app/deals/ src/components/deals/
git commit -m "feat: add deals page with text extraction and review UI"
```

---

### Task 6: Deals Page - Date Filtering

**Files:**
- Create: `src/components/deals/DealFilters.tsx`
- Modify: `src/app/deals/page.tsx`

**Step 1: Create date filter component**

Create `src/components/deals/DealFilters.tsx`:
```tsx
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
```

**Step 2: Update deals page to use date filters**

Modify `src/app/deals/page.tsx` to accept `searchParams` and filter the Supabase query:

```tsx
// Update the page component signature and query:
export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const { from, to } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('deals')
    .select()
    .order('created_at', { ascending: false })

  if (from) query = query.gte('created_at', `${from}T00:00:00`)
  if (to) query = query.lte('created_at', `${to}T23:59:59`)

  const { data: deals } = await query

  // ... rest of the page, add <DealFilters /> above the deal list
}
```

**Step 3: Commit**

```bash
git add src/components/deals/DealFilters.tsx src/app/deals/page.tsx
git commit -m "feat: add date filtering to deals list"
```

---

### Task 7: Voice Input for Deals

**Files:**
- Create: `src/components/deals/VoiceRecorder.tsx`
- Modify: `src/components/deals/DealInput.tsx`

**Step 1: Create voice recorder component using browser Web Speech API**

Create `src/components/deals/VoiceRecorder.tsx`:
```tsx
'use client'

import { useState, useRef } from 'react'

type Props = {
  onTranscript: (text: string) => void
}

export function VoiceRecorder({ onTranscript }: Props) {
  const [recording, setRecording] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  function startRecording() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Speech recognition not supported in this browser')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = 'en-US'

    let transcript = ''

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          transcript += event.results[i][0].transcript + ' '
        }
      }
    }

    recognition.onend = () => {
      setRecording(false)
      if (transcript.trim()) {
        onTranscript(transcript.trim())
      }
    }

    recognition.onerror = () => {
      setRecording(false)
    }

    recognitionRef.current = recognition
    recognition.start()
    setRecording(true)
  }

  function stopRecording() {
    recognitionRef.current?.stop()
  }

  return (
    <button
      onClick={recording ? stopRecording : startRecording}
      className={`px-4 py-2 rounded-md text-sm ${
        recording
          ? 'bg-red-600 text-white hover:bg-red-700'
          : 'border hover:bg-gray-50'
      }`}
    >
      {recording ? 'Stop Recording' : 'Record Voice'}
    </button>
  )
}
```

**Step 2: Add Web Speech API type declarations**

Create `src/types/speech.d.ts`:
```typescript
interface Window {
  SpeechRecognition: typeof SpeechRecognition
  webkitSpeechRecognition: typeof SpeechRecognition
}
```

**Step 3: Add VoiceRecorder to DealInput**

Modify `src/components/deals/DealInput.tsx` to include the VoiceRecorder next to the extract button:

```tsx
// Add import
import { VoiceRecorder } from './VoiceRecorder'

// In the JSX, next to the Extract button:
<div className="flex gap-2 mt-2">
  <button onClick={handleExtract} disabled={loading || !text.trim()} className="...">
    {loading ? 'Extracting...' : 'Extract Deals'}
  </button>
  <VoiceRecorder onTranscript={(t) => setText((prev) => prev ? prev + '\n' + t : t)} />
</div>
```

**Step 4: Test manually**

Run: `npm run dev`
Navigate to `/deals`, click Record Voice, speak about a deal, verify transcript appears in text box.

**Step 5: Commit**

```bash
git add src/components/deals/VoiceRecorder.tsx src/components/deals/DealInput.tsx src/types/
git commit -m "feat: add voice recording input for deals via Web Speech API"
```

---

### Task 8: Investor Extraction API Route

**Files:**
- Create: `src/lib/extraction/investors.ts`
- Create: `src/app/api/extract-investor/route.ts`
- Create: `src/test/extraction/investors.test.ts`

**Step 1: Write the failing test**

Create `src/test/extraction/investors.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { parseInvestorFromLLMResponse } from '@/lib/extraction/investors'

describe('parseInvestorFromLLMResponse', () => {
  it('parses investor details from LLM output', () => {
    const llmOutput = JSON.stringify({
      contact_name: 'Sarah',
      fund_name: 'Northzone',
      email: null,
      thesis_description: 'Seed/Series A in Europe, focus on developer tools and AI infrastructure',
    })

    const result = parseInvestorFromLLMResponse(llmOutput)
    expect(result).not.toBeNull()
    expect(result!.contact_name).toBe('Sarah')
    expect(result!.fund_name).toBe('Northzone')
  })

  it('handles markdown-wrapped output', () => {
    const llmOutput = '```json\n' + JSON.stringify({
      contact_name: 'John',
      fund_name: 'Acme Ventures',
      email: 'john@acme.vc',
      thesis_description: 'Early stage B2B SaaS',
    }) + '\n```'

    const result = parseInvestorFromLLMResponse(llmOutput)
    expect(result).not.toBeNull()
    expect(result!.email).toBe('john@acme.vc')
  })

  it('returns null for unparseable output', () => {
    expect(parseInvestorFromLLMResponse('garbage')).toBeNull()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/extraction/investors.test.ts`
Expected: FAIL

**Step 3: Implement investor extraction logic**

Create `src/lib/extraction/investors.ts`:
```typescript
export type ExtractedInvestor = {
  contact_name: string
  fund_name: string | null
  email: string | null
  thesis_description: string | null
}

export function parseInvestorFromLLMResponse(output: string): ExtractedInvestor | null {
  let cleaned = output.trim()
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim()
  }

  try {
    const parsed = JSON.parse(cleaned)
    if (!parsed.contact_name) return null
    return {
      contact_name: String(parsed.contact_name),
      fund_name: parsed.fund_name ? String(parsed.fund_name) : null,
      email: parsed.email ? String(parsed.email) : null,
      thesis_description: parsed.thesis_description ? String(parsed.thesis_description) : null,
    }
  } catch {
    return null
  }
}

export const INVESTOR_EXTRACTION_PROMPT = `You are an investor profile extraction assistant. Given a natural language description of an investor, extract their details into a structured JSON object.

Extract:
- contact_name: the person's name
- fund_name: the fund or firm name (if mentioned)
- email: their email address (if mentioned)
- thesis_description: a summary of their investment thesis, stage focus, sector focus, geographic focus, and any other relevant details

Return ONLY a JSON object. No other text.

Example output:
{
  "contact_name": "Sarah",
  "fund_name": "Northzone",
  "email": null,
  "thesis_description": "Seed/Series A in Europe, focus on developer tools and AI infrastructure, typical checks 500k-2M"
}`
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/extraction/investors.test.ts`
Expected: PASS

**Step 5: Create the API route**

Create `src/app/api/extract-investor/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { parseInvestorFromLLMResponse, INVESTOR_EXTRACTION_PROMPT } from '@/lib/extraction/investors'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(request: NextRequest) {
  const { text } = await request.json()

  if (!text || typeof text !== 'string') {
    return NextResponse.json({ error: 'text field is required' }, { status: 400 })
  }

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `${INVESTOR_EXTRACTION_PROMPT}\n\nHere is the description:\n\n${text}`,
      },
    ],
  })

  const content = message.content[0]
  if (content.type !== 'text') {
    return NextResponse.json({ error: 'Unexpected response format' }, { status: 500 })
  }

  const investor = parseInvestorFromLLMResponse(content.text)
  if (!investor) {
    return NextResponse.json({ error: 'Could not extract investor details' }, { status: 422 })
  }

  return NextResponse.json({ investor })
}
```

**Step 6: Commit**

```bash
git add src/lib/extraction/investors.ts src/app/api/extract-investor/ src/test/extraction/
git commit -m "feat: add investor extraction from natural language via Claude API"
```

---

### Task 9: Investors Page - Input & Review

**Files:**
- Create: `src/app/investors/page.tsx`
- Create: `src/app/investors/actions.ts`
- Create: `src/components/investors/InvestorInput.tsx`
- Create: `src/components/investors/InvestorReviewCard.tsx`

**Step 1: Create investor save server action**

Create `src/app/investors/actions.ts`:
```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { InvestorInsert } from '@/lib/supabase/types'

export async function saveInvestor(investor: InvestorInsert) {
  const supabase = await createClient()
  const { error } = await supabase.from('investors').insert(investor)
  if (error) {
    return { error: error.message }
  }
  revalidatePath('/investors')
  return { success: true }
}
```

**Step 2: Create InvestorReviewCard component**

Create `src/components/investors/InvestorReviewCard.tsx`:
```tsx
'use client'

import { useState } from 'react'
import type { ExtractedInvestor } from '@/lib/extraction/investors'

type Props = {
  investor: ExtractedInvestor
  onConfirm: (investor: ExtractedInvestor & {
    priority_threshold: 1 | 2 | 3
    sharing_frequency: 'weekly' | 'bi-weekly' | 'monthly'
  }) => void
  onDiscard: () => void
}

export function InvestorReviewCard({ investor, onConfirm, onDiscard }: Props) {
  const [contactName, setContactName] = useState(investor.contact_name)
  const [fundName, setFundName] = useState(investor.fund_name || '')
  const [email, setEmail] = useState(investor.email || '')
  const [thesis, setThesis] = useState(investor.thesis_description || '')
  const [threshold, setThreshold] = useState<1 | 2 | 3>(3)
  const [frequency, setFrequency] = useState<'weekly' | 'bi-weekly' | 'monthly'>('weekly')

  function handleConfirm() {
    onConfirm({
      contact_name: contactName,
      fund_name: fundName || null,
      email: email || null,
      thesis_description: thesis || null,
      priority_threshold: threshold,
      sharing_frequency: frequency,
    })
  }

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-white">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium text-gray-700">Contact Name</label>
          <input value={contactName} onChange={(e) => setContactName(e.target.value)}
                 className="w-full px-2 py-1 border rounded text-sm" />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700">Fund</label>
          <input value={fundName} onChange={(e) => setFundName(e.target.value)}
                 className="w-full px-2 py-1 border rounded text-sm" />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700">Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email"
               className="w-full px-2 py-1 border rounded text-sm" />
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700">Thesis / Notes</label>
        <textarea value={thesis} onChange={(e) => setThesis(e.target.value)} rows={2}
                  className="w-full px-2 py-1 border rounded text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium text-gray-700">Send deals rated</label>
          <select value={threshold} onChange={(e) => setThreshold(parseInt(e.target.value) as 1 | 2 | 3)}
                  className="w-full px-2 py-1 border rounded text-sm">
            <option value={1}>1 only (top deals)</option>
            <option value={2}>1-2 (top + good)</option>
            <option value={3}>1-3 (everything)</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700">Sharing frequency</label>
          <select value={frequency} onChange={(e) => setFrequency(e.target.value as 'weekly' | 'bi-weekly' | 'monthly')}
                  className="w-full px-2 py-1 border rounded text-sm">
            <option value="weekly">Weekly</option>
            <option value="bi-weekly">Bi-weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <button onClick={handleConfirm}
                className="px-4 py-1.5 bg-black text-white rounded text-sm hover:bg-gray-800">
          Confirm
        </button>
        <button onClick={onDiscard}
                className="px-4 py-1.5 border rounded text-sm hover:bg-gray-50">
          Discard
        </button>
      </div>
    </div>
  )
}
```

**Step 3: Create InvestorInput component**

Create `src/components/investors/InvestorInput.tsx`:
```tsx
'use client'

import { useState } from 'react'
import type { ExtractedInvestor } from '@/lib/extraction/investors'
import { InvestorReviewCard } from './InvestorReviewCard'
import { saveInvestor } from '@/app/investors/actions'

export function InvestorInput() {
  const [text, setText] = useState('')
  const [extracted, setExtracted] = useState<ExtractedInvestor | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleExtract() {
    if (!text.trim()) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/extract-investor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setExtracted(data.investor)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Extraction failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirm(investor: ExtractedInvestor & {
    priority_threshold: 1 | 2 | 3
    sharing_frequency: 'weekly' | 'bi-weekly' | 'monthly'
  }) {
    const result = await saveInvestor({
      contact_name: investor.contact_name,
      fund_name: investor.fund_name,
      email: investor.email,
      priority_threshold: investor.priority_threshold,
      sharing_frequency: investor.sharing_frequency,
      thesis_description: investor.thesis_description,
      raw_source_text: text,
    })
    if (result.error) {
      setError(result.error)
      return
    }
    setExtracted(null)
    setText('')
  }

  return (
    <div className="space-y-4">
      <div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Describe an investor... e.g. 'Sarah at Northzone, they do seed in Europe, focus on dev tools'"
          rows={3}
          className="w-full px-3 py-2 border rounded-md text-sm"
        />
        <button
          onClick={handleExtract}
          disabled={loading || !text.trim()}
          className="mt-2 px-4 py-2 bg-black text-white rounded-md text-sm hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? 'Extracting...' : 'Extract Investor'}
        </button>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {extracted && (
        <InvestorReviewCard
          investor={extracted}
          onConfirm={handleConfirm}
          onDiscard={() => setExtracted(null)}
        />
      )}
    </div>
  )
}
```

**Step 4: Create investors page**

Create `src/app/investors/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'
import { InvestorInput } from '@/components/investors/InvestorInput'
import type { Investor } from '@/lib/supabase/types'

export default async function InvestorsPage() {
  const supabase = await createClient()
  const { data: investors } = await supabase
    .from('investors')
    .select()
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-bold">Investors</h1>

      <section>
        <h2 className="text-lg font-semibold mb-3">Add Investor</h2>
        <InvestorInput />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">All Investors</h2>
        {investors && investors.length > 0 ? (
          <InvestorList investors={investors as Investor[]} />
        ) : (
          <p className="text-gray-500 text-sm">No investors yet.</p>
        )}
      </section>
    </div>
  )
}

function InvestorList({ investors }: { investors: Investor[] }) {
  return (
    <div className="space-y-2">
      {investors.map((inv) => (
        <div key={inv.id} className="border rounded-lg p-3 bg-white">
          <div className="flex items-center gap-2">
            <span className="font-medium">{inv.contact_name}</span>
            {inv.fund_name && <span className="text-sm text-gray-500">@ {inv.fund_name}</span>}
            <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100">
              P1{inv.priority_threshold > 1 ? `-${inv.priority_threshold}` : ''}
            </span>
            <span className="text-xs text-gray-500">{inv.sharing_frequency}</span>
          </div>
          {inv.thesis_description && (
            <p className="text-sm text-gray-600 mt-1">{inv.thesis_description}</p>
          )}
        </div>
      ))}
    </div>
  )
}
```

**Step 5: Commit**

```bash
git add src/app/investors/ src/components/investors/
git commit -m "feat: add investors page with NL extraction and review UI"
```

---

### Task 10: Navigation Layout

**Files:**
- Modify: `src/app/layout.tsx`
- Create: `src/components/Nav.tsx`

**Step 1: Create Nav component**

Create `src/components/Nav.tsx`:
```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/app/login/actions'

const links = [
  { href: '/deals', label: 'Deals' },
  { href: '/investors', label: 'Investors' },
  { href: '/share', label: 'Share Lists' },
  { href: '/history', label: 'History' },
]

export function Nav() {
  const pathname = usePathname()

  if (pathname === '/login') return null

  return (
    <nav className="border-b bg-white">
      <div className="max-w-4xl mx-auto px-6 flex items-center justify-between h-14">
        <div className="flex items-center gap-6">
          <span className="font-bold">Deal Sharer</span>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm ${
                pathname.startsWith(link.href)
                  ? 'text-black font-medium'
                  : 'text-gray-500 hover:text-black'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
        <form action={logout}>
          <button type="submit" className="text-sm text-gray-500 hover:text-black">
            Log out
          </button>
        </form>
      </div>
    </nav>
  )
}
```

**Step 2: Update root layout**

Modify `src/app/layout.tsx` to include `<Nav />` above `{children}`.

**Step 3: Update root page to redirect to deals**

Modify `src/app/page.tsx`:
```tsx
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/deals')
}
```

**Step 4: Commit**

```bash
git add src/components/Nav.tsx src/app/layout.tsx src/app/page.tsx
git commit -m "feat: add navigation layout with links to all pages"
```

---

### Task 11: Share Lists Page - Core UI

**Files:**
- Create: `src/app/share/page.tsx`
- Create: `src/components/share/ShareListBuilder.tsx`
- Create: `src/app/share/actions.ts`

**Step 1: Create share actions**

Create `src/app/share/actions.ts`:
```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function saveShareRecords(
  investorId: string,
  dealIds: string[],
  batchId: string
) {
  const supabase = await createClient()

  const records = dealIds.map((dealId) => ({
    investor_id: investorId,
    deal_id: dealId,
    batch_id: batchId,
  }))

  const { error } = await supabase.from('share_records').insert(records)
  if (error) {
    return { error: error.message }
  }
  revalidatePath('/share')
  revalidatePath('/history')
  return { success: true }
}

export async function getSharedDealIds(investorId: string): Promise<string[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('share_records')
    .select('deal_id')
    .eq('investor_id', investorId)

  return data?.map((r) => r.deal_id) || []
}
```

**Step 2: Create ShareListBuilder component**

Create `src/components/share/ShareListBuilder.tsx`:
```tsx
'use client'

import { useState, useEffect } from 'react'
import type { Deal, Investor } from '@/lib/supabase/types'
import { saveShareRecords, getSharedDealIds } from '@/app/share/actions'

type Props = {
  investors: Investor[]
  deals: Deal[]
}

export function ShareListBuilder({ investors, deals }: Props) {
  const [selectedInvestorId, setSelectedInvestorId] = useState<string | null>(
    investors[0]?.id || null
  )
  const [selectedDealIds, setSelectedDealIds] = useState<Set<string>>(new Set())
  const [alreadySharedIds, setAlreadySharedIds] = useState<Set<string>>(new Set())
  const [output, setOutput] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const selectedInvestor = investors.find((i) => i.id === selectedInvestorId)

  // Filter deals by investor priority threshold
  const eligibleDeals = selectedInvestor
    ? deals.filter((d) => d.priority <= selectedInvestor.priority_threshold && d.status === 'active')
    : []

  useEffect(() => {
    if (!selectedInvestorId) return
    getSharedDealIds(selectedInvestorId).then((ids) => {
      setAlreadySharedIds(new Set(ids))
    })
    setSelectedDealIds(new Set())
    setOutput(null)
  }, [selectedInvestorId])

  // Auto-select eligible deals that haven't been shared yet
  useEffect(() => {
    const unshared = eligibleDeals.filter((d) => !alreadySharedIds.has(d.id))
    setSelectedDealIds(new Set(unshared.map((d) => d.id)))
  }, [alreadySharedIds, selectedInvestorId])

  function toggleDeal(dealId: string) {
    setSelectedDealIds((prev) => {
      const next = new Set(prev)
      if (next.has(dealId)) next.delete(dealId)
      else next.add(dealId)
      return next
    })
  }

  async function handleFinalise() {
    if (!selectedInvestorId || selectedDealIds.size === 0) return
    setSaving(true)

    const batchId = crypto.randomUUID()
    const result = await saveShareRecords(
      selectedInvestorId,
      Array.from(selectedDealIds),
      batchId
    )

    if (result.error) {
      alert(result.error)
      setSaving(false)
      return
    }

    // Generate shareable text
    const selectedDeals = deals.filter((d) => selectedDealIds.has(d.id))
    const lines = selectedDeals.map((d) => {
      const url = d.website_url || d.company_name
      const desc = d.one_liner ? ` - ${d.one_liner}` : ''
      return `${url}${desc}`
    })
    setOutput(`Some deals I've been looking at!\n\n${lines.join('\n')}`)

    // Update shared set
    setAlreadySharedIds((prev) => {
      const next = new Set(prev)
      selectedDealIds.forEach((id) => next.add(id))
      return next
    })
    setSelectedDealIds(new Set())
    setSaving(false)
  }

  function copyToClipboard() {
    if (output) navigator.clipboard.writeText(output)
  }

  if (investors.length === 0) {
    return <p className="text-gray-500 text-sm">Add some investors first.</p>
  }

  return (
    <div className="flex gap-6">
      {/* Investor sidebar */}
      <div className="w-56 shrink-0 space-y-1">
        <h3 className="text-sm font-medium text-gray-600 mb-2">Investors</h3>
        {investors.map((inv) => (
          <button
            key={inv.id}
            onClick={() => setSelectedInvestorId(inv.id)}
            className={`w-full text-left px-3 py-2 rounded text-sm ${
              inv.id === selectedInvestorId
                ? 'bg-black text-white'
                : 'hover:bg-gray-100'
            }`}
          >
            {inv.contact_name}
            {inv.fund_name && <span className="text-xs opacity-70 ml-1">@ {inv.fund_name}</span>}
          </button>
        ))}
      </div>

      {/* Deal list */}
      <div className="flex-1 space-y-4">
        {selectedInvestor && (
          <>
            <div className="text-sm text-gray-600">
              Showing deals P1{selectedInvestor.priority_threshold > 1 ? `-${selectedInvestor.priority_threshold}` : ''} for {selectedInvestor.contact_name}
            </div>

            {eligibleDeals.length === 0 ? (
              <p className="text-gray-500 text-sm">No deals match this investor's threshold.</p>
            ) : (
              <div className="space-y-2">
                {eligibleDeals.map((deal) => {
                  const shared = alreadySharedIds.has(deal.id)
                  const selected = selectedDealIds.has(deal.id)
                  return (
                    <label
                      key={deal.id}
                      className={`flex items-start gap-3 border rounded-lg p-3 cursor-pointer ${
                        shared ? 'opacity-50 bg-gray-50' : 'bg-white'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleDeal(deal.id)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{deal.company_name}</span>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100">P{deal.priority}</span>
                          {shared && <span className="text-xs text-orange-600">Previously shared</span>}
                        </div>
                        {deal.one_liner && (
                          <p className="text-sm text-gray-600">{deal.one_liner}</p>
                        )}
                      </div>
                    </label>
                  )
                })}
              </div>
            )}

            {!output && eligibleDeals.length > 0 && (
              <button
                onClick={handleFinalise}
                disabled={saving || selectedDealIds.size === 0}
                className="px-4 py-2 bg-black text-white rounded-md text-sm hover:bg-gray-800 disabled:opacity-50"
              >
                {saving ? 'Saving...' : `Finalise (${selectedDealIds.size} deals)`}
              </button>
            )}

            {output && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-600">Share list ready:</h3>
                <pre className="bg-gray-50 border rounded-lg p-4 text-sm whitespace-pre-wrap">{output}</pre>
                <button
                  onClick={copyToClipboard}
                  className="px-4 py-2 border rounded-md text-sm hover:bg-gray-50"
                >
                  Copy to clipboard
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
```

**Step 3: Create share page**

Create `src/app/share/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'
import { ShareListBuilder } from '@/components/share/ShareListBuilder'
import type { Deal, Investor } from '@/lib/supabase/types'

export default async function SharePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const { from, to } = await searchParams
  const supabase = await createClient()

  const { data: investors } = await supabase
    .from('investors')
    .select()
    .order('contact_name')

  let dealsQuery = supabase
    .from('deals')
    .select()
    .eq('status', 'active')
    .order('priority')
    .order('created_at', { ascending: false })

  if (from) dealsQuery = dealsQuery.gte('created_at', `${from}T00:00:00`)
  if (to) dealsQuery = dealsQuery.lte('created_at', `${to}T23:59:59`)

  const { data: deals } = await dealsQuery

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Share Lists</h1>

      <DateRangeForm from={from} to={to} />

      <ShareListBuilder
        investors={(investors || []) as Investor[]}
        deals={(deals || []) as Deal[]}
      />
    </div>
  )
}

function DateRangeForm({ from, to }: { from?: string; to?: string }) {
  return (
    <form className="flex items-center gap-3 text-sm">
      <label className="text-gray-600">From:</label>
      <input type="date" name="from" defaultValue={from} className="px-2 py-1 border rounded" />
      <label className="text-gray-600">To:</label>
      <input type="date" name="to" defaultValue={to} className="px-2 py-1 border rounded" />
      <button type="submit" className="px-3 py-1 bg-black text-white rounded hover:bg-gray-800">
        Filter
      </button>
    </form>
  )
}
```

**Step 4: Test manually**

Run: `npm run dev`
Add some deals and investors, navigate to `/share`, verify the full workflow.

**Step 5: Commit**

```bash
git add src/app/share/ src/components/share/
git commit -m "feat: add share lists page with investor sidebar and deal curation"
```

---

### Task 12: History Page

**Files:**
- Create: `src/app/history/page.tsx`

**Step 1: Create history page**

Create `src/app/history/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'

type ShareRecordWithDetails = {
  id: string
  created_at: string
  batch_id: string
  deals: { company_name: string; website_url: string | null; one_liner: string | null }
  investors: { contact_name: string; fund_name: string | null }
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; investor?: string; deal?: string }>
}) {
  const { from, to, investor, deal } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('share_records')
    .select(`
      id,
      created_at,
      batch_id,
      deals (company_name, website_url, one_liner),
      investors (contact_name, fund_name)
    `)
    .order('created_at', { ascending: false })

  if (from) query = query.gte('created_at', `${from}T00:00:00`)
  if (to) query = query.lte('created_at', `${to}T23:59:59`)
  if (investor) query = query.eq('investor_id', investor)
  if (deal) query = query.eq('deal_id', deal)

  const { data: records } = await query

  // Group by batch
  const batches = new Map<string, { date: string; investor: string; deals: string[] }>()
  for (const r of (records || []) as unknown as ShareRecordWithDetails[]) {
    const existing = batches.get(r.batch_id)
    const dealText = `${r.deals.company_name}${r.deals.one_liner ? ' - ' + r.deals.one_liner : ''}`
    if (existing) {
      existing.deals.push(dealText)
    } else {
      batches.set(r.batch_id, {
        date: new Date(r.created_at).toLocaleDateString(),
        investor: `${r.investors.contact_name}${r.investors.fund_name ? ' @ ' + r.investors.fund_name : ''}`,
        deals: [dealText],
      })
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Share History</h1>

      <form className="flex items-center gap-3 text-sm">
        <label className="text-gray-600">From:</label>
        <input type="date" name="from" defaultValue={from} className="px-2 py-1 border rounded" />
        <label className="text-gray-600">To:</label>
        <input type="date" name="to" defaultValue={to} className="px-2 py-1 border rounded" />
        <button type="submit" className="px-3 py-1 bg-black text-white rounded hover:bg-gray-800">
          Filter
        </button>
      </form>

      {batches.size === 0 ? (
        <p className="text-gray-500 text-sm">No share history yet.</p>
      ) : (
        <div className="space-y-4">
          {Array.from(batches.entries()).map(([batchId, batch]) => (
            <div key={batchId} className="border rounded-lg p-4 bg-white">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-sm font-medium">{batch.investor}</span>
                <span className="text-xs text-gray-500">{batch.date}</span>
                <span className="text-xs text-gray-400">{batch.deals.length} deal(s)</span>
              </div>
              <ul className="text-sm text-gray-600 space-y-1">
                {batch.deals.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/history/
git commit -m "feat: add share history page with date filtering and batch grouping"
```

---

### Task 13: Final Testing & Polish

**Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass.

**Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds with no errors.

**Step 3: Manual end-to-end test**

Run: `npm run dev`

Test the full workflow:
1. Log in
2. Go to Deals, paste deal text, extract, review, assign priorities, confirm
3. Go to Deals, use voice input, verify transcript populates text box
4. Go to Investors, type NL description, extract, review, set threshold + frequency, confirm
5. Go to Share Lists, select date range, click through investors, verify deals filtered by priority
6. Finalise a share list, verify text output, copy to clipboard
7. Go to History, verify share records appear grouped by batch
8. Go back to Share Lists, verify previously shared deals are flagged

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore: final polish and testing"
```
