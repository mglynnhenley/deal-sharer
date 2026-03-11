# Multi-Fund Isolation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Isolate deals per fund (determined by email domain) so users only see their own fund's deals, with self-signup support.

**Architecture:** New `funds` and `profiles` tables establish fund membership. A Postgres trigger on `auth.users` INSERT auto-assigns users to funds based on email domain. RLS policies on `deals` filter by fund_id. Personal email domains (gmail, etc.) get isolated solo funds.

**Tech Stack:** Supabase (Postgres, Auth, RLS), Next.js 15, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-11-multi-fund-isolation-design.md`

---

## Chunk 1: Database Schema & App Code

### Task 1: Update migration with fund tables, trigger, and RLS

**Files:**
- Modify: `supabase/migrations/001_schema.sql`

This task rewrites the migration to include all new tables, the trigger, and updated RLS policies. Since this is a consolidated migration file (not incremental), we modify it directly.

- [ ] **Step 1: Add `funds`, `profiles`, `personal_domains` tables and `deals.fund_id` column**

Add these after the `create extension` line, before the `deals` table. Then modify `deals` to include `fund_id`. Full new schema:

```sql
-- Enable pg_trgm for fuzzy company name matching
create extension if not exists pg_trgm;

-- Personal email domains (extensible blocklist)
create table personal_domains (
  domain text primary key
);
insert into personal_domains (domain) values
  ('gmail.com'), ('outlook.com'), ('yahoo.com'), ('hotmail.com'),
  ('icloud.com'), ('protonmail.com'), ('proton.me'), ('aol.com'),
  ('live.com'), ('msn.com'), ('mail.com'), ('zoho.com'),
  ('gmx.com'), ('fastmail.com'), ('yahoo.co.uk'), ('outlook.co.uk');

-- Funds table (one per email domain, or one per personal-email user)
create table funds (
  id uuid primary key default gen_random_uuid(),
  domain text,
  is_personal boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index idx_funds_domain on funds(domain) where domain is not null;

-- User profiles (links auth user to fund)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  fund_id uuid not null references funds(id),
  email_domain text not null,
  created_at timestamptz not null default now()
);

-- Shared deals table (scoped per fund)
create table deals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) default auth.uid(),
  fund_id uuid not null references funds(id),
  company_name text not null,
  website_url text,
  linkedin_url text,
  one_liner text
);

-- Per-user deal metadata (each user has their own priority, description, etc.)
create table user_deals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  deal_id uuid not null references deals(id) on delete cascade,
  created_at timestamptz not null default now(),
  one_liner text,
  raise_amount numeric,
  currency text default 'EUR',
  sector text,
  priority int not null default 3 check (priority in (1, 2, 3)),
  status text not null default 'active' check (status in ('active', 'passed', 'closed')),
  raw_source_text text,
  unique(user_id, deal_id)
);

-- Investors table
create table investors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  contact_name text not null,
  fund_name text,
  email text,
  phone text,
  linkedin_url text,
  priority_threshold int not null default 3 check (priority_threshold in (1, 2, 3)),
  sharing_frequency text not null default 'weekly' check (sharing_frequency in ('weekly', 'bi-weekly', 'monthly')),
  sectors text[] default '{}',
  thesis_description text,
  raw_source_text text
);

-- Share records table
create table share_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  investor_id uuid not null references investors(id) on delete cascade,
  deal_id uuid not null references deals(id) on delete cascade,
  batch_id uuid not null
);
```

- [ ] **Step 2: Add all indexes (including new fund indexes)**

Replace the existing indexes section:

```sql
-- Indexes
create index idx_deals_created_at on deals(created_at desc);
create index idx_deals_company_name_trgm on deals using gin (company_name gin_trgm_ops);
create index idx_deals_fund on deals(fund_id);
create index idx_profiles_fund on profiles(fund_id);
create index idx_user_deals_user on user_deals(user_id);
create index idx_user_deals_deal on user_deals(deal_id);
create index idx_user_deals_user_deal on user_deals(user_id, deal_id);
create index idx_investors_user on investors(user_id);
create index idx_share_records_user on share_records(user_id);
create index idx_share_records_investor on share_records(investor_id);
create index idx_share_records_deal on share_records(deal_id);
create index idx_share_records_batch on share_records(batch_id);
```

- [ ] **Step 3: Add the trigger function and trigger**

Add after the indexes section, before RLS:

```sql
-- Trigger: auto-assign fund on user signup
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _domain text;
  _fund_id uuid;
  _is_personal boolean;
begin
  _domain := split_part(NEW.email, '@', 2);

  select exists(select 1 from personal_domains where domain = _domain)
    into _is_personal;

  if _is_personal then
    insert into funds (is_personal) values (true) returning id into _fund_id;
  else
    insert into funds (domain) values (_domain)
      on conflict (domain) do nothing;
    select id into _fund_id from funds where domain = _domain;
  end if;

  insert into profiles (id, fund_id, email_domain)
    values (NEW.id, _fund_id, _domain);

  return NEW;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
```

- [ ] **Step 4: Replace all RLS policies**

Replace the entire RLS section with:

```sql
-- Row Level Security
alter table personal_domains enable row level security;
alter table funds enable row level security;
alter table profiles enable row level security;
alter table deals enable row level security;
alter table user_deals enable row level security;
alter table investors enable row level security;
alter table share_records enable row level security;

-- Personal domains: read-only for authenticated users
create policy "Authenticated users can read personal_domains" on personal_domains for select using (auth.uid() is not null);

-- Funds: users can only see their own fund
create policy "Users can view own fund" on funds for select using (
  id = (select fund_id from profiles where id = auth.uid())
);

-- Profiles: users can only see own profile
create policy "Users can view own profile" on profiles for select using (id = auth.uid());

-- Deals: fund-scoped
create policy "Users can view fund deals" on deals for select using (
  fund_id = (select fund_id from profiles where id = auth.uid())
);
create policy "Users can insert fund deals" on deals for insert with check (
  fund_id = (select fund_id from profiles where id = auth.uid())
);
create policy "Creator can update fund deals" on deals for update using (
  created_by = auth.uid() and fund_id = (select fund_id from profiles where id = auth.uid())
);
create policy "Creator can delete fund deals" on deals for delete using (
  created_by = auth.uid() and fund_id = (select fund_id from profiles where id = auth.uid())
);

-- User deals: scoped per user
create policy "Users can view own user_deals" on user_deals for select using (user_id = auth.uid());
create policy "Users can insert own user_deals" on user_deals for insert with check (user_id = auth.uid());
create policy "Users can update own user_deals" on user_deals for update using (user_id = auth.uid());
create policy "Users can delete own user_deals" on user_deals for delete using (user_id = auth.uid());

-- Investors: scoped per user
create policy "Users can view own investors" on investors for select using (user_id = auth.uid());
create policy "Users can insert own investors" on investors for insert with check (user_id = auth.uid());
create policy "Users can update own investors" on investors for update using (user_id = auth.uid());
create policy "Users can delete own investors" on investors for delete using (user_id = auth.uid());

-- Share records: scoped per user
create policy "Users can view own share records" on share_records for select using (user_id = auth.uid());
create policy "Users can insert own share records" on share_records for insert with check (user_id = auth.uid());
create policy "Users can delete own share records" on share_records for delete using (user_id = auth.uid());
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/001_schema.sql
git commit -m "feat: add fund tables, trigger, and fund-scoped RLS policies"
```

---

### Task 2: Update TypeScript types

**Files:**
- Modify: `src/lib/supabase/types.ts`

- [ ] **Step 1: Add Fund and Profile types, add fund_id to SharedDeal**

Add `Fund` and `Profile` types at the top of the file. Add `fund_id` to `SharedDeal`:

```ts
/** Fund — one per email domain (or one per personal-email user) */
export type Fund = {
  id: string
  domain: string | null
  is_personal: boolean
  created_at: string
}

/** User profile — links auth user to fund */
export type Profile = {
  id: string
  fund_id: string
  email_domain: string
  created_at: string
}
```

In the existing `SharedDeal` type, add `fund_id` after `created_by`:

```ts
/** Shared deal record — visible to all fund members */
export type SharedDeal = {
  id: string
  created_at: string
  created_by: string
  fund_id: string
  company_name: string
  website_url: string | null
  linkedin_url: string | null
  one_liner: string | null
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase/types.ts
git commit -m "feat: add Fund, Profile types and fund_id to SharedDeal"
```

---

### Task 3: Update deal actions with fund_id and field whitelist

**Files:**
- Modify: `src/app/deals/actions.ts`

- [ ] **Step 1: Add getUserFundId helper and include fund_id in saveDeals**

Replace the entire `saveDeals` function and add a helper above it. The helper accepts a Supabase client to avoid creating a second connection. Note: `DealInsert` does not need a `fund_id` field — it's added server-side only.

Find this code in `src/app/deals/actions.ts`:

```ts
export async function saveDeals(deals: DealInsert[]) {
  const supabase = await createClient()

  // Fetch all existing shared deals for dedup
  const { data: existingData } = await supabase
    .from('deals')
    .select('id, company_name, website_url, linkedin_url')
```

Replace the first 3 lines of the function (keep everything after the dedup query) with:

```ts
export async function saveDeals(deals: DealInsert[]) {
  const supabase = await createClient()

  // Fetch user's fund_id for deal inserts
  const { data: profile } = await supabase
    .from('profiles')
    .select('fund_id')
    .single()
  if (!profile) return { error: 'User profile not found' }
  const fundId = profile.fund_id

  // Fetch all existing shared deals for dedup (RLS scopes to user's fund)
  const { data: existingData } = await supabase
    .from('deals')
    .select('id, company_name, website_url, linkedin_url')
```

Then update the deals INSERT (the `.insert({...})` call inside the `else` branch) to include `fund_id`:

```ts
      const { data: newDeal, error } = await supabase
        .from('deals')
        .insert({
          company_name: deal.company_name,
          website_url: deal.website_url,
          linkedin_url: deal.linkedin_url,
          one_liner: deal.one_liner,
          fund_id: fundId,
        })
        .select('id')
        .single()
```

- [ ] **Step 2: Add field whitelist to updateDeal**

Replace the existing `SHARED_FIELDS` constant (line 75) and add `USER_FIELDS`. Then add validation as the first line inside `updateDeal`, before the supabase client is created.

Full replacement — find this code:

```ts
const SHARED_FIELDS = new Set(['company_name', 'website_url', 'linkedin_url'])

export async function updateDeal(dealId: string, field: string, value: string | number | null) {
  const supabase = await createClient()

  if (SHARED_FIELDS.has(field)) {
```

Replace with:

```ts
const SHARED_FIELDS = new Set(['company_name', 'website_url', 'linkedin_url'])
const USER_FIELDS = new Set(['one_liner', 'priority', 'status', 'sector', 'raise_amount', 'currency'])

export async function updateDeal(dealId: string, field: string, value: string | number | null) {
  if (!SHARED_FIELDS.has(field) && !USER_FIELDS.has(field)) {
    return { error: 'Invalid field' }
  }

  const supabase = await createClient()

  if (SHARED_FIELDS.has(field)) {
```

- [ ] **Step 4: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/app/deals/actions.ts
git commit -m "feat: add fund_id to deal inserts and field whitelist to updateDeal"
```

---

### Task 4: Create signup page and action

**Files:**
- Create: `src/app/signup/actions.ts`
- Create: `src/app/signup/page.tsx`

- [ ] **Step 1: Create signup server action**

Create `src/app/signup/actions.ts`:

```ts
'use server'

import { createClient } from '@/lib/supabase/server'

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signUp({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}
```

- [ ] **Step 2: Create signup page**

Create `src/app/signup/page.tsx`:

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { signup } from './actions'

export default function SignupPage() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(formData: FormData) {
    setError(null)
    const result = await signup(formData)
    if (result.error) {
      setError(result.error)
    } else {
      setSuccess(true)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-full max-w-sm space-y-6 text-center">
          <h1 className="text-2xl font-bold">Check your email</h1>
          <p className="text-sm text-gray-600">
            We sent you a confirmation link. Click it to activate your account.
          </p>
          <Link href="/login" className="text-sm text-black underline">
            Back to login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-bold text-center">Sign up for Deal Sharer</h1>
        <form action={handleSubmit} className="space-y-4">
          <input
            name="email"
            type="email"
            placeholder="Work email"
            required
            className="w-full px-3 py-2 border rounded-md"
          />
          <input
            name="password"
            type="password"
            placeholder="Password"
            required
            minLength={8}
            className="w-full px-3 py-2 border rounded-md"
          />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            className="w-full py-2 bg-black text-white rounded-md hover:bg-gray-800"
          >
            Sign up
          </button>
        </form>
        <p className="text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link href="/login" className="text-black underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/app/signup/actions.ts src/app/signup/page.tsx
git commit -m "feat: add signup page with email confirmation flow"
```

---

### Task 5: Add auth callback route for email confirmation

**Files:**
- Create: `src/app/auth/callback/route.ts`

When a user clicks the email confirmation link, Supabase redirects them to `/auth/callback?code=...`. This route exchanges the auth code for a session. Without it, email confirmation silently fails.

- [ ] **Step 1: Create the callback route**

Create `src/app/auth/callback/route.ts`:

```ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(`${origin}/login`)
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/auth/callback/route.ts
git commit -m "feat: add auth callback route for email confirmation"
```

---

### Task 6: Update login page with signup link

**Files:**
- Modify: `src/app/login/page.tsx`

- [ ] **Step 1: Add signup link to login page**

Add a `Link` import at the top:

```ts
import Link from 'next/link'
```

Add this paragraph after the closing `</form>` tag, inside the `space-y-6` div:

```tsx
<p className="text-center text-sm text-gray-600">
  Don&apos;t have an account?{' '}
  <Link href="/signup" className="text-black underline">
    Sign up
  </Link>
</p>
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "feat: add signup link to login page"
```

---

### Task 7: Update middleware to allow /signup route

**Files:**
- Modify: `src/middleware.ts`

- [ ] **Step 1: Add /signup to unprotected routes**

In `src/middleware.ts`, update the redirect condition (line 28-32) to also allow `/signup`:

Change:
```ts
  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/auth')
  ) {
```

To:
```ts
  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/signup') &&
    !request.nextUrl.pathname.startsWith('/auth')
  ) {
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: allow unauthenticated access to /signup route"
```

---

### Task 8: Manual verification checklist

After all code changes are committed, verify the following:

- [ ] **Step 1: Apply migration to Supabase**

Go to Supabase dashboard > SQL Editor. If starting fresh, run the full `001_schema.sql`. If existing data, use the backfill migration from the spec (add `fund_id` as nullable, backfill, then set NOT NULL).

- [ ] **Step 2: Enable email confirmation**

Go to Supabase dashboard > Authentication > Providers > Email. Ensure "Confirm email" is toggled ON. This is critical for security — without it, anyone can spoof an email domain.

- [ ] **Step 3: Test signup flow**

1. Go to `/signup`, enter a work email + password.
2. Check email for confirmation link.
3. Click link, then log in at `/login`.
4. Verify you land on the deals page.

- [ ] **Step 4: Test fund isolation**

1. Create a deal as User A (`@funA.com`).
2. Sign up as User B (`@fundB.com`).
3. Verify User B cannot see User A's deals.
4. Create a deal as User B and verify User A cannot see it.

- [ ] **Step 5: Test personal email isolation**

1. Sign up with a `@gmail.com` email.
2. Verify you see no deals from any fund.
3. Create a deal and verify it's visible only to you.

- [ ] **Step 6: Test team deal flow within a fund**

1. Sign up two users with the same work domain.
2. User A creates a deal.
3. User B should see it as a "Team deal" and can "Add to my list".
4. Verify one-liner carries over.
