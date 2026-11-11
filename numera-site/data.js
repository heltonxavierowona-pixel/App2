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
    slogan: "Des logiciels qui font grandir les entreprises.",
    accroche:
      "NUMERA GROUPES conçoit et édite des plateformes en ligne pour les PME du Cameroun et d'Afrique : facturation et TVA, vente assistée par l'intelligence artificielle, import-export.",
    apropos: [
      "NUMERA GROUPES est un éditeur de logiciels basé au Cameroun. Nous créons des outils en ligne simples, fiables et adaptés aux réalités locales : paiement par Mobile Money, règles fiscales camerounaises, usage sur téléphone comme sur ordinateur.",
      "Chaque produit Numera répond à un besoin concret du quotidien des entreprises : facturer et déclarer sans pénalité, trouver des clients, suivre ses commandes et ses coûts. Nous les concevons, les développons et les faisons évoluer nous-mêmes.",
    ],
    email: "heltonxavierowona@gmail.com",
    telephones: ["+237 657 56 67 62", "+237 654 36 40 96"],
    whatsapp: "237657566762", // numéro au format international, sans + ni espaces
    adresse: "Ayene, Cameroun",
    reseaux: {
      linkedin: "",
      facebook: "",
      instagram: "",
      github: "",
    },
  },

  /* ---------- Domaines d'activité ---------- */
  services: [
    {
      titre: "Facturation & fiscalité",
      texte:
        "Factures conformes, déclaration de TVA mensuelle calculée automatiquement et suivi des échéances pour éviter les pénalités.",
    },
    {
      titre: "Vente assistée par l'IA",
      texte:
        "Un agent intelligent qui trouve des prospects sur les réseaux sociaux, converse sur WhatsApp et relance jusqu'à la vente.",
    },
    {
      titre: "Import-export",
      texte:
        "Suivi des commandes, des expéditions, des documents et du coût de revient, du fournisseur jusqu'à la livraison.",
    },
    {
      titre: "Solutions sur mesure",
      texte:
        "Un besoin particulier ? Nous concevons des applications web adaptées à votre activité et à votre façon de travailler.",
    },
  ],

  /* ---------- Méthode de travail ---------- */
  methode: [
    { titre: "Écoute", texte: "Nous partons d'un problème réel, observé sur le terrain auprès des entreprises." },
    { titre: "Conception", texte: "Des écrans simples, pensés pour le téléphone comme pour l'ordinateur." },
    { titre: "Réalisation", texte: "Un développement rigoureux, vérifié par des tests automatiques à chaque étape." },
    { titre: "Suivi", texte: "Mise en ligne, accompagnement des utilisateurs et améliorations continues." },
  ],

  /* ---------- PROJETS (porte-folio) ----------
     ⚠ Les projets se gèrent maintenant depuis la page admin.html (boutons
     Ajouter / Modifier / Marquer comme terminé). La liste ci-dessous ne sert
     que de secours si la base de données est injoignable.

     statut      : "termine"  ou  "en-cours"
     avancement  : pourcentage (0 à 100) — facultatif, pour les projets en cours
     vignette    : texte court affiché en grand sur la couverture
     image       : capture d'écran du projet (ex. "images/numera.jpg").
                   Laissez "" pour afficher la couverture automatique.
     lien        : adresse du projet en ligne (laisser "" s'il n'y en a pas)
  ------------------------------------------------ */
  projets: [
    {
      titre: "Numera",
      categorie: "Facturation & TVA",
      statut: "termine",
      annee: "2026",
      client: "Produit NUMERA GROUPES",
      vignette: "Factures & TVA",
      resume:
        "Le logiciel de facturation et de déclaration de TVA des PME et des cabinets comptables du Cameroun.",
      description:
        "Une PME y émet des factures conformes et obtient chaque mois sa déclaration de TVA calculée automatiquement, avant l'échéance du 15. Un cabinet comptable y suit tout son portefeuille de dossiers sur un seul écran, trié par urgence. Les abonnements se paient par MTN Mobile Money ou Orange Money.",
      points: [
        "Factures, avoirs et achats avec numérotation continue",
        "Déclaration de TVA mensuelle en un clic",
        "Alertes d'échéance et estimation des pénalités",
        "Tableau de bord de portefeuille pour les cabinets",
        "Paiement par Mobile Money, essai gratuit",
      ],
      technologies: ["Next.js", "NestJS", "PostgreSQL", "Mobile Money"],
      image: "",
      lien: "https://numera-topaz.vercel.app",
    },
    {
      titre: "Numera Agentic",
      categorie: "Intelligence artificielle",
      statut: "en-cours",
      annee: "2026",
      client: "Produit NUMERA GROUPES",
      vignette: "Agent IA de vente",
      resume:
        "Un agent IA qui trouve les bons prospects, les amène sur WhatsApp, converse et relance jusqu'à la vente.",
      description:
        "Chaque entreprise décrit son produit ; l'agent IA identifie les bons prospects sur les réseaux sociaux, les fait passer sur WhatsApp dès qu'ils montrent de l'intérêt, puis converse et relance jusqu'à la vente. L'utilisateur pilote tout depuis la plateforme et valide lui-même les sujets sensibles comme les prix.",
      points: [
        "Analyse IA du produit : cibles, réseaux, ton, langues",
        "Boîte de réception unique WhatsApp, Messenger, Instagram",
        "Pilote automatique avec validation humaine des prix",
        "Relances limitées et respect des règles des réseaux",
        "Tableau de bord et alertes en temps réel",
      ],
      technologies: ["React", "Supabase", "IA générative", "API WhatsApp Business"],
      image: "",
      lien: "",
    },
    {
      titre: "Numera Import-Export",
      categorie: "Import-export",
      statut: "en-cours",
      annee: "2026",
      client: "Produit NUMERA GROUPES",
      vignette: "Import-Export",
      resume:
        "Suivi des commandes, des expéditions, des documents et des coûts de revient pour les importateurs.",
      description:
        "Une application pour les entreprises d'import-export : suivre chaque commande et chaque expédition, centraliser les documents et connaître précisément son coût de revient.",
      points: [
        "Suivi des commandes et des expéditions",
        "Gestion des documents",
        "Calcul du coût de revient",
        "Utilisable sur téléphone, en clair ou en sombre",
      ],
      technologies: ["React", "Vite", "Supabase"],
      image: "",
      lien: "",
    },
  ],
};
