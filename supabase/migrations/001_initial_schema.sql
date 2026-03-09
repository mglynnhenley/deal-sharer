-- Deals table
create table deals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  company_name text not null,
  website_url text,
  one_liner text,
  raise_amount numeric,
  currency text default 'EUR',
  sector text,
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
  sectors text[] default '{}',
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
