-- NUMERA COMMERCIAL AI : comptes, boutiques, équipe et journal d'opérations.
-- Tous les objets sont préfixés « commerce_ » : la base peut être partagée avec une autre application Numera.
-- Chaque boutique est un journal d'opérations (commerce_ops) rejoué par l'application.
-- Les règles d'accès (RLS) garantissent qu'un utilisateur ne voit que ses boutiques
-- et qu'un vendeur ne peut envoyer que les opérations autorisées.

create table public.commerce_shops (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  currency text not null default 'FCFA' check (char_length(currency) between 1 and 12),
  owner uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.commerce_members (
  shop_id uuid not null references public.commerce_shops (id) on delete cascade,
  email text not null check (email = lower(email)),
  role text not null check (role in ('owner', 'seller')),
  created_at timestamptz not null default now(),
  primary key (shop_id, email)
);
create index commerce_members_email_idx on public.commerce_members (email);

create table public.commerce_ops (
  shop_id uuid not null references public.commerce_shops (id) on delete cascade,
  seq bigint not null,
  id uuid not null unique,
  user_id uuid not null default auth.uid(),
  user_name text,
  action text not null,
  payload jsonb,
  ts timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (shop_id, seq)
);

-- Rôle de l'utilisateur connecté dans une boutique (null s'il n'en fait pas partie).
create function public.commerce_role(shop uuid) returns text
language sql stable security definer set search_path = '' as $$
  select m.role from public.commerce_members m
  where m.shop_id = shop and m.email = lower(auth.jwt() ->> 'email')
$$;

-- Numéro d'ordre par boutique, attribué sous verrou : l'ordre des numéros est l'ordre de validation.
create function public.commerce_assign_seq() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.shop_id::text, 0));
  select coalesce(max(o.seq), 0) + 1 into new.seq from public.commerce_ops o where o.shop_id = new.shop_id;
  new.user_id := auth.uid();
  new.created_at := now();
  return new;
end $$;
create trigger commerce_ops_seq before insert on public.commerce_ops
  for each row execute function public.commerce_assign_seq();

-- Création d'une boutique : le nom est fixé ici une fois pour toutes (aucune règle ne permet de le modifier).
create function public.commerce_create_shop(shop_name text, shop_currency text default 'FCFA') returns public.commerce_shops
language plpgsql security definer set search_path = '' as $$
declare
  result public.commerce_shops;
  email text := lower(auth.jwt() ->> 'email');
begin
  if auth.uid() is null or email is null then raise exception 'Connexion requise.'; end if;
  if (select count(*) from public.commerce_shops s where s.owner = auth.uid()) >= 20 then
    raise exception 'Nombre maximum de boutiques atteint.';
  end if;
  insert into public.commerce_shops (name, currency, owner)
    values (btrim(shop_name), coalesce(nullif(btrim(shop_currency), ''), 'FCFA'), auth.uid())
    returning * into result;
  insert into public.commerce_members (shop_id, email, role) values (result.id, email, 'owner');
  return result;
end $$;

alter table public.commerce_shops enable row level security;
alter table public.commerce_members enable row level security;
alter table public.commerce_ops enable row level security;

create policy shops_select on public.commerce_shops for select to authenticated
  using (public.commerce_role(id) is not null);
create policy shops_delete on public.commerce_shops for delete to authenticated
  using (owner = (select auth.uid()));

create policy members_select on public.commerce_members for select to authenticated
  using (public.commerce_role(shop_id) is not null);
create policy members_invite on public.commerce_members for insert to authenticated
  with check (public.commerce_role(shop_id) = 'owner' and role = 'seller');
create policy members_remove on public.commerce_members for delete to authenticated
  using (public.commerce_role(shop_id) = 'owner' and role = 'seller');

create policy ops_select on public.commerce_ops for select to authenticated
  using (public.commerce_role(shop_id) is not null);
create policy ops_insert on public.commerce_ops for insert to authenticated
  with check (
    public.commerce_role(shop_id) = 'owner'
    or (public.commerce_role(shop_id) = 'seller'
        and action in ('addSale', 'addReturn', 'saveCustomer', 'addPayment', 'addClosing'))
  );

-- Droits au strict nécessaire : rien pour les visiteurs anonymes.
revoke all on public.commerce_shops, public.commerce_members, public.commerce_ops from anon, authenticated;
grant select, delete on public.commerce_shops to authenticated;
grant select, insert, delete on public.commerce_members to authenticated;
grant select, insert on public.commerce_ops to authenticated;
revoke all on function public.commerce_role(uuid) from public, anon;
revoke all on function public.commerce_create_shop(text, text) from public, anon;
revoke all on function public.commerce_assign_seq() from public, anon, authenticated;
grant execute on function public.commerce_role(uuid) to authenticated;
grant execute on function public.commerce_create_shop(text, text) to authenticated;

-- Mises à jour en direct entre appareils.
alter publication supabase_realtime add table public.commerce_ops;
