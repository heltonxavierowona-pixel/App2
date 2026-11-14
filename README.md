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
- **Rapport mensuel** imprimable (PDF).
- **Assistant** : questions en langage courant et conseils automatiques.
- **Équipe** (mode en ligne) : rôles patron et vendeur.

## Deux modes

- **Sur un appareil** (par défaut) : aucune configuration, les données restent sur l'appareil
  (IndexedDB), l'application fonctionne hors connexion.
- **En ligne** : comptes par e-mail, synchronisation entre appareils, équipe, assistant par IA.
  Nécessite un projet Supabase :
  1. exécuter `supabase/migrations/001_init.sql` sur le projet ;
  2. déployer la fonction `supabase/functions/assistant` et définir le secret `ANTHROPIC_API_KEY` ;
  3. définir `VITE_SUPABASE_URL` et `VITE_SUPABASE_KEY` (clé publique) au moment du build.

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
