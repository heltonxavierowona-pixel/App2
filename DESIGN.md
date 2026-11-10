# NUMERA Import-Export — design

Surface de travail (mode « operate ») : la clarté passe avant l'effet.

- **Thème.** Clair, fort contraste : l'application se lit dehors, en plein soleil.
- **Palette.** Sable pour le fond (`--sand-*`), bleu pétrole pour la structure et les étapes
  franchies (`--petrol-*`), ocre pour l'action principale (`--ocre-600`). Vert, ambre et rouge
  sont réservés aux états (livré, au port, retard ou pièce manquante).
- **Typographie.** Archivo variable, un seul fichier auto-hébergé (35 Ko). Chiffres tabulaires
  partout. Corps 16 px, jamais sous 12 px.
- **Signature.** La « ligne maritime » : les six étapes d'une expédition dessinées comme les
  escales d'une route. Horizontale dans les listes, verticale avec les dates sur la fiche. Le
  tronçon en cours passe en pointillés rouges quand l'expédition est en retard.
- **Navigation.** Cinq onglets en bas sur téléphone, colonne à gauche à partir de 960 px.
  Formulaires en pleine page, pas de fenêtres modales.
- **Tactile.** Cibles de 44 px au minimum, champs numériques avec le clavier adapté.
- **Poids.** Pas de bibliothèque d'interface ni d'icônes : SVG dessinés dans `ui.tsx`. Un
  fichier JavaScript par écran, chargé à la demande.

Les jetons sont en tête de `src/styles.css`.
