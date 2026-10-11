-- EVENT FAVOURS customer profile and optional newsletter, no payments/orders.
create table if not exists public.customer_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.customer_profiles enable row level security;
revoke all on public.customer_profiles from anon, authenticated;
grant select, insert, update on public.customer_profiles to authenticated;
drop policy if exists "Customers read own profile" on public.customer_profiles;
create policy "Customers read own profile" on public.customer_profiles for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Customers create own profile" on public.customer_profiles;
create policy "Customers create own profile" on public.customer_profiles for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "Customers update own profile" on public.customer_profiles;
create policy "Customers update own profile" on public.customer_profiles for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table if not exists public.newsletter_subscribers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null check (position('@' in email) > 1),
  consent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.newsletter_subscribers enable row level security;
revoke all on public.newsletter_subscribers from anon, authenticated;
grant select, insert, delete on public.newsletter_subscribers to authenticated;
drop policy if exists "Customers read own subscription" on public.newsletter_subscribers;
create policy "Customers read own subscription" on public.newsletter_subscribers for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Customers subscribe own verified email" on public.newsletter_subscribers;
create policy "Customers subscribe own verified email" on public.newsletter_subscribers for insert to authenticated with check (user_id = (select auth.uid()) and lower(email) = lower((select auth.jwt()->>'email')));
drop policy if exists "Customers unsubscribe themselves" on public.newsletter_subscribers;
create policy "Customers unsubscribe themselves" on public.newsletter_subscribers for delete to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Admins read newsletter subscribers" on public.newsletter_subscribers;
create policy "Admins read newsletter subscribers" on public.newsletter_subscribers for select to authenticated using (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));
