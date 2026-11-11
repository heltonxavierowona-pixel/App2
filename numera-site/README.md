# Site NUMERA GROUPES

Site vitrine et porte-folio de l'entreprise. Site statique : aucun serveur ni installation nécessaire.

## Voir le site

Ouvrez `index.html` dans un navigateur.

## Gérer les projets (sans toucher au code)

Ouvrez **`/admin.html`** (lien « Administration » en bas du site) et connectez-vous avec le compte
administrateur Numera Import-Export. Vous pouvez alors :

- **Ajouter un projet** (bouton en haut à droite), avec une image si vous le souhaitez ;
- **Modifier** ou **Supprimer** un projet ;
- **Marquer comme terminé** / **Remettre en cours** en un clic ;
- changer l'ordre d'affichage avec les flèches ↑ ↓ (les trois premiers apparaissent en haut de l'accueil).

Les changements sont visibles sur le site immédiatement. Les projets sont enregistrés dans la table
`vitrine_projets` et les images dans le dossier `vitrine` du projet Supabase `numera-import-export`
(adresse et clé publique dans `config.js`). Seuls les comptes inscrits dans `platform_admins` peuvent écrire.

## Modifier les autres textes

Le reste du contenu se trouve dans **`data.js`** :

- `entreprise` : slogan, texte de présentation, e-mail, téléphones, WhatsApp, adresse, réseaux sociaux
- `services` : les domaines d'activité
- `methode` : les étapes de travail
- `projets` : liste de secours, affichée seulement si la base de données est injoignable

## Mettre en ligne

Le dossier `numera-site/` peut être déposé tel quel sur n'importe quel hébergeur statique (Vercel, Netlify, GitHub Pages…), en le choisissant comme dossier racine.
