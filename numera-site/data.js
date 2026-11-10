/* =====================================================================
   NUMERA GROUPES — CONTENU DU SITE
   ---------------------------------------------------------------------
   C'est LE fichier à modifier pour mettre le site à jour.
   Aucune connaissance en programmation n'est nécessaire : changez les
   textes entre guillemets, enregistrez, rechargez la page.
   ===================================================================== */

window.NUMERA = {
  /* ---------- Informations de l'entreprise ---------- */
  entreprise: {
    nom: "NUMERA GROUPES",
    slogan: "Nous donnons forme à vos idées numériques.",
    accroche:
      "Sites web, applications et solutions digitales sur mesure. Nous accompagnons les entreprises, de l'idée jusqu'à la mise en ligne.",
    apropos: [
      "NUMERA GROUPES est une entreprise spécialisée dans la conception de solutions numériques. Nous aidons les entrepreneurs, les PME et les organisations à se doter d'outils modernes, fiables et simples à utiliser.",
      "Chaque projet est mené avec la même exigence : comprendre le besoin, proposer la solution la plus juste, puis livrer un produit dont nos clients sont fiers.",
    ],
    email: "contact@numeragroupes.com", // ← à remplacer par votre adresse
    telephone: "", // ex. "+237 6 00 00 00 00" (laisser vide pour masquer)
    whatsapp: "", // numéro au format international sans + ni espaces, ex. "237600000000"
    adresse: "", // ex. "Yaoundé, Cameroun"
    reseaux: {
      linkedin: "",
      facebook: "",
      instagram: "",
      github: "",
    },
  },

  /* ---------- Services proposés ---------- */
  services: [
    {
      titre: "Sites web",
      texte:
        "Sites vitrines, e-commerce et plateformes sur mesure, rapides et adaptés à tous les écrans.",
    },
    {
      titre: "Applications",
      texte:
        "Applications web et mobiles pensées pour vos utilisateurs : gestion, réservation, suivi, tableaux de bord.",
    },
    {
      titre: "Design & identité",
      texte:
        "Logos, chartes graphiques et interfaces soignées pour une image de marque cohérente.",
    },
    {
      titre: "Conseil & accompagnement",
      texte:
        "Audit, stratégie digitale, maintenance et formation pour faire évoluer vos outils dans la durée.",
    },
  ],

  /* ---------- Méthode de travail ---------- */
  methode: [
    { titre: "Écoute", texte: "Nous prenons le temps de comprendre votre activité, vos objectifs et vos contraintes." },
    { titre: "Conception", texte: "Maquettes et plan de réalisation validés avec vous avant de commencer." },
    { titre: "Réalisation", texte: "Développement par étapes, avec des points réguliers pour que vous suiviez l'avancée." },
    { titre: "Livraison & suivi", texte: "Mise en ligne, prise en main et accompagnement après le lancement." },
  ],

  /* ---------- PROJETS (porte-folio) ----------
     Pour ajouter un projet : copiez un bloc { ... }, collez-le et modifiez-le.

     statut      : "termine"  ou  "en-cours"
     avancement  : pourcentage (0 à 100), utilisé pour les projets en cours
     image       : chemin d'une image (ex. "images/mon-projet.jpg").
                   Laissez "" pour afficher une couverture générée automatiquement.
     lien        : adresse du projet en ligne (laisser "" s'il n'y en a pas)

     ⚠ Les projets ci-dessous sont des EXEMPLES à remplacer par vos vrais projets.
  ------------------------------------------------ */
  projets: [
    {
      titre: "Exemple — Site vitrine d'entreprise",
      categorie: "Site web",
      statut: "termine",
      annee: "2026",
      client: "Nom du client",
      resume: "Refonte complète du site d'une PME avec présentation des services et formulaire de contact.",
      description:
        "Décrivez ici le contexte du projet, le besoin du client, ce que vous avez réalisé et le résultat obtenu.",
      technologies: ["HTML", "CSS", "JavaScript"],
      image: "",
      lien: "",
    },
    {
      titre: "Exemple — Boutique en ligne",
      categorie: "E-commerce",
      statut: "termine",
      annee: "2025",
      client: "Nom du client",
      resume: "Boutique en ligne avec catalogue, panier et paiement mobile.",
      description:
        "Décrivez ici le contexte du projet, le besoin du client, ce que vous avez réalisé et le résultat obtenu.",
      technologies: ["React", "Node.js"],
      image: "",
      lien: "",
    },
    {
      titre: "Exemple — Identité visuelle",
      categorie: "Design",
      statut: "termine",
      annee: "2025",
      client: "Nom du client",
      resume: "Création du logo, de la charte graphique et des supports de communication.",
      description:
        "Décrivez ici le contexte du projet, le besoin du client, ce que vous avez réalisé et le résultat obtenu.",
      technologies: ["Figma", "Illustrator"],
      image: "",
      lien: "",
    },
    {
      titre: "Exemple — Application de gestion des tâches",
      categorie: "Application",
      statut: "en-cours",
      avancement: 60,
      annee: "2026",
      client: "Projet interne",
      resume: "Outil de suivi des tâches et de la performance des équipes, avec tableau de bord.",
      description:
        "Décrivez ici l'objectif du projet, ce qui est déjà fait et les prochaines étapes.",
      technologies: ["React", "Express", "Base de données"],
      image: "",
      lien: "",
    },
    {
      titre: "Exemple — Application mobile de réservation",
      categorie: "Application",
      statut: "en-cours",
      avancement: 35,
      annee: "2026",
      client: "Nom du client",
      resume: "Application permettant de réserver et de payer une prestation depuis son téléphone.",
      description:
        "Décrivez ici l'objectif du projet, ce qui est déjà fait et les prochaines étapes.",
      technologies: ["React Native"],
      image: "",
      lien: "",
    },
  ],
};
