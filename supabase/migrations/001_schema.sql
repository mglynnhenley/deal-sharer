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
