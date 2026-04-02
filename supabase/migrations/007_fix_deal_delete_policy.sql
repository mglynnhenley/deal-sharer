-- Fix cross-fund delete vulnerability: scope deal deletion to fund members only.
-- Migration 003 set the policy to allow ANY authenticated user to delete ANY deal.
DROP POLICY IF EXISTS "Authenticated users can delete deals" ON deals;
CREATE POLICY "Fund members can delete deals" ON deals FOR DELETE USING (
  fund_id = (SELECT fund_id FROM profiles WHERE id = auth.uid())
);
