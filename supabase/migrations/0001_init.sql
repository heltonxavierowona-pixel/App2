-- NUMERA Import-Export — schéma initial
-- Toutes les tables métier portent organization_id : l'isolation par entreprise
-- est appliquée par RLS (0002) et par des clés étrangères composites, de sorte
-- qu'une ligne ne peut jamais référencer une ligne d'une autre entreprise.

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 120),
  country text not null default 'Côte d''Ivoire',
  currency text not null default 'XOF' check (currency in ('XOF', 'XAF')),
  created_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index organization_members_user_idx on public.organization_members (user_id);

-- Taux de conversion vers le FCFA (1 unité de devise = rate FCFA).
create table public.exchange_rates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  currency text not null check (currency in ('EUR', 'USD', 'CNY')),
  rate numeric(14, 6) not null check (rate > 0),
  updated_at timestamptz not null default now(),
  unique (organization_id, currency)
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  country text,
  city text,
  contact_name text,
  phone text,
  email text,
  default_currency text not null default 'USD'
    check (default_currency in ('XOF', 'XAF', 'EUR', 'USD', 'CNY')),
  created_at timestamptz not null default now(),
  unique (id, organization_id)
);
create index suppliers_org_idx on public.suppliers (organization_id);

create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  supplier_id uuid not null,
  reference text not null check (length(trim(reference)) > 0),
  order_date date not null default current_date,
  currency text not null check (currency in ('XOF', 'XAF', 'EUR', 'USD', 'CNY')),
  -- Taux figé à la commande : l'historique ne bouge pas quand les taux changent.
  exchange_rate numeric(14, 6) not null default 1 check (exchange_rate > 0),
  incoterm text not null default 'FOB'
    check (incoterm in ('EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP')),
  notes text,
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, reference),
  foreign key (supplier_id, organization_id)
    references public.suppliers (id, organization_id) on delete restrict
);
create index purchase_orders_supplier_idx on public.purchase_orders (supplier_id, organization_id);

create table public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  purchase_order_id uuid not null,
  position int not null default 0,
  product_name text not null check (length(trim(product_name)) > 0),
  quantity numeric(14, 3) not null check (quantity > 0),
  unit text not null default 'unité',
  unit_price numeric(14, 4) not null check (unit_price >= 0), -- devise de la commande
  sale_unit_price_fcfa numeric(14, 2) check (sale_unit_price_fcfa >= 0), -- prix de vente prévu
  unique (id, organization_id),
  foreign key (purchase_order_id, organization_id)
    references public.purchase_orders (id, organization_id) on delete cascade
);
create index purchase_order_items_order_idx
  on public.purchase_order_items (purchase_order_id, organization_id);

-- Une expédition est aussi le « lot » sur lequel le coût de revient est calculé.
create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  purchase_order_id uuid not null,
  reference text not null check (length(trim(reference)) > 0),
  status text not null default 'ordered'
    check (status in ('ordered', 'shipped', 'at_sea', 'at_port', 'cleared', 'delivered')),
  container_number text,
  bl_number text,
  carrier text,
  origin_port text,
  destination_port text,
  planned_departure date,
  actual_departure date,
  planned_arrival date,
  actual_arrival date,
  planned_clearance date,
  actual_clearance date,
  planned_delivery date,
  actual_delivery date,
  notes text,
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, reference),
  foreign key (purchase_order_id, organization_id)
    references public.purchase_orders (id, organization_id) on delete restrict
);
create index shipments_order_idx on public.shipments (purchase_order_id, organization_id);
create index shipments_org_status_idx on public.shipments (organization_id, status);

create table public.shipment_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  shipment_id uuid not null,
  purchase_order_item_id uuid not null,
  quantity numeric(14, 3) not null check (quantity > 0),
  unique (shipment_id, purchase_order_item_id),
  foreign key (shipment_id, organization_id)
    references public.shipments (id, organization_id) on delete cascade,
  foreign key (purchase_order_item_id, organization_id)
    references public.purchase_order_items (id, organization_id) on delete restrict
);
create index shipment_items_item_idx
  on public.shipment_items (purchase_order_item_id, organization_id);
create index shipment_items_shipment_idx on public.shipment_items (shipment_id, organization_id);

create table public.shipment_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  shipment_id uuid not null,
  status text not null
    check (status in ('ordered', 'shipped', 'at_sea', 'at_port', 'cleared', 'delivered')),
  occurred_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  foreign key (shipment_id, organization_id)
    references public.shipments (id, organization_id) on delete cascade
);
create index shipment_events_shipment_idx on public.shipment_events (shipment_id, organization_id);
create index shipment_events_created_by_idx on public.shipment_events (created_by);

-- Une pièce absente de cette table est une pièce manquante.
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  shipment_id uuid not null,
  doc_type text not null
    check (doc_type in ('invoice', 'packing_list', 'bill_of_lading',
                        'certificate_of_origin', 'customs_declaration')),
  status text not null default 'uploaded' check (status in ('uploaded', 'validated')),
  file_path text, -- chemin dans le bucket « documents » ; null pour les pièces de démonstration
  file_name text,
  file_size int,
  uploaded_by uuid references auth.users (id) on delete set null,
  uploaded_at timestamptz not null default now(),
  unique (shipment_id, doc_type),
  foreign key (shipment_id, organization_id)
    references public.shipments (id, organization_id) on delete cascade
);
create index documents_shipment_idx on public.documents (shipment_id, organization_id);
create index documents_uploaded_by_idx on public.documents (uploaded_by);

-- Frais d'approche : un montant par poste et par lot.
create table public.shipment_costs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  shipment_id uuid not null,
  category text not null
    check (category in ('freight', 'insurance', 'customs', 'transit', 'local_transport')),
  amount numeric(16, 2) not null check (amount >= 0),
  currency text not null check (currency in ('XOF', 'XAF', 'EUR', 'USD', 'CNY')),
  exchange_rate numeric(14, 6) not null default 1 check (exchange_rate > 0),
  amount_fcfa numeric(16, 0) generated always as (round(amount * exchange_rate)) stored,
  unique (shipment_id, category),
  foreign key (shipment_id, organization_id)
    references public.shipments (id, organization_id) on delete cascade
);
create index shipment_costs_shipment_idx on public.shipment_costs (shipment_id, organization_id);

-- Historique des statuts, tenu automatiquement.
create function public.log_shipment_status() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.shipment_events (organization_id, shipment_id, status, created_by)
    values (new.organization_id, new.id, new.status, auth.uid());
  end if;
  return new;
end;
$$;

create trigger shipments_log_status
  after insert or update of status on public.shipments
  for each row execute function public.log_shipment_status();
