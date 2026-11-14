-- Caisse (poste) sur laquelle chaque opération a été saisie. Vide = caisse principale.
-- Permet à une boutique d'avoir plusieurs caisses, chacune avec sa clôture et sa numérotation.
alter table public.commerce_ops add column if not exists register text not null default ''
  check (char_length(register) <= 40);
