# Multi-Fund Isolation via Email Domain

## Problem

All authenticated users currently see all deals. The app needs to support multiple funds where each fund's deals are private. Fund membership is determined by the user's email domain.

## Decisions

- **Fund = email domain.** No admin UI needed. `@northzone.com` users are in the same fund automatically.
- **Completely separate deals.** No cross-fund dedup, no shared deal records. Each fund has its own deal pool.
- **Investors and share history stay per-user.** Fund scoping only affects deals.
- **Self-signup.** Anyone can create an account with their work email. Email confirmation must be enabled in Supabase project settings to prevent domain spoofing.
- **Personal email domains (gmail, outlook, etc.) treated as solo.** Each personal-domain user gets their own isolated fund.
- **Domain string is the fund identifier.** No fund names or settings for now.

## Data Model

### New table: `funds`

| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| domain | text, nullable | e.g. `northzone.com`. NULL for personal-domain funds. |
| is_personal | boolean, default false | true for gmail, outlook, yahoo, etc. |
| created_at | timestamptz | |

Work-domain funds have a UNIQUE constraint on `domain` (partial: `WHERE domain IS NOT NULL`). Personal-domain funds have `domain = NULL` — each personal user gets their own fund row, distinguished by `id`.

### New table: `profiles`

| Column | Type | Notes |
|---|---|---|
| id | uuid, PK, FK auth.users | |
| fund_id | uuid, FK funds, NOT NULL | |
| email_domain | text, NOT NULL | extracted from email |
| created_at | timestamptz | |

### Modified table: `deals`

Add column:

| Column | Type | Notes |
|---|---|---|
| fund_id | uuid, FK funds, NOT NULL | set automatically from user's profile |

### New indexes

```sql
CREATE INDEX idx_deals_fund ON deals(fund_id);
CREATE INDEX idx_profiles_fund ON profiles(fund_id);
```

## Personal Email Handling

Personal domains are tracked in a `personal_domains` table for easy extensibility:

```sql
CREATE TABLE personal_domains (
  domain text PRIMARY KEY
);
INSERT INTO personal_domains (domain) VALUES
  ('gmail.com'), ('outlook.com'), ('yahoo.com'), ('hotmail.com'),
  ('icloud.com'), ('protonmail.com'), ('proton.me'), ('aol.com'),
  ('live.com'), ('msn.com'), ('mail.com'), ('zoho.com'),
  ('gmx.com'), ('fastmail.com'), ('yahoo.co.uk'), ('outlook.co.uk');
```

This can be extended via a simple INSERT without code changes.

## Signup Flow

1. User enters email + password on `/signup` page.
2. `supabase.auth.signUp()` creates the auth user.
3. Supabase sends a confirmation email (must be enabled in dashboard).
4. User clicks confirmation link, account is activated.
5. An `AFTER INSERT` trigger on `auth.users` fires and:
   a. Extracts domain from `new.email` (e.g. `split_part(new.email, '@', 2)`).
   b. Checks if domain exists in `personal_domains` table.
   c. If personal: creates a new fund with `is_personal = true`, `domain = NULL`.
   d. If work: uses `INSERT INTO funds (domain) VALUES (...) ON CONFLICT (domain) DO NOTHING`, then SELECTs the fund by domain. This handles concurrent signups safely.
   e. Inserts a `profiles` row linking user to fund.

The trigger function is `SECURITY DEFINER` to bypass RLS (it needs to INSERT into `funds` and `profiles`).

### Trigger SQL

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _domain text;
  _fund_id uuid;
  _is_personal boolean;
BEGIN
  _domain := split_part(NEW.email, '@', 2);

  SELECT EXISTS(SELECT 1 FROM personal_domains WHERE domain = _domain)
    INTO _is_personal;

  IF _is_personal THEN
    INSERT INTO funds (is_personal) VALUES (true) RETURNING id INTO _fund_id;
  ELSE
    INSERT INTO funds (domain) VALUES (_domain)
      ON CONFLICT (domain) DO NOTHING;
    SELECT id INTO _fund_id FROM funds WHERE domain = _domain;
  END IF;

  INSERT INTO profiles (id, fund_id, email_domain)
    VALUES (NEW.id, _fund_id, _domain);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

## Migration Strategy for Existing Data

Existing users and deals need to be backfilled:

1. Create a default fund for the existing user's email domain.
2. Create a profile for the existing user linking to that fund.
3. Backfill `fund_id` on all existing deals using the creator's fund.
4. Then add the `NOT NULL` constraint.

```sql
-- Step 1: Add fund_id as nullable first
ALTER TABLE deals ADD COLUMN fund_id uuid REFERENCES funds(id);

-- Step 2: Backfill via a migration script that:
--   a. For each distinct created_by in deals, look up their email from auth.users
--   b. Extract domain, find or create fund
--   c. Create profile if missing
--   d. UPDATE deals SET fund_id = profile.fund_id WHERE created_by = user.id

-- Step 3: Add NOT NULL constraint after backfill
ALTER TABLE deals ALTER COLUMN fund_id SET NOT NULL;
```

For a fresh database (no existing data), `fund_id uuid NOT NULL` can be used directly in the schema.

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

UPDATE and DELETE policies keep the `created_by = auth.uid()` check, but add the fund check too:
```sql
-- UPDATE/DELETE: creator only, same fund
created_by = auth.uid() AND fund_id = (SELECT fund_id FROM profiles WHERE id = auth.uid())
```

### `funds` table

Users can only see their own fund row:
```sql
-- SELECT: own fund only (prevents enumeration of all company domains)
id = (SELECT fund_id FROM profiles WHERE id = auth.uid())
```

No INSERT/UPDATE/DELETE from client — managed by trigger.

### `profiles` table

Users can only see their own profile:
```sql
-- SELECT: own profile only
id = auth.uid()
```

No INSERT/UPDATE/DELETE from client — managed by trigger.

### `personal_domains` table

Read-only for authenticated users (needed by nothing on client, but harmless):
```sql
-- SELECT: any authenticated user
auth.uid() IS NOT NULL
```

No INSERT/UPDATE/DELETE from client.

### `user_deals`, `investors`, `share_records`

No changes. Already scoped per-user via `user_id = auth.uid()`.

Note: `share_records` joins to `deals` via FK. After fund isolation, the RLS on `deals` ensures that deal data in joins is only visible for same-fund deals. Historical share records continue to work because the deals they reference belong to the user's fund.

## Dedup Changes

The `saveDeals` action currently fetches all deals for dedup:
```ts
const { data: existingData } = await supabase
  .from('deals')
  .select('id, company_name, website_url, linkedin_url')
```

After RLS changes, this query automatically returns only the user's fund's deals. No code change needed for the dedup query itself.

The `deals.fund_id` must be set on INSERT. The `saveDeals` action needs a helper to fetch the user's fund_id:

```ts
async function getUserFundId(): Promise<string> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('fund_id')
    .single()
  if (!data) throw new Error('User profile not found')
  return data.fund_id
}
```

This is called in `saveDeals` and the fund_id is included in every `deals` INSERT.

## Field Whitelisting in updateDeal

The existing `updateDeal` action accepts an arbitrary `field` string from the client. Post-migration, a client could attempt `updateDeal(id, 'fund_id', 'other-fund-uuid')`. While RLS WITH CHECK would block this, the action should also whitelist allowed fields as defense-in-depth:

```ts
const SHARED_FIELDS = new Set(['company_name', 'website_url', 'linkedin_url'])
const USER_FIELDS = new Set(['one_liner', 'priority', 'status', 'sector', 'raise_amount', 'currency'])

// Reject any field not in the whitelist
if (!SHARED_FIELDS.has(field) && !USER_FIELDS.has(field)) {
  return { error: 'Invalid field' }
}
```

## New Pages

### `/signup`

Simple email + password form, same style as `/login`. Calls `supabase.auth.signUp()`. On success, shows "Check your email to confirm your account" message. On error, displays message.

### `/login` changes

Add a link to `/signup` ("Don't have an account? Sign up").

## File Changes Summary

| File | Change |
|---|---|
| `supabase/migrations/001_schema.sql` | Add `funds`, `profiles`, `personal_domains` tables; `fund_id` on deals; trigger; updated RLS; indexes |
| `src/lib/supabase/types.ts` | Add `Fund`, `Profile` types; add `fund_id` to `SharedDeal` |
| `src/app/deals/actions.ts` | Add `getUserFundId` helper; include `fund_id` in deal INSERT; add field whitelist to `updateDeal` |
| `src/app/signup/page.tsx` | New signup page |
| `src/app/signup/actions.ts` | New signup action |
| `src/app/login/page.tsx` | Add link to signup |
| `src/middleware.ts` | Allow `/signup` as unprotected route |
| `src/app/history/page.tsx` | No code change needed — deals join is fund-scoped by RLS |
| `src/components/deals/DealList.tsx` | No code change needed — "Team deal" label still accurate (team = fund) |
| `src/components/deals/DealInput.tsx` | No change — calls `saveDeals` which handles fund_id |
| `src/components/investors/InvestorInput.tsx` | No change |
| `src/components/Nav.tsx` | No change |

## Security Considerations

- **Email confirmation required.** Must be enabled in Supabase dashboard. Without it, anyone could sign up as `attacker@yourfund.com` and see your deals.
- **Fund assignment in DB trigger.** Cannot be bypassed by client code. `SECURITY DEFINER` with `SET search_path = public` prevents search_path attacks.
- **RLS enforces fund isolation.** Even buggy app code cannot leak data across funds.
- **`funds` table SELECT restricted to own fund.** Prevents enumeration of all company domains using the app.
- **Field whitelisting.** `updateDeal` rejects unknown fields, preventing `fund_id` injection.
- **`fund_id` WITH CHECK on INSERT.** Users cannot insert deals into another fund.
- **Personal email users fully isolated.** Each gets their own fund with no domain sharing.

## Out of Scope

- Email change handling (user changes email domain). Can be added later via an UPDATE trigger on `auth.users`.
- Fund admin features (naming, settings, member management).
- Cross-fund deal sharing or collaboration.
- Deal detail page (`/deals/[id]`) — currently deleted from working tree.
