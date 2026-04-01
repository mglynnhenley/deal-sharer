-- Allow any authenticated user to delete deals
drop policy if exists "Creator can delete deals" on deals;
drop policy if exists "Creator can delete fund deals" on deals;
create policy "Authenticated users can delete deals" on deals for delete using (
  auth.uid() is not null
);
