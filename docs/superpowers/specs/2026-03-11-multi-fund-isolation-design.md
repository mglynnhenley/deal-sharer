# Multi-Fund Isolation via Email Domain

## Problem

All authenticated users currently see all deals. The app needs to support multiple funds where each fund's deals are private. Fund membership is determined by the user's email domain.

## Decisions

- **Fund = email domain.** No admin UI needed. `@northzone.com` users are in the same fund automatically.
- **Completely separate deals.** No cross-fund dedup, no shared deal records. Each fund has its own deal pool.
- **Investors and share history stay per-user.** Fund scoping only affects deals.
- **Self-signup.** Anyone can create an account with their work email.
- **Personal email domains (gmail, outlook, etc.) treated as solo.** Each personal-domain user gets their own isolated fund.
- **Domain string is the fund identifier.** No fund names or settings for now.

## Data Model

### New table: `funds`

| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| domain | text, unique | e.g. `northzone.com` |
| is_personal | boolean | true for gmail, outlook, yahoo, etc. |
| created_at | timestamptz | |

For personal domains, each user gets a unique fund row (domain stored as `gmail.com:<user_id>` to keep uniqueness).

### New table: `profiles`

| Column | Type | Notes |
|---|---|---|
| id | uuid, PK, FK auth.users | |
| fund_id | uuid, FK funds | |
| email_domain | text | extracted from email |
| created_at | timestamptz | |

### Modified table: `deals`

Add column:

| Column | Type | Notes |
|---|---|---|
| fund_id | uuid, FK funds, NOT NULL | set automatically from user's profile |

## Signup Flow

1. User enters email + password on `/signup` page.
2. `supabase.auth.signUp()` creates the auth user.
3. A Postgres trigger on `auth.users` INSERT:
   a. Extracts domain from `new.email`.
   b. Checks if domain is in a personal blocklist (`gmail.com`, `outlook.com`, `yahoo.com`, `hotmail.com`, `icloud.com`, `protonmail.com`, `proton.me`).
   c. If personal: creates a new fund with `is_personal = true` and domain = `<domain>:<user_id>`.
   d. If work: finds existing fund by domain or creates one with `is_personal = false`.
   e. Inserts a `profiles` row linking user to fund.

All logic is in the database trigger — atomic, cannot be bypassed by client code.

## RLS Policy Changes

### `deals` table

**Before:**
```sql
-- SELECT: any authenticated user sees all deals
auth.uid() IS NOT NULL
```

**After:**
```sql
-- SELECT: user sees only their fund's deals
fund_id = (SELECT fund_id FROM profiles WHERE id = auth.uid())
```

**INSERT:**
```sql
-- WITH CHECK: deals must belong to user's fund
fund_id = (SELECT fund_id FROM profiles WHERE id = auth.uid())
```

UPDATE and DELETE policies unchanged (still creator-only), but implicitly scoped by the SELECT policy.

### `funds` and `profiles` tables

- `funds`: authenticated users can SELECT any fund (needed for RLS subqueries). No INSERT/UPDATE/DELETE from client.
- `profiles`: users can SELECT their own profile. No INSERT/UPDATE/DELETE from client (managed by trigger).

### `user_deals`, `investors`, `share_records`

No changes. Already scoped per-user via `user_id = auth.uid()`.

## Dedup Changes

The `saveDeals` action currently fetches all deals for dedup:
```ts
const { data: existingData } = await supabase
  .from('deals')
  .select('id, company_name, website_url, linkedin_url')
```

After RLS changes, this query automatically returns only the user's fund's deals. No code change needed — RLS handles the scoping.

The `deals.fund_id` must be set on INSERT. The `saveDeals` action needs to fetch the user's fund_id from profiles and include it in the insert.

## New Pages

### `/signup`

Simple email + password form, same style as `/login`. Calls `supabase.auth.signUp()`. On success, redirects to `/`. On error, displays message.

The signup action should also handle the case where email confirmation is enabled — show a "check your email" message instead of redirecting.

### `/login` changes

Add a link to `/signup` ("Don't have an account? Sign up").

## File Changes Summary

| File | Change |
|---|---|
| `supabase/migrations/001_schema.sql` | Add `funds` table, `profiles` table, `fund_id` on deals, trigger, updated RLS |
| `src/lib/supabase/types.ts` | Add `Fund`, `Profile` types |
| `src/app/deals/actions.ts` | Fetch user's fund_id, include in deal INSERT |
| `src/app/signup/page.tsx` | New signup page |
| `src/app/signup/actions.ts` | New signup action |
| `src/app/login/page.tsx` | Add link to signup |
| `src/middleware.ts` | Allow `/signup` as unprotected route |

## Security Considerations

- Fund assignment happens in a Postgres trigger, not client code. Users cannot choose or change their fund.
- RLS enforces fund isolation at the database level. Even if app code has bugs, data cannot leak across funds.
- Personal email users are fully isolated — they cannot see anyone else's deals.
- The `fund_id` on deals INSERT is validated by RLS WITH CHECK — users cannot insert deals into another fund.
