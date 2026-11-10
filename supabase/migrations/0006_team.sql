-- Équipe : inviter des collègues dans une entreprise.
-- L'administrateur enregistre l'adresse e-mail du collègue ; celui-ci crée son compte
-- avec cette adresse (confirmée par e-mail) et accepte l'invitation à sa première connexion.

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null check (email = lower(trim(email)) and email like '%_@_%'),
  role text not null default 'member' check (role in ('admin', 'member')),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, email)
);
create index invitations_email_idx on public.invitations (email);
create index invitations_invited_by_idx on public.invitations (invited_by);

alter table public.invitations enable row level security;
revoke all on public.invitations from anon;

-- Seuls les administrateurs voient et annulent les invitations ; la création passe par invite_member().
create policy invitations_admin_select on public.invitations
  for select to authenticated using (private.is_org_admin(organization_id));
create policy invitations_admin_delete on public.invitations
  for delete to authenticated using (private.is_org_admin(organization_id));

-- Un administrateur peut retirer un collègue, jamais lui-même : il reste toujours un administrateur.
create policy organization_members_admin_delete on public.organization_members
  for delete to authenticated
  using (private.is_org_admin(organization_id) and user_id <> (select auth.uid()));

-- Adresse confirmée de l'utilisateur connecté (null si elle n'est pas confirmée).
create function private.confirmed_email() returns text
language sql stable security definer
set search_path = ''
as $$
  select lower(u.email) from auth.users u
  where u.id = (select auth.uid()) and u.email_confirmed_at is not null;
$$;
revoke all on function private.confirmed_email() from public;

create function public.invite_member(p_email text, p_role text default 'member') returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  org uuid;
  mail text := lower(trim(p_email));
  inv uuid;
begin
  select m.organization_id into org from public.organization_members m
  where m.user_id = uid and m.role = 'admin';
  if org is null then
    raise exception 'Seul un administrateur peut inviter un collègue.' using errcode = '42501';
  end if;
  if p_role not in ('admin', 'member') then
    raise exception 'Rôle inconnu.' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.organization_members m join auth.users u on u.id = m.user_id
    where m.organization_id = org and lower(u.email) = mail
  ) then
    raise exception 'Cette personne fait déjà partie de l’entreprise.' using errcode = '23505';
  end if;

  insert into public.invitations (organization_id, email, role, invited_by)
  values (org, mail, p_role, uid)
  on conflict (organization_id, email) do update set role = excluded.role
  returning id into inv;
  return inv;
end;
$$;

-- Invitations en attente pour l'utilisateur connecté.
create function public.my_invitations()
returns table (id uuid, organization_name text, role text)
language sql stable security definer
set search_path = ''
as $$
  select i.id, o.name, i.role
  from public.invitations i join public.organizations o on o.id = i.organization_id
  where i.email = private.confirmed_email()
  order by i.created_at;
$$;

create function public.accept_invitation(p_id uuid) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  inv public.invitations;
begin
  select * into inv from public.invitations i
  where i.id = p_id and i.email = private.confirmed_email();
  if inv.id is null then
    raise exception 'Invitation introuvable ou annulée.' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.organization_members m where m.user_id = uid) then
    raise exception 'Ce compte est déjà rattaché à une entreprise.' using errcode = '23505';
  end if;

  insert into public.organization_members (organization_id, user_id, role)
  values (inv.organization_id, uid, inv.role);
  delete from public.invitations i where i.id = inv.id;
  return inv.organization_id;
end;
$$;

-- Membres de l'entreprise de l'utilisateur connecté, avec leur adresse.
create function public.list_members()
returns table (user_id uuid, email text, role text, joined_at timestamptz)
language sql stable security definer
set search_path = ''
as $$
  select m.user_id, u.email::text, m.role, m.created_at
  from public.organization_members m join auth.users u on u.id = m.user_id
  where m.organization_id in (
    select mine.organization_id from public.organization_members mine
    where mine.user_id = (select auth.uid())
  )
  order by m.created_at;
$$;

revoke all on function public.invite_member(text, text), public.my_invitations(),
  public.accept_invitation(uuid), public.list_members() from public, anon;
grant execute on function public.invite_member(text, text), public.my_invitations(),
  public.accept_invitation(uuid), public.list_members() to authenticated;
