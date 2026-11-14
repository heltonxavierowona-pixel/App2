# COMMERCE AI

Le gestionnaire intelligent des petits commerces : ventes, stock, dépenses, dettes clients
et rentabilité estimée, depuis un téléphone ou un ordinateur.

## Fonctionnalités

- **Tableau de bord** jour / semaine / mois : chiffre d'affaires, marge estimée, dépenses,
  bénéfice estimé, argent encaissé, produits les plus vendus, modes de paiement.
- **Ventes** : caisse tactile, remise, prix modifiable, paiement espèces / Mobile Money / carte /
  crédit avec acompte, historique, retours d'articles, reçu par WhatsApp.
- **Produits** : prix d'achat et de vente, catégories, codes internes, marge par produit.
- **Stock** : entrées, sorties, inventaire, seuils minimums, alertes, autonomie en jours et
  quantité conseillée à commander.
- **Dépenses** par catégorie.
- **Clients & dettes** : solde par client, historique des règlements, rappel WhatsApp.
- **Conseils** automatiques : ruptures prévues, stock dormant, ventes à perte, dettes anciennes,
  tendance des ventes, meilleur jour de la semaine.
- **Réglages** : nom de la boutique, devise, sauvegarde / restauration, exports CSV, données de démo.

Les données sont enregistrées sur l'appareil (localStorage) et l'application fonctionne hors
connexion ; elle peut être installée sur l'écran d'accueil du téléphone.

## Démarrer

```bash
npm install
npm run dev      # développement
npm test         # tests de la logique métier
npm run build    # version de production dans dist/
```

## Organisation

- `src/lib/logic.js` — règles métier pures (ventes, stock, dettes, indicateurs)
- `src/lib/insights.js` — calcul des conseils
- `src/pages/` — un fichier par écran
- `ancien-taskapp/` — l'ancienne application de tâches, conservée telle quelle
