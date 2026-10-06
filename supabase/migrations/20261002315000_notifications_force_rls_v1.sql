-- Defense in depth: enforce notification RLS even for table owners.
alter table public.notifications force row level security;
