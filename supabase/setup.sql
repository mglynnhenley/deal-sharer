-- =============================================================
-- Deal Sharer — Full Database Setup (fresh Supabase project)
-- Run this in the Supabase SQL Editor on a brand-new project.
-- =============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- -------------------------------------------------------
-- 1. Personal email domain blocklist
-- -------------------------------------------------------
CREATE TABLE personal_domains (
  domain TEXT PRIMARY KEY
);

INSERT INTO personal_domains (domain) VALUES
  ('gmail.com'), ('outlook.com'), ('yahoo.com'), ('hotmail.com'),
  ('icloud.com'), ('protonmail.com'), ('proton.me'), ('aol.com'),
  ('live.com'), ('msn.com'), ('mail.com'), ('zoho.com'),
  ('gmx.com'), ('fastmail.com'), ('yahoo.co.uk'), ('outlook.co.uk');

-- -------------------------------------------------------
-- 2. Funds (one per company domain, or one per personal user)
-- -------------------------------------------------------
CREATE TABLE funds (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain     TEXT,
  is_personal BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_funds_domain ON funds(domain) WHERE domain IS NOT NULL;

-- -------------------------------------------------------
-- 3. User profiles (links auth user → fund)
-- -------------------------------------------------------
CREATE TABLE profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  fund_id      UUID NOT NULL REFERENCES funds(id),
  email_domain TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_fund ON profiles(fund_id);

-- -------------------------------------------------------
-- 4. Deals (shared within a fund)
-- -------------------------------------------------------
CREATE TABLE deals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by   UUID NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
  fund_id      UUID NOT NULL REFERENCES funds(id),
  company_name TEXT NOT NULL,
  website_url  TEXT,
  linkedin_url TEXT,
  one_liner    TEXT,
  sectors      TEXT[] DEFAULT '{}',
  stage        TEXT
);

CREATE INDEX idx_deals_created_at        ON deals(created_at DESC);
CREATE INDEX idx_deals_company_name_trgm ON deals USING gin (company_name gin_trgm_ops);
CREATE INDEX idx_deals_fund              ON deals(fund_id);
CREATE INDEX idx_deals_sectors           ON deals USING gin (sectors);

-- -------------------------------------------------------
-- 5. User deals (per-user metadata on shared deals)
-- -------------------------------------------------------
CREATE TABLE user_deals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
  deal_id         UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  raise_amount    NUMERIC,
  currency        TEXT DEFAULT 'EUR',
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'passed', 'closed')),
  raw_source_text TEXT,
  UNIQUE(user_id, deal_id)
);

CREATE INDEX idx_user_deals_user      ON user_deals(user_id);
CREATE INDEX idx_user_deals_deal      ON user_deals(deal_id);
CREATE INDEX idx_user_deals_user_deal ON user_deals(user_id, deal_id);

-- -------------------------------------------------------
-- 6. Investors (per-user contact list)
-- -------------------------------------------------------
CREATE TABLE investors (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  contact_name        TEXT NOT NULL,
  fund_name           TEXT,
  email               TEXT,
  phone               TEXT,
  linkedin_url        TEXT,
  sharing_frequency   TEXT NOT NULL DEFAULT 'weekly' CHECK (sharing_frequency IN ('weekly', 'bi-weekly', 'monthly')),
  sectors             TEXT[] DEFAULT '{}',
  stages              TEXT[] DEFAULT '{}',
  thesis_description  TEXT,
  raw_source_text     TEXT
);

CREATE INDEX idx_investors_user ON investors(user_id);

-- -------------------------------------------------------
-- 7. Share records (audit trail of deals shared with investors)
-- -------------------------------------------------------
CREATE TABLE share_records (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  investor_id UUID NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
  deal_id     UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  batch_id    UUID NOT NULL
);

CREATE INDEX idx_share_records_user     ON share_records(user_id);
CREATE INDEX idx_share_records_investor ON share_records(investor_id);
CREATE INDEX idx_share_records_deal     ON share_records(deal_id);
CREATE INDEX idx_share_records_batch    ON share_records(batch_id);

-- -------------------------------------------------------
-- 8. Auto-assign fund on user signup (trigger)
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _domain      TEXT;
  _fund_id     UUID;
  _is_personal BOOLEAN;
BEGIN
  _domain := split_part(NEW.email, '@', 2);

  SELECT EXISTS(SELECT 1 FROM personal_domains WHERE domain = _domain)
    INTO _is_personal;

  IF _is_personal THEN
    INSERT INTO funds (is_personal) VALUES (true) RETURNING id INTO _fund_id;
  ELSE
    INSERT INTO funds (domain) VALUES (_domain)
      ON CONFLICT (domain) WHERE domain IS NOT NULL DO NOTHING;
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

-- -------------------------------------------------------
-- 9. Helper: get or create current user's fund_id
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION get_my_fund_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _fund_id     UUID;
  _domain      TEXT;
  _is_personal BOOLEAN;
  _email       TEXT;
BEGIN
  -- Fast path: profile already exists
  SELECT fund_id INTO _fund_id FROM profiles WHERE id = auth.uid();
  IF found THEN
    RETURN _fund_id;
  END IF;

  -- Profile missing — create it (same logic as handle_new_user trigger)
  SELECT email INTO _email FROM auth.users WHERE id = auth.uid();
  IF _email IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  _domain := split_part(_email, '@', 2);

  SELECT EXISTS(SELECT 1 FROM personal_domains WHERE domain = _domain)
    INTO _is_personal;

  IF _is_personal THEN
    INSERT INTO funds (is_personal) VALUES (true) RETURNING id INTO _fund_id;
  ELSE
    INSERT INTO funds (domain) VALUES (_domain)
      ON CONFLICT (domain) WHERE domain IS NOT NULL DO NOTHING;
    SELECT id INTO _fund_id FROM funds WHERE domain = _domain;
  END IF;

  INSERT INTO profiles (id, fund_id, email_domain)
    VALUES (auth.uid(), _fund_id, _domain);

  RETURN _fund_id;
END;
$$;

-- -------------------------------------------------------
-- 10. Row Level Security
-- -------------------------------------------------------
ALTER TABLE personal_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE funds            ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals            ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_deals       ENABLE ROW LEVEL SECURITY;
ALTER TABLE investors        ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_records    ENABLE ROW LEVEL SECURITY;

-- personal_domains: read-only for authenticated users
CREATE POLICY "Authenticated users can read personal_domains"
  ON personal_domains FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- funds: users can only see their own fund
CREATE POLICY "Users can view own fund"
  ON funds FOR SELECT
  USING (id = (SELECT fund_id FROM profiles WHERE id = auth.uid()));

-- profiles: users can only see own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

-- deals: fund-scoped access
CREATE POLICY "Users can view fund deals"
  ON deals FOR SELECT
  USING (fund_id = (SELECT fund_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert fund deals"
  ON deals FOR INSERT
  WITH CHECK (fund_id = (SELECT fund_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Fund members can update deals"
  ON deals FOR UPDATE
  USING (fund_id = (SELECT fund_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Fund members can delete deals"
  ON deals FOR DELETE
  USING (fund_id = (SELECT fund_id FROM profiles WHERE id = auth.uid()));

-- user_deals: scoped per user
CREATE POLICY "Users can view own user_deals"
  ON user_deals FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own user_deals"
  ON user_deals FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own user_deals"
  ON user_deals FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own user_deals"
  ON user_deals FOR DELETE USING (user_id = auth.uid());

-- investors: scoped per user
CREATE POLICY "Users can view own investors"
  ON investors FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own investors"
  ON investors FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own investors"
  ON investors FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own investors"
  ON investors FOR DELETE USING (user_id = auth.uid());

-- share_records: scoped per user
CREATE POLICY "Users can view own share records"
  ON share_records FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own share records"
  ON share_records FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own share records"
  ON share_records FOR DELETE USING (user_id = auth.uid());
