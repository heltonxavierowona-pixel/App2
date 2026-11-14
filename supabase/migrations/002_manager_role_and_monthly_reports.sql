-- Rôle « gérant de boutique » et envoi automatique des rapports mensuels.

-- 1. Nouveau rôle : manager (gérant). Il gère sa boutique mais ne peut ni en remplacer toutes
--    les données, ni en changer les réglages, ni gérer l'équipe.
alter table public.commerce_members drop constraint commerce_members_role_check;
alter table public.commerce_members add constraint commerce_members_role_check
  check (role in ('owner', 'manager', 'seller'));

drop policy members_invite on public.commerce_members;
create policy members_invite on public.commerce_members for insert to authenticated
  with check (public.commerce_role(shop_id) = 'owner' and role in ('seller', 'manager'));
drop policy members_remove on public.commerce_members;
create policy members_remove on public.commerce_members for delete to authenticated
  using (public.commerce_role(shop_id) = 'owner' and role in ('seller', 'manager'));

drop policy ops_insert on public.commerce_ops;
create policy ops_insert on public.commerce_ops for insert to authenticated
  with check (
    public.commerce_role(shop_id) = 'owner'
    or (public.commerce_role(shop_id) = 'manager' and action not in ('replaceAll', 'updateSettings'))
    or (public.commerce_role(shop_id) = 'seller'
        and action in ('addSale', 'addReturn', 'saveCustomer', 'addPayment', 'addClosing'))
  );

-- 2. Journal des rapports envoyés : un seul rapport par destinataire, par périmètre et par mois.
--    Réservé à la fonction serveur (aucune règle d'accès pour les utilisateurs).
create table public.commerce_report_log (
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  recipient text not null,
  scope text not null,
  sent_at timestamptz not null default now(),
  primary key (month, recipient, scope)
);
alter table public.commerce_report_log enable row level security;
revoke all on public.commerce_report_log from anon, authenticated;

-- 3. Tâche planifiée : les 1er, 2 et 3 du mois à 6 h 15 UTC, appel de la fonction d'envoi.
--    Les jours 2 et 3 servent de rattrapage ; la fonction n'envoie jamais deux fois le même rapport.
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule(
  'commerce-monthly-report',
  '15 6 1-3 * *',
  $job$
  select net.http_post(
    url := 'https://wocypkinmzjkyvxnnwyc.supabase.co/functions/v1/commerce-monthly-report',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $job$
);
