# NUMERA COMMERCIAL AI

Le gestionnaire intelligent des petits commerces, par NUMERA GROUPES : ventes, stock, achats,
dépenses, dettes et rentabilité estimée, depuis un téléphone ou un ordinateur.

## Fonctionnalités

- **Compte et boutiques** : le nom de la boutique est enregistré à l'ouverture du compte, figure sur
  toutes les factures et ne peut plus être modifié. Plusieurs boutiques par compte.
- **Tableau de bord** jour / semaine / mois : chiffre d'affaires, marge, dépenses, bénéfice estimé.
- **Ventes** : caisse tactile, scan de code-barres, variantes (tailles, couleurs), remises, paiement
  espèces / Mobile Money / carte / crédit, factures numérotées imprimables (PDF), retours, WhatsApp.
- **Produits et stock** : prix d'achat et de vente, codes, variantes, seuils, alertes, inventaire.
- **Achats et fournisseurs** : entrées de marchandise, coût moyen pondéré, dettes fournisseurs.
- **Dépenses**, **clients et dettes**, **clôture de caisse** (espèces attendues contre comptées).
- **Mode caisse sur ordinateur** : douchette code-barres, ticket 80 mm, monnaie à rendre, raccourcis
  clavier, vente au poids, catalogues de plusieurs milliers d'articles.
- **Plusieurs caisses par boutique** : chaque poste porte un nom de caisse, avec sa propre clôture
  et sa propre numérotation de factures.
- **Rapport mensuel** imprimable (PDF).
- **Assistant** : questions en langage courant et conseils automatiques.
- **Équipe** (mode en ligne) : rôles patron, gérant de boutique et vendeur.
- **Vue d'ensemble** de toutes les boutiques du patron, avec rapport général imprimable.
- **Rapports mensuels par e-mail** : chaque gérant reçoit le rapport de sa boutique, chaque patron
  un rapport général. Fonction `supabase/functions/commerce-monthly-report`, planifiée par
  `supabase/migrations/002_…sql` ; elle envoie par Gmail et s'active avec les secrets
  `GMAIL_USER` et `GMAIL_APP_PASSWORD` (mot de passe d'application Google). Elle charge la logique métier depuis ce dépôt à une version figée :
  après une modification de `src/lib/logic.js`, `overview.js` ou `monthly-email.js`, mettre à jour
  l'identifiant de commit en tête de la fonction et la redéployer.

## Deux modes

- **Sur un appareil** (par défaut) : aucune configuration, les données restent sur l'appareil
  (IndexedDB), l'application fonctionne hors connexion.
- **En ligne** : comptes par e-mail, synchronisation entre appareils, équipe, assistant par IA.
  Le service en ligne est le projet Supabase `numera-import-export` (partagé avec l'application
  import-export ; tous les objets de cette application sont préfixés `commerce_`) :
  - schéma et règles d'accès : `supabase/migrations/001_init.sql` (déjà appliqué) ;
  - assistant : fonction `supabase/functions/commerce-assistant` (déjà déployée) ; elle s'active
    en définissant le secret `ANTHROPIC_API_KEY` dans le projet ;
  - l'adresse et la clé publique sont dans `src/config.js` (`VITE_SUPABASE_URL` /
    `VITE_SUPABASE_KEY` permettent d'en changer au build).

## Démarrer

```bash
npm install
npm run dev      # développement
npm test         # tests de la logique métier
npm run build    # version de production dans dist/
```

## Organisation

- `src/lib/logic.js` — règles métier pures, rejouables (journal d'opérations)
- `src/lib/insights.js`, `src/lib/assistant.js` — conseils et réponses de l'assistant
- `src/store.jsx`, `src/lib/cloud.js` — session, boutiques, synchronisation
- `src/pages/`, `src/components/` — écrans et composants
- `supabase/` — schéma de la base, règles d'accès et fonction de l'assistant
- `ancien-taskapp/` — l'ancienne application de tâches, conservée telle quelle

Le logo est chargé depuis le site Numera ; pour l'embarquer, placer `numera-logo.png` dans
`public/` et faire pointer `BRAND_SITE` (dans `src/config.js`) vers `.`.
