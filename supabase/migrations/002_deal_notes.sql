-- Deal notes table
create table deal_notes (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals(id) on delete cascade,
  content text not null,
  summary text,
  created_at timestamptz not null default now()
);

create index idx_deal_notes_deal_id on deal_notes(deal_id);
create index idx_deal_notes_created_at on deal_notes(created_at desc);

-- Add notes summary to deals
alter table deals add column notes_summary text;
