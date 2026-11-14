-- Isolation des données par entreprise (RLS).

create schema if not exists private;
grant usage on schema private to authenticated;

-- security definer : lit organization_members sans repasser par sa propre RLS.
create function private.is_org_member(org uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = org and m.user_id = (select auth.uid())
  );
$$;

create function private.is_org_admin(org uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = org and m.user_id = (select auth.uid()) and m.role = 'admin'
  );
$$;

revoke all on function private.is_org_member(uuid), private.is_org_admin(uuid) from public;
grant execute on function private.is_org_member(uuid), private.is_org_admin(uuid) to authenticated;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;

-- Les entreprises et les adhésions se créent uniquement via create_organization() (0004).
create policy organizations_select on public.organizations
  for select to authenticated using (private.is_org_member(id));
create policy organizations_update on public.organizations
  for update to authenticated
  using (private.is_org_admin(id)) with check (private.is_org_admin(id));

create policy organization_members_select on public.organization_members
  for select to authenticated using (private.is_org_member(organization_id));

do $$
declare
  t text;
begin
  foreach t in array array[
    'exchange_rates', 'suppliers', 'purchase_orders', 'purchase_order_items',
    'shipments', 'shipment_items', 'shipment_events', 'documents', 'shipment_costs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (private.is_org_member(organization_id))
         with check (private.is_org_member(organization_id))',
      t || '_members', t);
  end loop;
end;
$$;

-- Aucun accès anonyme aux tables.
revoke all on all tables in schema public from anon;
revoke execute on function public.log_shipment_status() from public, anon, authenticated;
