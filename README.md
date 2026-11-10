# NUMERA Import-Export

Suivi des opérations d'import-export pour les PME d'Afrique francophone : commandes
fournisseurs, expéditions, pièces de dossier et coût de revient, en FCFA.

## Écrans

1. **Tableau de bord** — expéditions en cours, en retard, arrivées au port, marge du mois.
2. **Commandes** — fournisseur, produits, quantités, prix d'achat, devise, incoterm.
3. **Expéditions** — six étapes (commandé → livré), dates prévues et réelles, conteneur, connaissement.
4. **Documents** — dépôt et validation des cinq pièces par expédition, pièces manquantes.
5. **Coût de revient** — achat + fret + assurance + douane + transit + transport local, coût unitaire et marge par lot.

L'écran **Équipe** (icône en haut à droite) permet à un administrateur d'inviter ses collègues
par e-mail et de les retirer.

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

1. Créer un projet Supabase et appliquer les fichiers de `supabase/migrations` dans l'ordre.
2. Renseigner `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` dans Vercel.
3. Dans Supabase > Authentication > URL Configuration, mettre l'adresse du site dans « Site URL »
   et dans « Redirect URLs » : sans cela, les liens de confirmation et de réinitialisation
   renvoient vers `localhost:3000`.
4. Dans Supabase > Authentication > Emails, brancher un service d'envoi (SMTP) : l'envoi intégré
   est limité à quelques e-mails par heure et ne convient pas à de vrais utilisateurs.
5. Passer le projet Supabase sur une offre payante avant d'y mettre des données réelles :
   l'offre gratuite n'a pas de sauvegardes et met le projet en pause après une semaine sans activité.

`vercel.json` pose les en-têtes de sécurité (politique de contenu stricte, pas d'affichage en
cadre). Si le projet Supabase n'est pas sur `*.supabase.co`, adapter `connect-src`.

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
