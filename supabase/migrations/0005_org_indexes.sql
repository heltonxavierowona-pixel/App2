-- Index sur organization_id pour les tables qui n'en avaient pas : les suppressions
-- en cascade d'une entreprise et les contrôles de clés étrangères restent rapides.
create index documents_org_idx on public.documents (organization_id);
create index purchase_order_items_org_idx on public.purchase_order_items (organization_id);
create index shipment_costs_org_idx on public.shipment_costs (organization_id);
create index shipment_events_org_idx on public.shipment_events (organization_id);
create index shipment_items_org_idx on public.shipment_items (organization_id);
