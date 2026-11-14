-- Création d'entreprise à l'inscription et jeu de données de démonstration.

-- Les dates sont relatives au jour du chargement : la démo reste crédible
-- (retards, arrivées récentes, marge du mois) quelle que soit la date.
create function private.seed_demo(org uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  d date := current_date;
  m0 date := date_trunc('month', current_date)::date;
  yr text := to_char(current_date, 'YYYY');
  cur text;
  land text;
  port text;
  usd numeric := 598.5;
  cny numeric := 83.2;
  eur numeric := 655.957;
  s_foshan uuid; s_gz uuid; s_durand uuid; s_siam uuid; s_coop uuid;
  po uuid; sh uuid; sh2 uuid;
  i1 uuid; i2 uuid; i3 uuid;
begin
  select o.currency, o.country into cur, land from public.organizations o where o.id = org;
  port := case when cur = 'XAF' then 'Douala' else 'Abidjan' end;

  insert into public.suppliers (organization_id, name, country, city, contact_name, phone, email, default_currency)
  values (org, 'Foshan Lianxin Ceramics Co.', 'Chine', 'Foshan', 'Mme Chen Yulan', '+86 757 8266 4410', 'export@lianxin-ceramics.example', 'CNY')
  returning id into s_foshan;
  insert into public.suppliers (organization_id, name, country, city, contact_name, phone, email, default_currency)
  values (org, 'Guangzhou Huamei Trading Co.', 'Chine', 'Guangzhou', 'M. Liu Wei', '+86 20 8734 1905', 'liu.wei@huamei-trading.example', 'CNY')
  returning id into s_gz;
  insert into public.suppliers (organization_id, name, country, city, contact_name, phone, email, default_currency)
  values (org, 'Établissements Durand & Fils', 'France', 'Marseille', 'Hélène Durand', '+33 4 91 55 01 27', 'commandes@durand-fils.example', 'EUR')
  returning id into s_durand;
  insert into public.suppliers (organization_id, name, country, city, contact_name, phone, email, default_currency)
  values (org, 'Siam Grains Export Co.', 'Thaïlande', 'Bangkok', 'M. Somchai Prasert', '+66 2 555 0142', 'sales@siamgrains.example', 'USD')
  returning id into s_siam;
  insert into public.suppliers (organization_id, name, country, city, contact_name, phone, email, default_currency)
  values (org, 'Coopérative Agricole Espoir', land, null, 'M. Kouassi Yao', null, null, cur)
  returning id into s_coop;

  ---------------------------------------------------------------- 1. Carreaux — livré ce mois
  insert into public.purchase_orders (organization_id, supplier_id, reference, order_date, currency, exchange_rate, incoterm)
  values (org, s_foshan, 'CMD-' || yr || '-014', d - 75, 'CNY', cny, 'FOB') returning id into po;
  insert into public.purchase_order_items (organization_id, purchase_order_id, position, product_name, quantity, unit, unit_price, sale_unit_price_fcfa)
  values (org, po, 0, 'Carreaux grès cérame 60×60 beige', 1300, 'm²', 28, 7500) returning id into i1;
  insert into public.shipments (organization_id, purchase_order_id, reference, status, container_number, bl_number, carrier,
    origin_port, destination_port, planned_departure, actual_departure, planned_arrival, actual_arrival,
    planned_clearance, actual_clearance, planned_delivery, actual_delivery)
  values (org, po, 'EXP-' || yr || '-021', 'delivered', 'MSKU 718204 3', 'MAEU 240916377', 'Maersk',
    'Foshan (Nansha)', port, d - 62, d - 61, d - 20, d - 18, d - 14, d - 12, d - 9, greatest(m0, d - 8))
  returning id into sh;
  insert into public.shipment_items (organization_id, shipment_id, purchase_order_item_id, quantity) values (org, sh, i1, 1300);
  insert into public.shipment_costs (organization_id, shipment_id, category, amount, currency, exchange_rate) values
    (org, sh, 'freight', 4200, 'USD', usd), (org, sh, 'insurance', 22000, cur, 1), (org, sh, 'customs', 1720000, cur, 1),
    (org, sh, 'transit', 450000, cur, 1), (org, sh, 'local_transport', 300000, cur, 1);
  insert into public.documents (organization_id, shipment_id, doc_type, status, file_name)
  select org, sh, t, 'validated', t || '-demo.pdf'
  from unnest(array['invoice', 'packing_list', 'bill_of_lading', 'certificate_of_origin', 'customs_declaration']) t;

  ---------------------------------------------------------------- 2. Lubrifiants — livré ce mois
  insert into public.purchase_orders (organization_id, supplier_id, reference, order_date, currency, exchange_rate, incoterm)
  values (org, s_durand, 'CMD-' || yr || '-017', d - 58, 'EUR', eur, 'CIF') returning id into po;
  insert into public.purchase_order_items (organization_id, purchase_order_id, position, product_name, quantity, unit, unit_price, sale_unit_price_fcfa)
  values (org, po, 0, 'Huile moteur 20W50 — bidon 5 L', 2400, 'bidon', 11.8, 12500) returning id into i1;
  insert into public.purchase_order_items (organization_id, purchase_order_id, position, product_name, quantity, unit, unit_price, sale_unit_price_fcfa)
  values (org, po, 1, 'Huile moteur 15W40 — fût 200 L', 40, 'fût', 410, 395000) returning id into i2;
  insert into public.shipments (organization_id, purchase_order_id, reference, status, container_number, bl_number, carrier,
    origin_port, destination_port, planned_departure, actual_departure, planned_arrival, actual_arrival,
    planned_clearance, actual_clearance, planned_delivery, actual_delivery)
  values (org, po, 'EXP-' || yr || '-024', 'delivered', 'CMAU 430587 1', 'CMDU MRS0418822', 'CMA CGM',
    'Marseille-Fos', port, d - 40, d - 40, d - 16, d - 15, d - 10, d - 9, d - 5, greatest(m0, d - 3))
  returning id into sh;
  insert into public.shipment_items (organization_id, shipment_id, purchase_order_item_id, quantity) values
    (org, sh, i1, 2400), (org, sh, i2, 40);
  insert into public.shipment_costs (organization_id, shipment_id, category, amount, currency, exchange_rate) values
    (org, sh, 'customs', 6300000, cur, 1), (org, sh, 'transit', 520000, cur, 1), (org, sh, 'local_transport', 240000, cur, 1);
  insert into public.documents (organization_id, shipment_id, doc_type, status, file_name)
  select org, sh, t, 'validated', t || '-demo.pdf'
  from unnest(array['invoice', 'packing_list', 'bill_of_lading', 'certificate_of_origin', 'customs_declaration']) t;

  ---------------------------------------------------------------- 3. Pièces moto — deux expéditions partielles
  insert into public.purchase_orders (organization_id, supplier_id, reference, order_date, currency, exchange_rate, incoterm,
    notes)
  values (org, s_gz, 'CMD-' || yr || '-019', d - 52, 'CNY', cny, 'FOB', 'Livraison en deux lots convenue avec M. Liu.')
  returning id into po;
  insert into public.purchase_order_items (organization_id, purchase_order_id, position, product_name, quantity, unit, unit_price, sale_unit_price_fcfa)
  values (org, po, 0, 'Pneus moto 2.75-18', 2000, 'pièce', 62, 9500) returning id into i1;
  insert into public.purchase_order_items (organization_id, purchase_order_id, position, product_name, quantity, unit, unit_price, sale_unit_price_fcfa)
  values (org, po, 1, 'Chaînes de transmission 428H', 3000, 'pièce', 21, 3500) returning id into i2;
  insert into public.purchase_order_items (organization_id, purchase_order_id, position, product_name, quantity, unit, unit_price, sale_unit_price_fcfa)
  values (org, po, 2, 'Batteries 12 V 7 Ah', 1500, 'pièce', 55, 8500) returning id into i3;

  -- Lot A : dédouané, livraison en retard
  insert into public.shipments (organization_id, purchase_order_id, reference, status, container_number, bl_number, carrier,
    origin_port, destination_port, planned_departure, actual_departure, planned_arrival, actual_arrival,
    planned_clearance, actual_clearance, planned_delivery, notes)
  values (org, po, 'EXP-' || yr || '-026', 'cleared', 'TGHU 652913 0', 'COSU 6318804520', 'COSCO',
    'Guangzhou (Nansha)', port, d - 47, d - 46, d - 9, d - 8, d - 4, d - 3, d - 2,
    'Camion réservé, en attente du bon de sortie.')
  returning id into sh;
  insert into public.shipment_items (organization_id, shipment_id, purchase_order_item_id, quantity) values
    (org, sh, i1, 1200), (org, sh, i2, 1800), (org, sh, i3, 900);
  insert into public.shipment_costs (organization_id, shipment_id, category, amount, currency, exchange_rate) values
    (org, sh, 'freight', 2900, 'USD', usd), (org, sh, 'insurance', 45000, cur, 1), (org, sh, 'customs', 3900000, cur, 1),
    (org, sh, 'transit', 380000, cur, 1), (org, sh, 'local_transport', 210000, cur, 1);
  insert into public.documents (organization_id, shipment_id, doc_type, status, file_name)
  select org, sh, t, case when t = 'customs_declaration' then 'uploaded' else 'validated' end, t || '-demo.pdf'
  from unnest(array['invoice', 'packing_list', 'bill_of_lading', 'certificate_of_origin', 'customs_declaration']) t;

  -- Lot B : embarqué
  insert into public.shipments (organization_id, purchase_order_id, reference, status, container_number, carrier,
    origin_port, destination_port, planned_departure, actual_departure, planned_arrival, planned_clearance, planned_delivery)
  values (org, po, 'EXP-' || yr || '-029', 'shipped', 'CSNU 771045 6', 'COSCO',
    'Guangzhou (Nansha)', port, d - 4, d - 3, d + 35, d + 40, d + 43)
  returning id into sh2;
  insert into public.shipment_items (organization_id, shipment_id, purchase_order_item_id, quantity) values
    (org, sh2, i1, 800), (org, sh2, i2, 1200), (org, sh2, i3, 600);
  insert into public.shipment_costs (organization_id, shipment_id, category, amount, currency, exchange_rate) values
    (org, sh2, 'freight', 2100, 'USD', usd);
  insert into public.documents (organization_id, shipment_id, doc_type, status, file_name)
  select org, sh2, t, 'validated', t || '-demo.pdf' from unnest(array['invoice', 'packing_list']) t;

  ---------------------------------------------------------------- 4. Riz — en mer, arrivée en retard
  insert into public.purchase_orders (organization_id, supplier_id, reference, order_date, currency, exchange_rate, incoterm)
  values (org, s_siam, 'CMD-' || yr || '-020', d - 49, 'USD', usd, 'CFR') returning id into po;
  insert into public.purchase_order_items (organization_id, purchase_order_id, position, product_name, quantity, unit, unit_price, sale_unit_price_fcfa)
  values (org, po, 0, 'Riz parfumé 5 % brisures — sac 25 kg', 1000, 'sac', 14.5, 13500) returning id into i1;
  insert into public.shipments (organization_id, purchase_order_id, reference, status, container_number, bl_number, carrier,
    origin_port, destination_port, planned_departure, actual_departure, planned_arrival, planned_clearance, planned_delivery, notes)
  values (org, po, 'EXP-' || yr || '-027', 'at_sea', 'MSCU 904417 2', 'MEDU BK7741209', 'MSC',
    'Bangkok (Laem Chabang)', port, d - 41, d - 39, d - 4, d + 1, d + 4,
    'Transbordement retardé à Singapour, nouvelle ETA attendue de l''armateur.')
  returning id into sh;
  insert into public.shipment_items (organization_id, shipment_id, purchase_order_item_id, quantity) values (org, sh, i1, 1000);
  insert into public.shipment_costs (organization_id, shipment_id, category, amount, currency, exchange_rate) values
    (org, sh, 'insurance', 95000, cur, 1);
  insert into public.documents (organization_id, shipment_id, doc_type, status, file_name)
  select org, sh, t, 'validated', t || '-demo.pdf' from unnest(array['invoice', 'packing_list', 'bill_of_lading']) t;

  ---------------------------------------------------------------- 5. Pièces auto — au port
  insert into public.purchase_orders (organization_id, supplier_id, reference, order_date, currency, exchange_rate, incoterm)
  values (org, s_durand, 'CMD-' || yr || '-022', d - 36, 'EUR', eur, 'CIF') returning id into po;
  insert into public.purchase_order_items (organization_id, purchase_order_id, position, product_name, quantity, unit, unit_price, sale_unit_price_fcfa)
  values (org, po, 0, 'Filtres à huile', 3000, 'pièce', 2.1, 2400) returning id into i1;
  insert into public.purchase_order_items (organization_id, purchase_order_id, position, product_name, quantity, unit, unit_price, sale_unit_price_fcfa)
  values (org, po, 1, 'Plaquettes de frein (jeu)', 1800, 'jeu', 6.4, 6900) returning id into i2;
  insert into public.purchase_order_items (organization_id, purchase_order_id, position, product_name, quantity, unit, unit_price, sale_unit_price_fcfa)
  values (org, po, 2, 'Amortisseurs avant', 600, 'pièce', 19.5, 21000) returning id into i3;
  insert into public.shipments (organization_id, purchase_order_id, reference, status, container_number, bl_number, carrier,
    origin_port, destination_port, planned_departure, actual_departure, planned_arrival, actual_arrival,
    planned_clearance, planned_delivery)
  values (org, po, 'EXP-' || yr || '-028', 'at_port', 'HLXU 315682 4', 'HLCU MRS2610447', 'Hapag-Lloyd',
    'Marseille-Fos', port, d - 26, d - 26, d - 3, d - 2, d + 3, d + 6)
  returning id into sh;
  insert into public.shipment_items (organization_id, shipment_id, purchase_order_item_id, quantity) values
    (org, sh, i1, 3000), (org, sh, i2, 1800), (org, sh, i3, 600);
  insert into public.documents (organization_id, shipment_id, doc_type, status, file_name)
  select org, sh, t, case when t = 'certificate_of_origin' then 'uploaded' else 'validated' end, t || '-demo.pdf'
  from unnest(array['invoice', 'packing_list', 'bill_of_lading', 'certificate_of_origin']) t;

  ---------------------------------------------------------------- 6. Carreaux — commandé
  insert into public.purchase_orders (organization_id, supplier_id, reference, order_date, currency, exchange_rate, incoterm)
  values (org, s_foshan, 'CMD-' || yr || '-025', d - 6, 'CNY', cny, 'FOB') returning id into po;
  insert into public.purchase_order_items (organization_id, purchase_order_id, position, product_name, quantity, unit, unit_price, sale_unit_price_fcfa)
  values (org, po, 0, 'Carreaux grès cérame 60×60 gris', 900, 'm²', 28.5, 7500) returning id into i1;
  insert into public.purchase_order_items (organization_id, purchase_order_id, position, product_name, quantity, unit, unit_price, sale_unit_price_fcfa)
  values (org, po, 1, 'Faïence murale 30×60 blanche', 500, 'm²', 22, 6200) returning id into i2;
  insert into public.shipments (organization_id, purchase_order_id, reference, status,
    origin_port, destination_port, planned_departure, planned_arrival, planned_clearance, planned_delivery)
  values (org, po, 'EXP-' || yr || '-030', 'ordered', 'Foshan (Nansha)', port, d + 9, d + 50, d + 55, d + 58)
  returning id into sh;
  insert into public.shipment_items (organization_id, shipment_id, purchase_order_item_id, quantity) values
    (org, sh, i1, 900), (org, sh, i2, 500);
  insert into public.documents (organization_id, shipment_id, doc_type, status, file_name)
  values (org, sh, 'invoice', 'uploaded', 'invoice-demo.pdf');

  ---------------------------------------------------------------- 7. Cacao (export) — livré le mois dernier
  insert into public.purchase_orders (organization_id, supplier_id, reference, order_date, currency, exchange_rate, incoterm,
    notes)
  values (org, s_coop, 'CMD-' || yr || '-011', d - 80, cur, 1, 'FOB', 'Export vers Anvers, vente FOB.')
  returning id into po;
  insert into public.purchase_order_items (organization_id, purchase_order_id, position, product_name, quantity, unit, unit_price, sale_unit_price_fcfa)
  values (org, po, 0, 'Fèves de cacao grade I', 25000, 'kg', 2900, 3250) returning id into i1;
  insert into public.shipments (organization_id, purchase_order_id, reference, status, container_number, bl_number, carrier,
    origin_port, destination_port, planned_departure, actual_departure, planned_arrival, actual_arrival,
    planned_clearance, actual_clearance, planned_delivery, actual_delivery)
  values (org, po, 'EXP-' || yr || '-018', 'delivered', 'MSKU 220931 7', 'MAEU 240877105', 'Maersk',
    port, 'Anvers', d - 66, d - 65, d - 46, d - 45, d - 43, d - 43, d - 41, least(m0 - 3, d - 40))
  returning id into sh;
  insert into public.shipment_items (organization_id, shipment_id, purchase_order_item_id, quantity) values (org, sh, i1, 25000);
  insert into public.shipment_costs (organization_id, shipment_id, category, amount, currency, exchange_rate) values
    (org, sh, 'customs', 1250000, cur, 1), (org, sh, 'transit', 450000, cur, 1), (org, sh, 'local_transport', 620000, cur, 1);
  insert into public.documents (organization_id, shipment_id, doc_type, status, file_name)
  select org, sh, t, 'validated', t || '-demo.pdf'
  from unnest(array['invoice', 'packing_list', 'bill_of_lading', 'certificate_of_origin', 'customs_declaration']) t;
end;
$$;

revoke all on function private.seed_demo(uuid) from public;

-- Appelée par l'application à la première connexion : crée l'entreprise,
-- rattache l'utilisateur comme administrateur et initialise les taux.
create function public.create_organization(
  p_name text,
  p_country text,
  p_currency text,
  p_with_demo boolean default false
) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  org uuid;
begin
  if uid is null then
    raise exception 'Authentification requise.' using errcode = '28000';
  end if;
  if exists (select 1 from public.organization_members m where m.user_id = uid) then
    raise exception 'Ce compte est déjà rattaché à une entreprise.' using errcode = '23505';
  end if;

  insert into public.organizations (name, country, currency)
  values (trim(p_name), coalesce(nullif(trim(p_country), ''), 'Côte d''Ivoire'), p_currency)
  returning id into org;
  insert into public.organization_members (organization_id, user_id, role) values (org, uid, 'admin');
  -- EUR : parité fixe. USD et CNY : valeurs indicatives, à ajuster dans l'application.
  insert into public.exchange_rates (organization_id, currency, rate) values
    (org, 'EUR', 655.957), (org, 'USD', 598.5), (org, 'CNY', 83.2);

  if p_with_demo then
    perform private.seed_demo(org);
  end if;
  return org;
end;
$$;

revoke all on function public.create_organization(text, text, text, boolean) from public, anon;
grant execute on function public.create_organization(text, text, text, boolean) to authenticated;
