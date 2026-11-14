# NUMERA Import-Export — design

Surface de travail (mode « operate ») : la clarté passe avant l'effet.

- **Thème.** Clair par défaut, à fort contraste : l'application se lit dehors, en plein soleil.
  Un mode sombre suit le réglage du téléphone ; le bouton lune/soleil de la barre du haut permet
  de le forcer, et le choix est mémorisé sur l'appareil. Seuls les jetons sémantiques
  (`--accent`, `--progress`, `--tint-*`, `--field-bg`, fonds et états) changent entre les deux.
- **Marque.** Le logo NUMERA (`public/numera-mark.svg`, repris de numera-agentic) figure dans
  la barre du haut, sur l'écran de connexion et comme icône du site.
- **Palette.** Celle du logo : bleu marine pour la structure (`--navy-*`), vert pour l'action
  et la progression (`--green-*`), fond clair bleuté (`--mist-*`). Ambre et rouge sont réservés
  aux états (au port, retard ou pièce manquante).
- **Typographie.** Plus Jakarta Sans variable, un seul fichier auto-hébergé (27 Ko), en graisse
  800 pour les titres et les chiffres clés. Chiffres tabulaires partout. Corps 16 px.
- **En-têtes.** Chaque écran s'ouvre sur un bandeau bleu marine que la première carte
  chevauche. L'accueil et la connexion y ajoutent le motif du logo (barres et flèche) et la
  marge du mois en très grand.
- **Signature.** La « ligne maritime » : les six étapes d'une expédition dessinées comme les
  escales d'une route, en vert pour le chemin parcouru. Horizontale dans les listes, verticale avec les dates sur la fiche. Le
  tronçon en cours passe en pointillés rouges quand l'expédition est en retard.
- **Navigation.** Cinq onglets en bas sur téléphone, colonne à gauche à partir de 960 px.
  Formulaires en pleine page, pas de fenêtres modales.
- **Tactile.** Cibles de 44 px au minimum, champs numériques avec le clavier adapté.
- **Poids.** Pas de bibliothèque d'interface ni d'icônes : SVG dessinés dans `ui.tsx`. Un
  fichier JavaScript par écran, chargé à la demande.

Les jetons sont en tête de `src/styles.css`.
