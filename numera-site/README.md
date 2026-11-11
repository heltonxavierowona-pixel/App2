# Site NUMERA GROUPES

Site vitrine et porte-folio de l'entreprise. Site statique : aucun serveur ni installation nécessaire.

## Voir le site

Ouvrez `index.html` dans un navigateur.

## Modifier le contenu

Tout le contenu se trouve dans **`data.js`** :

- `entreprise` : slogan, texte de présentation, e-mail, téléphones, WhatsApp, adresse, réseaux sociaux
- `services` : les domaines d'activité
- `methode` : les étapes de travail
- `projets` : le porte-folio

### Ajouter un projet

Copiez un bloc `{ ... }` dans la liste `projets` et modifiez-le :

| Champ | Rôle |
|---|---|
| `statut` | `"termine"` ou `"en-cours"` |
| `avancement` | pourcentage (projets en cours uniquement) |
| `vignette` | texte court affiché sur la couverture automatique |
| `points` | liste des points forts affichés dans la fiche |
| `image` | chemin d'une image, ex. `"images/mon-projet.jpg"` (créez un dossier `images/`). Vide = couverture automatique |
| `lien` | adresse du projet en ligne (commençant par `https://`) |

Les compteurs de la page d'accueil et les filtres se mettent à jour tout seuls.

## Mettre en ligne

Le dossier `numera-site/` peut être déposé tel quel sur n'importe quel hébergeur statique (Vercel, Netlify, GitHub Pages…), en le choisissant comme dossier racine.
