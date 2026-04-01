-- Add the missing fund_id column to deals
ALTER TABLE deals ADD COLUMN fund_id uuid REFERENCES funds(id);

-- Backfill fund_id from the deal creator's profile
UPDATE deals d
SET fund_id = p.fund_id
FROM profiles p
WHERE p.id = d.created_by;

-- For deals whose creator has no profile, resolve fund from their email domain.
-- This avoids deleting deals just because the profile wasn't created yet.
UPDATE deals d
SET fund_id = f.id
FROM auth.users u
JOIN funds f ON f.domain = split_part(u.email, '@', 2)
WHERE d.fund_id IS NULL
  AND u.id = d.created_by;

-- Last resort: create profiles + funds for any remaining orphaned deal creators
DO $$
DECLARE
  r RECORD;
  _domain text;
  _fund_id uuid;
  _is_personal boolean;
BEGIN
  FOR r IN
    SELECT DISTINCT d.created_by, u.email
    FROM deals d
    JOIN auth.users u ON u.id = d.created_by
    WHERE d.fund_id IS NULL
  LOOP
    _domain := split_part(r.email, '@', 2);
    SELECT EXISTS(SELECT 1 FROM personal_domains WHERE domain = _domain) INTO _is_personal;

    IF _is_personal THEN
      INSERT INTO funds (is_personal) VALUES (true) RETURNING id INTO _fund_id;
    ELSE
      INSERT INTO funds (domain) VALUES (_domain)
        ON CONFLICT (domain) WHERE domain IS NOT NULL DO NOTHING;
      SELECT id INTO _fund_id FROM funds WHERE domain = _domain;
    END IF;

    INSERT INTO profiles (id, fund_id, email_domain)
      VALUES (r.created_by, _fund_id, _domain)
      ON CONFLICT (id) DO NOTHING;

    UPDATE deals SET fund_id = _fund_id WHERE created_by = r.created_by AND fund_id IS NULL;
  END LOOP;
END;
$$;

-- Now make it NOT NULL
ALTER TABLE deals ALTER COLUMN fund_id SET NOT NULL;

-- Add the missing index
CREATE INDEX IF NOT EXISTS idx_deals_fund ON deals(fund_id);

-- Fix RLS policies: replace permissive policies with fund-scoped ones
DROP POLICY IF EXISTS "Authenticated users can view all deals" ON deals;
DROP POLICY IF EXISTS "Authenticated users can insert deals" ON deals;
DROP POLICY IF EXISTS "Anyone can update deals" ON deals;

CREATE POLICY "Users can view fund deals" ON deals FOR SELECT USING (
  fund_id = (SELECT fund_id FROM profiles WHERE id = auth.uid())
);
CREATE POLICY "Users can insert fund deals" ON deals FOR INSERT WITH CHECK (
  fund_id = (SELECT fund_id FROM profiles WHERE id = auth.uid())
);
CREATE POLICY "Creator can update fund deals" ON deals FOR UPDATE USING (
  created_by = auth.uid() AND fund_id = (SELECT fund_id FROM profiles WHERE id = auth.uid())
);
-- DELETE policy ("Authenticated users can delete deals") is already correct per migration 003
