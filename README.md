# NUMERA Import-Export

Suivi des opérations d'import-export pour les PME d'Afrique francophone : commandes
fournisseurs, expéditions, pièces de dossier et coût de revient, en FCFA.

## Écrans

1. **Tableau de bord** — expéditions en cours, en retard, arrivées au port, marge du mois.
2. **Commandes** — fournisseur, produits, quantités, prix d'achat, devise, incoterm.
3. **Expéditions** — six étapes (commandé → livré), dates prévues et réelles, conteneur, connaissement.
4. **Documents** — dépôt et validation des cinq pièces par expédition, pièces manquantes.
5. **Coût de revient** — achat + fret + assurance + douane + transit + transport local, coût unitaire et marge par lot.

## Stack

- Vite + React + TypeScript, sans bibliothèque d'interface (CSS maison, une police auto-hébergée).
- Supabase : Postgres, Auth, Storage. Chaque table porte `organization_id` et est protégée par RLS.
- Déploiement : Vercel (`vercel.json`).

## Démarrer en local

```bash
npm install
npx supabase start          # Postgres + Auth + Storage, applique supabase/migrations
cp .env.example .env.local  # URL et clé publishable affichées par « supabase status »
npm run dev
```

Créez un compte, saisissez le nom de l'entreprise et cochez « Charger des données de
démonstration » : sept commandes et huit expéditions fictives sont créées, datées par
rapport au jour du chargement.

## Mettre en production

1. Créer un projet Supabase et appliquer les quatre fichiers de `supabase/migrations` dans l'ordre.
2. Renseigner `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` dans Vercel.
3. Dans Supabase > Authentication > URL Configuration, mettre l'adresse Vercel dans « Site URL »
   et dans « Redirect URLs » : sans cela, le lien de confirmation renvoie vers `localhost:3000`.
   Configurer aussi l'envoi des e-mails (ou désactiver la confirmation pour une démo).

## Tests

```bash
npm test                 # calculs : conversion, coût de revient, marge, retards
SUPABASE_ANON_KEY=… npm run test:isolation   # isolation entre entreprises, sur la pile locale
```

## Règles de calcul

- Chaque montant garde sa devise, le taux appliqué et sa valeur en FCFA : changer un taux ne
  modifie pas l'historique. L'euro est à parité fixe (655,957) ; USD et CNY se règlent dans
  Coûts > Modifier les taux.
- Coût d'un lot = achat + frais d'approche. Les frais sont répartis entre produits au prorata
  de leur valeur d'achat. Coût unitaire = part du produit ÷ quantité expédiée.
- Marge = (prix de vente prévu − coût unitaire) × quantité. La marge du mois additionne les
  lots livrés dans le mois.
- Une expédition est en retard quand sa prochaine échéance (arrivée au port, puis livraison)
  est dépassée.

## Arborescence

```
supabase/migrations   schéma, RLS, stockage, création d'entreprise et données de démo
src/lib               types, formats, calculs (costs.ts), accès aux données (store.tsx)
src/components        coquille, ligne maritime, éléments communs
src/screens           un fichier par écran, chargé à la demande
legacy/               ancienne TaskApp, conservée telle quelle
```
