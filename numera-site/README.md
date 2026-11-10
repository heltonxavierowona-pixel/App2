# Site NUMERA GROUPES

Site vitrine et porte-folio de l'entreprise. Site statique : aucun serveur ni installation nécessaire.

## Voir le site

Ouvrez `index.html` dans un navigateur.

## Modifier le contenu

Tout le contenu se trouve dans **`data.js`** :

- `entreprise` : slogan, texte de présentation, e-mail, téléphone, WhatsApp, adresse, réseaux sociaux
- `services` : les services proposés
- `methode` : les étapes de travail
- `projets` : le porte-folio

### Ajouter un projet

Copiez un bloc `{ ... }` dans la liste `projets` et modifiez-le :

| Champ | Rôle |
|---|---|
| `statut` | `"termine"` ou `"en-cours"` |
| `avancement` | pourcentage (projets en cours uniquement) |
| `image` | chemin d'une image, ex. `"images/mon-projet.jpg"` (créez un dossier `images/`). Vide = couverture automatique |
| `lien` | adresse du projet en ligne (commençant par `https://`) |

Les compteurs de la page d'accueil et les filtres se mettent à jour tout seuls.

## Mettre en ligne

Le dossier `numera-site/` peut être déposé tel quel sur n'importe quel hébergeur statique (Vercel, Netlify, GitHub Pages…), en le choisissant comme dossier racine.
