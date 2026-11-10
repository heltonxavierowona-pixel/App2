-- Offres, limites et paiement par lien (même principe que numera-agentic) :
--   1. le propriétaire de la plateforme enregistre un lien de paiement par offre et par période ;
--   2. le client choisit une offre : une demande est créée et reçoit ce lien ;
--   3. le client paie, puis saisit la référence de sa transaction ;
--   4. le propriétaire valide : l'abonnement devient actif pour un mois ou un an.
-- Une entreprise sans essai ni abonnement en cours retombe sur l'offre gratuite « Découverte ».

create table public.plans (
  id text primary key,
  name text not null,
  description text not null default '',
  prices jsonb not null default '{}'::jsonb,  -- {"month": 15000, "year": 150000} en FCFA ; vide = gratuit
  limits jsonb not null default '{}'::jsonb,  -- {"members": 3, "active_shipments": 2} ; clé absente = illimité
  features text[] not null default '{}',
  sort int not null default 0,
  active boolean not null default true
);

insert into public.plans (id, name, description, prices, limits, features, sort) values
  ('decouverte', 'Découverte', 'Pour essayer avec vos premières expéditions.',
   '{}', '{"members": 1, "active_shipments": 2}',
   array['2 expéditions en cours', '1 utilisateur', 'Documents et coût de revient'], 1),
  ('pme', 'PME', 'Pour un importateur ou un exportateur.',
   '{"month": 15000, "year": 150000}', '{"members": 3}',
   array['Expéditions illimitées', '3 utilisateurs', 'Documents et coût de revient'], 2),
  ('transitaire', 'Transitaire', 'Pour gérer beaucoup de dossiers à plusieurs.',
   '{"month": 35000, "year": 350000}', '{}',
   array['Expéditions illimitées', 'Utilisateurs illimités', 'Support prioritaire'], 3);

create table public.platform_settings (
  key text primary key,
  value jsonb not null
);
insert into public.platform_settings (key, value) values
  ('trial_days', '14'),
  ('trial_plan', '"pme"'),
  ('plan_link_validity_days', '30'),
  ('support_whatsapp', '""');

-- Propriétaires de la plateforme : eux seuls enregistrent les liens et valident les paiements.
create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.subscriptions (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  plan_id text not null references public.plans (id),
  status text not null default 'trialing' check (status in ('trialing', 'active')),
  billing_interval text check (billing_interval in ('month', 'year')),
  amount numeric(12, 0),
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscriptions_plan_idx on public.subscriptions (plan_id);

create table public.plan_links (
  plan_id text not null references public.plans (id),
  billing_interval text not null check (billing_interval in ('month', 'year')),
  url text not null check (url ~ '^https://\S+$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  updated_by uuid references auth.users (id) on delete set null,
  primary key (plan_id, billing_interval)
);
create index plan_links_updated_by_idx on public.plan_links (updated_by);

create table public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  plan_id text not null references public.plans (id),
  billing_interval text not null check (billing_interval in ('month', 'year')),
  amount numeric(12, 0) not null check (amount > 0),
  kind text not null check (kind in ('new', 'renewal')),
  status text not null default 'awaiting_link'
    check (status in ('awaiting_link', 'link_sent', 'reference_submitted', 'validated', 'canceled')),
  contact_name text,
  contact_phone text,
  payment_link text,
  link_sent_at timestamptz,
  transaction_ref text,
  ref_submitted_at timestamptz,
  rejection_reason text,
  validated_at timestamptz,
  validated_by uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index payment_requests_org_idx on public.payment_requests (organization_id, status);
create index payment_requests_plan_idx on public.payment_requests (plan_id);
create index payment_requests_validated_by_idx on public.payment_requests (validated_by);
create index payment_requests_created_by_idx on public.payment_requests (created_by);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  plan_id text references public.plans (id),
  amount numeric(12, 0) not null,
  reference text not null unique,
  paid_at timestamptz not null default now()
);
create index payments_org_idx on public.payments (organization_id);
create index payments_plan_idx on public.payments (plan_id);

alter table public.plans enable row level security;
alter table public.platform_settings enable row level security;
alter table public.platform_admins enable row level security;
alter table public.subscriptions enable row level security;
alter table public.plan_links enable row level security;
alter table public.payment_requests enable row level security;
alter table public.payments enable row level security;
revoke all on public.plans, public.platform_settings, public.platform_admins, public.subscriptions,
  public.plan_links, public.payment_requests, public.payments from anon;

-- Lecture seule pour les entreprises ; toute écriture passe par les fonctions ci-dessous.
-- platform_settings, platform_admins et plan_links n'ont aucune politique : accès par fonctions uniquement.
create policy plans_read on public.plans for select to authenticated using (true);
create policy subscriptions_members on public.subscriptions
  for select to authenticated using (private.is_org_member(organization_id));
create policy payment_requests_members on public.payment_requests
  for select to authenticated using (private.is_org_member(organization_id));
create policy payments_members on public.payments
  for select to authenticated using (private.is_org_member(organization_id));

------------------------------------------------------------------ Offre en vigueur et limites

create function private.setting(k text) returns text
language sql stable security definer set search_path = ''
as $$ select s.value #>> '{}' from public.platform_settings s where s.key = k; $$;

create function private.is_platform_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid())); $$;

-- Essai en cours ou abonnement payé (avec 3 jours de délai) : l'offre souscrite. Sinon « Découverte ».
create function private.effective_plan(org uuid) returns text
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select s.plan_id from public.subscriptions s
    where s.organization_id = org
      and ((s.status = 'trialing' and s.trial_ends_at > now())
        or (s.status = 'active' and s.current_period_end + interval '3 days' > now()))
  ), 'decouverte');
$$;

-- Limite de l'offre en vigueur ; null = illimité.
create function private.plan_limit(org uuid, k text) returns int
language sql stable security definer set search_path = ''
as $$
  select (p.limits ->> k)::int from public.plans p where p.id = private.effective_plan(org);
$$;

revoke all on function private.setting(text), private.is_platform_admin(),
  private.effective_plan(uuid), private.plan_limit(uuid, text) from public;

-- Toute nouvelle entreprise démarre par un essai de l'offre payante.
create function public.start_trial() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.subscriptions (organization_id, plan_id, status, trial_ends_at)
  values (new.id, coalesce(private.setting('trial_plan'), 'pme'), 'trialing',
          now() + make_interval(days => coalesce(private.setting('trial_days')::int, 14)))
  on conflict (organization_id) do nothing;
  return new;
end;
$$;
create trigger organizations_start_trial
  after insert on public.organizations
  for each row execute function public.start_trial();

-- Les entreprises déjà inscrites reçoivent le même essai, à compter d'aujourd'hui.
insert into public.subscriptions (organization_id, plan_id, status, trial_ends_at)
select o.id, 'pme', 'trialing', now() + interval '14 days' from public.organizations o
on conflict (organization_id) do nothing;

create function public.enforce_shipment_limit() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  lim int;
begin
  if new.status <> 'delivered' and (tg_op = 'INSERT' or old.status = 'delivered') then
    lim := private.plan_limit(new.organization_id, 'active_shipments');
    if lim is not null and (
      select count(*) from public.shipments s
      where s.organization_id = new.organization_id and s.status <> 'delivered' and s.id <> new.id
    ) >= lim then
      raise exception 'Votre offre est limitée à % expéditions en cours. Changez d’offre dans Équipe > Abonnement.', lim
        using errcode = 'NUM01';
    end if;
  end if;
  return new;
end;
$$;
create trigger shipments_plan_limit
  before insert or update of status on public.shipments
  for each row execute function public.enforce_shipment_limit();

create function public.enforce_member_limit() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  lim int := private.plan_limit(new.organization_id, 'members');
begin
  if lim is not null and (
    select count(*) from public.organization_members m where m.organization_id = new.organization_id
  ) >= lim then
    raise exception 'Votre offre est limitée à % utilisateur(s). Changez d’offre dans Équipe > Abonnement.', lim
      using errcode = 'NUM01';
  end if;
  return new;
end;
$$;
create trigger organization_members_plan_limit
  before insert on public.organization_members
  for each row execute function public.enforce_member_limit();

revoke execute on function public.start_trial(), public.enforce_shipment_limit(),
  public.enforce_member_limit() from public, anon, authenticated;

------------------------------------------------------------------ Côté entreprise

-- Tout ce dont l'écran Abonnement a besoin, en un appel.
create function public.billing_overview() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  org uuid;
  sub public.subscriptions;
  plan text;
begin
  select m.organization_id into org from public.organization_members m where m.user_id = auth.uid() limit 1;
  if org is null then
    raise exception 'Entreprise introuvable.' using errcode = 'P0002';
  end if;
  select * into sub from public.subscriptions s where s.organization_id = org;
  plan := private.effective_plan(org);
  return jsonb_build_object(
    'plans', (select jsonb_agg(to_jsonb(p) order by p.sort) from public.plans p where p.active),
    'plan_id', plan,
    'state', case
      when plan = 'decouverte' then 'free'
      when sub.status = 'trialing' then 'trial'
      else 'active' end,
    'trial_ends_at', sub.trial_ends_at,
    'current_period_end', sub.current_period_end,
    'had_paid_plan', sub.status = 'active',
    'usage', jsonb_build_object(
      'members', (select count(*) from public.organization_members m where m.organization_id = org),
      'active_shipments', (select count(*) from public.shipments s
                           where s.organization_id = org and s.status <> 'delivered')),
    'request', (select to_jsonb(r) from public.payment_requests r
                where r.organization_id = org
                  and r.status in ('awaiting_link', 'link_sent', 'reference_submitted')
                order by r.created_at desc limit 1),
    'support_whatsapp', coalesce(private.setting('support_whatsapp'), ''),
    'is_platform_admin', private.is_platform_admin()
  );
end;
$$;

-- Une demande qui arrive reçoit tout de suite le lien de son offre, s'il est enregistré et valide.
create function public.payment_request_attach_link() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  link text;
begin
  if new.status = 'awaiting_link' and new.payment_link is null then
    select l.url into link from public.plan_links l
    where l.plan_id = new.plan_id and l.billing_interval = new.billing_interval and l.expires_at > now();
    if link is not null then
      new.payment_link := link;
      new.status := 'link_sent';
      new.link_sent_at := now();
    end if;
  end if;
  return new;
end;
$$;
create trigger payment_requests_attach_link
  before insert on public.payment_requests
  for each row execute function public.payment_request_attach_link();
revoke execute on function public.payment_request_attach_link() from public, anon, authenticated;

create function public.request_subscription(p_plan text, p_interval text, p_name text, p_phone text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  org uuid;
  price numeric;
  phone text;
  req uuid;
begin
  select m.organization_id into org from public.organization_members m
  where m.user_id = auth.uid() and m.role = 'admin';
  if org is null then
    raise exception 'Seul un administrateur peut changer d’offre.' using errcode = '42501';
  end if;
  if p_interval not in ('month', 'year') then
    raise exception 'Période inconnue.' using errcode = '22023';
  end if;
  select (p.prices ->> p_interval)::numeric into price from public.plans p where p.id = p_plan and p.active;
  if price is null or price <= 0 then
    raise exception 'Offre indisponible.' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_name, ''))) < 2 then
    raise exception 'Indiquez votre nom.' using errcode = '22023';
  end if;
  phone := nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g'), '');
  if phone is null or length(regexp_replace(phone, '\D', '', 'g')) < 8 then
    raise exception 'Indiquez votre numéro de téléphone (WhatsApp).' using errcode = '22023';
  end if;

  -- Une seule demande ouverte par entreprise : la nouvelle remplace l'ancienne.
  update public.payment_requests r set status = 'canceled'
  where r.organization_id = org and r.status in ('awaiting_link', 'link_sent', 'reference_submitted');

  insert into public.payment_requests (organization_id, plan_id, billing_interval, amount, kind,
                                       contact_name, contact_phone, created_by)
  values (org, p_plan, p_interval, price,
          case when exists (select 1 from public.subscriptions s
                            where s.organization_id = org and s.status = 'active')
               then 'renewal' else 'new' end,
          left(trim(p_name), 120), phone, auth.uid())
  returning id into req;
  return req;
end;
$$;

create function public.submit_payment_reference(p_request uuid, p_ref text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  r public.payment_requests;
  ref text := left(trim(coalesce(p_ref, '')), 80);
begin
  select * into r from public.payment_requests q where q.id = p_request for update;
  if r.id is null or not private.is_org_member(r.organization_id) then
    raise exception 'Demande introuvable.' using errcode = 'P0002';
  end if;
  if r.status not in ('link_sent', 'reference_submitted') then
    raise exception 'Le lien de paiement n’a pas encore été envoyé.' using errcode = '22023';
  end if;
  if length(ref) < 4 then
    raise exception 'Référence de transaction invalide.' using errcode = '22023';
  end if;
  if exists (select 1 from public.payments p where p.reference = ref) then
    raise exception 'Cette référence a déjà été utilisée.' using errcode = '22023';
  end if;
  update public.payment_requests q
  set transaction_ref = ref, status = 'reference_submitted', ref_submitted_at = now(), rejection_reason = null
  where q.id = p_request;
end;
$$;

create function public.cancel_payment_request(p_request uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.payment_requests q set status = 'canceled'
  where q.id = p_request and q.status in ('awaiting_link', 'link_sent')
    and private.is_org_admin(q.organization_id);
  if not found then
    raise exception 'Cette demande ne peut plus être annulée.' using errcode = '22023';
  end if;
end;
$$;

------------------------------------------------------------------ Côté plateforme

create function private.require_platform_admin() returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Accès réservé au propriétaire de la plateforme.' using errcode = '42501';
  end if;
end;
$$;
revoke all on function private.require_platform_admin() from public;

create function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.require_platform_admin();
  return jsonb_build_object(
    'requests', coalesce((
      select jsonb_agg(to_jsonb(r) || jsonb_build_object('organization_name', o.name) order by r.created_at)
      from public.payment_requests r join public.organizations o on o.id = r.organization_id
      where r.status in ('awaiting_link', 'link_sent', 'reference_submitted')), '[]'::jsonb),
    'links', coalesce((select jsonb_agg(to_jsonb(l)) from public.plan_links l), '[]'::jsonb),
    'plans', (select jsonb_agg(to_jsonb(p) order by p.sort) from public.plans p where p.active),
    'organizations', (select count(*) from public.organizations),
    'active_subscriptions', (select count(*) from public.subscriptions s
                             where s.status = 'active' and s.current_period_end > now()),
    'support_whatsapp', coalesce(private.setting('support_whatsapp'), ''),
    'link_validity_days', coalesce(private.setting('plan_link_validity_days')::int, 30)
  );
end;
$$;

-- Enregistre le lien d'une offre et l'envoie aux demandes qui l'attendaient. Renvoie leur nombre.
create function public.admin_set_plan_link(p_plan text, p_interval text, p_url text) returns int
language plpgsql security definer set search_path = ''
as $$
declare
  url text := trim(coalesce(p_url, ''));
  days int := coalesce(private.setting('plan_link_validity_days')::int, 30);
  n int;
begin
  perform private.require_platform_admin();
  if url !~ '^https://\S+$' then
    raise exception 'Le lien doit commencer par https://' using errcode = '22023';
  end if;
  insert into public.plan_links (plan_id, billing_interval, url, created_at, expires_at, updated_by)
  values (p_plan, p_interval, url, now(), now() + make_interval(days => days), auth.uid())
  on conflict (plan_id, billing_interval) do update
    set url = excluded.url, created_at = excluded.created_at,
        expires_at = excluded.expires_at, updated_by = excluded.updated_by;

  with sent as (
    update public.payment_requests r
    set payment_link = url, status = 'link_sent', link_sent_at = now()
    where r.status = 'awaiting_link' and r.plan_id = p_plan and r.billing_interval = p_interval
    returning 1
  ) select count(*) into n from sent;
  return n;
end;
$$;

create function public.admin_validate_payment(p_request uuid) returns timestamptz
language plpgsql security definer set search_path = ''
as $$
declare
  r public.payment_requests;
  step interval;
  period_end timestamptz;
begin
  perform private.require_platform_admin();
  select * into r from public.payment_requests q where q.id = p_request for update;
  if r.id is null or r.status not in ('link_sent', 'reference_submitted') then
    raise exception 'Demande introuvable ou déjà traitée.' using errcode = 'P0002';
  end if;
  step := case r.billing_interval when 'year' then interval '1 year' else interval '1 month' end;

  insert into public.subscriptions as s (organization_id, plan_id, status, billing_interval, amount,
                                         current_period_end)
  values (r.organization_id, r.plan_id, 'active', r.billing_interval, r.amount, now() + step)
  on conflict (organization_id) do update
    set plan_id = excluded.plan_id, status = 'active', billing_interval = excluded.billing_interval,
        amount = excluded.amount, trial_ends_at = null, updated_at = now(),
        -- Un renouvellement anticipé prolonge la période en cours au lieu de la raccourcir.
        current_period_end = greatest(coalesce(s.current_period_end, now()), now()) + step
  returning s.current_period_end into period_end;

  insert into public.payments (organization_id, plan_id, amount, reference)
  values (r.organization_id, r.plan_id, r.amount, coalesce(nullif(r.transaction_ref, ''), 'req_' || r.id))
  on conflict (reference) do nothing;

  update public.payment_requests q
  set status = 'validated', validated_at = now(), validated_by = auth.uid()
  where q.id = p_request;
  return period_end;
end;
$$;

-- Paiement introuvable : la demande revient à l'étape « lien envoyé », avec le motif.
create function public.admin_reject_payment(p_request uuid, p_reason text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_platform_admin();
  update public.payment_requests q
  set status = 'link_sent', transaction_ref = null, ref_submitted_at = null,
      rejection_reason = coalesce(nullif(trim(p_reason), ''), 'Nous ne retrouvons pas ce paiement.')
        || ' (réf. ' || coalesce(q.transaction_ref, '—') || ')'
  where q.id = p_request and q.status = 'reference_submitted';
  if not found then
    raise exception 'Aucune référence à refuser.' using errcode = 'P0002';
  end if;
end;
$$;

create function public.admin_set_support_whatsapp(p_phone text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_platform_admin();
  update public.platform_settings s
  set value = to_jsonb(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'))
  where s.key = 'support_whatsapp';
end;
$$;

revoke all on function public.billing_overview(), public.request_subscription(text, text, text, text),
  public.submit_payment_reference(uuid, text), public.cancel_payment_request(uuid),
  public.admin_overview(), public.admin_set_plan_link(text, text, text),
  public.admin_validate_payment(uuid), public.admin_reject_payment(uuid, text),
  public.admin_set_support_whatsapp(text) from public, anon;
grant execute on function public.billing_overview(), public.request_subscription(text, text, text, text),
  public.submit_payment_reference(uuid, text), public.cancel_payment_request(uuid),
  public.admin_overview(), public.admin_set_plan_link(text, text, text),
  public.admin_validate_payment(uuid), public.admin_reject_payment(uuid, text),
  public.admin_set_support_whatsapp(text) to authenticated;

-- L'invitation tient compte de la limite d'utilisateurs : membres + invitations en attente.
create or replace function public.invite_member(p_email text, p_role text default 'member') returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  org uuid;
  mail text := lower(trim(p_email));
  inv uuid;
  lim int;
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
  lim := private.plan_limit(org, 'members');
  if lim is not null and (
    (select count(*) from public.organization_members m where m.organization_id = org)
    + (select count(*) from public.invitations i where i.organization_id = org and i.email <> mail)
  ) >= lim then
    raise exception 'Votre offre est limitée à % utilisateur(s). Changez d’offre dans Équipe > Abonnement.', lim
      using errcode = 'NUM01';
  end if;

  insert into public.invitations (organization_id, email, role, invited_by)
  values (org, mail, p_role, uid)
  on conflict (organization_id, email) do update set role = excluded.role
  returning id into inv;
  return inv;
end;
$$;
