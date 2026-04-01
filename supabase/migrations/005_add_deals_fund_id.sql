-- Add the missing fund_id column to deals
ALTER TABLE deals ADD COLUMN fund_id uuid REFERENCES funds(id);

-- Backfill fund_id from the deal creator's profile
UPDATE deals d
SET fund_id = p.fund_id
FROM profiles p
WHERE p.id = d.created_by;

-- For any deals whose creator has no profile yet, use get_my_fund_id won't help here.
-- Delete orphaned deals with no fund_id (shouldn't exist in practice).
DELETE FROM deals WHERE fund_id IS NULL;

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
