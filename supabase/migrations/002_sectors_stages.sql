-- Add sectors and stage to deals table (shared fields)
ALTER TABLE deals ADD COLUMN sectors text[] DEFAULT '{}';
ALTER TABLE deals ADD COLUMN stage text;

-- Add stages to investors table
ALTER TABLE investors ADD COLUMN stages text[] DEFAULT '{}';

-- Migrate sector data: merge per-user sectors into shared deals.sectors
UPDATE deals d
SET sectors = sub.sectors_arr
FROM (
  SELECT deal_id, ARRAY_AGG(DISTINCT sector) AS sectors_arr
  FROM user_deals
  WHERE sector IS NOT NULL AND sector != ''
  GROUP BY deal_id
) sub
WHERE d.id = sub.deal_id;

-- Drop deprecated columns
ALTER TABLE user_deals DROP COLUMN priority;
ALTER TABLE user_deals DROP COLUMN sector;
ALTER TABLE user_deals DROP COLUMN one_liner;
ALTER TABLE investors DROP COLUMN priority_threshold;

-- Index for sector array queries
CREATE INDEX idx_deals_sectors ON deals USING gin (sectors);
