/* NUMERA GROUPES — logique du site (le contenu se modifie dans data.js) */
(function () {
  "use strict";
  document.documentElement.classList.add("js");

  var D = window.NUMERA || {};
  var E = D.entreprise || {};
  var CFG = window.NUMERA_CONFIG || null;
  var projets = D.projets || [];
  try {
    var cache = JSON.parse(localStorage.getItem("numera-projets") || "null");
    if (CFG && Array.isArray(cache)) projets = cache;
  } catch (e) {}
  var $ = function (id) { return document.getElementById(id); };

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function safeUrl(u) {
    return /^(https?:\/\/|mailto:|tel:)/i.test(u || "") ? u : "";
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }

  /* ---------- Textes généraux ---------- */
  if (E.slogan) {
    var mots = E.slogan.split(" "), fin = mots.splice(-2).join(" ");
    $("hero-slogan").innerHTML = esc(mots.join(" ")) + " <em>" + esc(fin) + "</em>";
  }
  $("hero-accroche").textContent = E.accroche || "";
  $("footer-slogan").textContent = E.slogan || "";
  $("annee").textContent = new Date().getFullYear();
  $("apropos-texte").innerHTML = (E.apropos || []).map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("");

  /* ---------- Chiffres clés (calculés à partir des projets) ---------- */
  var nbFinis, nbCours, categories;
  function majChiffres() {
    nbFinis = projets.filter(function (p) { return p.statut === "termine"; }).length;
    nbCours = projets.filter(function (p) { return p.statut === "en-cours"; }).length;
    categories = projets.map(function (p) { return p.categorie; }).filter(function (c, i, a) { return c && a.indexOf(c) === i; });
    $("stats").innerHTML = [
      [nbFinis, nbFinis > 1 ? "projets réalisés" : "projet réalisé"],
      [nbCours, nbCours > 1 ? "projets en cours" : "projet en cours"],
      [categories.length, categories.length > 1 ? "domaines d'expertise" : "domaine d'expertise"],
    ].map(function (s) { return "<div><dt>" + s[1] + "</dt><dd>" + pad(s[0]) + "</dd></div>"; }).join("");
  }

  /* ---------- Services & méthode ---------- */
  $("services-liste").innerHTML = (D.services || []).map(function (s, i) {
    return '<article class="card reveal"><span class="card__num">' + pad(i + 1) + "</span><h3>" + esc(s.titre) + "</h3><p>" + esc(s.texte) + "</p></article>";
  }).join("");
  $("methode-liste").innerHTML = (D.methode || []).map(function (m) {
    return '<li class="reveal"><h3>' + esc(m.titre) + "</h3><p>" + esc(m.texte) + "</p></li>";
  }).join("");

  /* ---------- Projets ---------- */
  var PALETTE = [["#0A3B66", "#051E36"], ["#00875A", "#03402c"], ["#0A5FA8", "#0A3B66"], ["#0b6b6b", "#052f3a"]];
  function cover(p) {
    var i = Math.max(0, categories.indexOf(p.categorie)) % PALETTE.length;
    var c = PALETTE[i];
    var inner = p.image
      ? '<img src="' + esc(p.image) + '" alt="" loading="lazy">'
      : '<span class="cover__label" aria-hidden="true"><img src="numera-mark.svg" alt="">' + esc(p.vignette || p.titre) + "</span>";
    return '<div class="cover" style="background:linear-gradient(135deg,' + c[0] + "," + c[1] + ')">' + inner + "</div>";
  }
  function badge(p, cls) {
    var run = p.statut === "en-cours";
    return '<span class="badge ' + (run ? "badge--run " : "") + (cls || "") + '">' + (run ? "En cours" : "Réalisé") + "</span>";
  }
  function progress(p) {
    if (p.statut !== "en-cours" || p.avancement == null) return "";
    var v = Math.min(100, Math.max(0, Number(p.avancement) || 0));
    return '<div><div class="progress" role="progressbar" aria-valuenow="' + v + '" aria-valuemin="0" aria-valuemax="100" aria-label="Avancement"><span style="width:' + v + '%"></span></div>' +
      '<div class="progress__label"><span>Avancement</span><span>' + v + " %</span></div></div>";
  }

  var filtre = { statut: "tous", categorie: "toutes" };

  function chips(el, items, key) {
    el.innerHTML = items.map(function (it) {
      return '<button type="button" class="chip" data-v="' + esc(it[0]) + '" aria-pressed="' + (filtre[key] === it[0]) + '">' + esc(it[1]) +
        (it[2] != null ? " <small>" + it[2] + "</small>" : "") + "</button>";
    }).join("");
    el.onclick = function (e) {
      var b = e.target.closest(".chip");
      if (!b) return;
      filtre[key] = b.dataset.v;
      Array.prototype.forEach.call(el.children, function (c) { c.setAttribute("aria-pressed", c === b); });
      renderProjets();
    };
  }
  function majFiltres() {
    if (categories.indexOf(filtre.categorie) < 0) filtre.categorie = "toutes";
    chips($("filtre-statut"), [["tous", "Tous", projets.length], ["termine", "Réalisés", nbFinis], ["en-cours", "En cours", nbCours]], "statut");
    if (categories.length > 1) {
      chips($("filtre-categorie"), [["toutes", "Toutes catégories"]].concat(categories.map(function (c) { return [c, c]; })), "categorie");
    } else {
      $("filtre-categorie").innerHTML = "";
    }
  }

  function renderProjets() {
    var html = "";
    projets.forEach(function (p, i) {
      if (filtre.statut !== "tous" && p.statut !== filtre.statut) return;
      if (filtre.categorie !== "toutes" && p.categorie !== filtre.categorie) return;
      html += '<button type="button" class="project" data-i="' + i + '">' +
        '<div style="position:relative;width:100%">' + badge(p) + cover(p) + "</div>" +
        '<div class="project__body"><span class="project__meta">' + esc(p.categorie) + (p.annee ? " · " + esc(p.annee) : "") + "</span>" +
        "<h3>" + esc(p.titre) + "</h3><p>" + esc(p.resume) + "</p>" + progress(p) +
        '<span class="project__more">Voir le projet</span></div></button>';
    });
    $("projets-liste").innerHTML = html;
    $("projets-vide").hidden = html !== "";
  }

  /* ---------- Fenêtre de détail ---------- */
  var modal = $("modal");
  function majHero() {
    $("hero-stack").innerHTML = projets.slice(0, 3).map(function (p, i) {
    var run = p.statut === "en-cours";
    var sigle = String(p.vignette || p.titre).split(/\s+/).map(function (w) { return w.charAt(0); }).join("").slice(0, 2).toUpperCase();
    return '<button type="button" class="mini" data-i="' + i + '"><span class="mini__icon" aria-hidden="true">' + esc(sigle) + "</span>" +
      "<span><strong>" + esc(p.titre) + "</strong><small>" + esc(p.categorie) + "</small></span>" +
      '<span class="mini__state' + (run ? " mini__state--run" : "") + '">' + (run ? "En cours" : "Réalisé") + "</span></button>";
    }).join("");
  }
  function afficher() { majChiffres(); majFiltres(); majHero(); renderProjets(); }
  afficher();

  /* Les projets sont gérés depuis l'espace d'administration (admin.html) :
     on affiche d'abord la dernière version connue, puis on la met à jour. */
  if (CFG) {
    fetch(CFG.url + "/rest/v1/vitrine_projets?select=*&order=position.asc,created_at.asc", {
      headers: { apikey: CFG.key, Authorization: "Bearer " + CFG.key },
    }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    }).then(function (rows) {
      if (!Array.isArray(rows)) return;
      var txt = JSON.stringify(rows);
      if (txt === JSON.stringify(projets)) return;
      projets = rows;
      try { localStorage.setItem("numera-projets", txt); } catch (e) {}
      afficher();
    }).catch(function () { /* hors ligne : on garde la version affichée */ });
  }
  $("hero-stack").addEventListener("click", ouvrir);
  $("projets-liste").addEventListener("click", ouvrir);
  function ouvrir(e) {
    var card = e.target.closest("[data-i]");
    if (!card) return;
    var p = projets[card.dataset.i];
    var lien = safeUrl(p.lien);
    $("modal-contenu").innerHTML = cover(p) +
      '<div class="modal__body">' + badge(p, "badge--static") +
      '<h3 id="modal-titre">' + esc(p.titre) + "</h3>" +
      "<p>" + esc(p.description || p.resume) + "</p>" + progress(p) +
      '<dl class="facts">' +
      (p.client ? "<div><dt>Client</dt><dd>" + esc(p.client) + "</dd></div>" : "") +
      (p.categorie ? "<div><dt>Catégorie</dt><dd>" + esc(p.categorie) + "</dd></div>" : "") +
      (p.annee ? "<div><dt>Année</dt><dd>" + esc(p.annee) + "</dd></div>" : "") +
      "</dl>" +
      ((p.points || []).length ? '<ul class="points">' + p.points.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>" : "") +
      ((p.technologies || []).length ? '<ul class="tags">' + p.technologies.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>" : "") +
      (lien ? '<a class="btn btn--dark" href="' + esc(lien) + '" target="_blank" rel="noopener">Visiter le projet</a>' : "") +
      "</div>";
    modal.showModal();
    modal.scrollTop = 0;
  }
  $("modal-close").addEventListener("click", function () { modal.close(); });
  modal.addEventListener("click", function (e) { if (e.target === modal) modal.close(); });

  /* ---------- Contact ---------- */
  var infos = [];
  if (E.email) infos.push(["E-mail", E.email, "mailto:" + E.email]);
  (E.telephones || []).forEach(function (t) { infos.push(["Téléphone", t, "tel:" + t.replace(/[^\d+]/g, "")]); });
  if (E.whatsapp) infos.push(["WhatsApp", "Discuter sur WhatsApp", "https://wa.me/" + E.whatsapp.replace(/\D/g, "")]);
  if (E.adresse) infos.push(["Adresse", E.adresse, ""]);
  $("contact-infos").innerHTML = infos.map(function (c) {
    return "<li><span>" + c[0] + "</span>" + (c[2] ? '<a href="' + esc(c[2]) + '">' + esc(c[1]) + "</a>" : "<strong>" + esc(c[1]) + "</strong>") + "</li>";
  }).join("");

  $("f-type").innerHTML = (D.services || []).map(function (s) { return "<option>" + esc(s.titre) + "</option>"; }).join("") + "<option>Autre</option>";

  $("contact-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var f = e.target;
    var ok = f.nom.value.trim() && /^\S+@\S+\.\S+$/.test(f.email.value.trim()) && f.message.value.trim();
    $("form-error").hidden = !!ok;
    if (!ok) return;
    var sujet = "Contact site NUMERA GROUPES (" + f.type.value + ") — " + f.nom.value.trim();
    var corps = f.message.value.trim() + "\n\n—\n" + f.nom.value.trim() + "\n" + f.email.value.trim();
    window.location.href = "mailto:" + (E.email || "") + "?subject=" + encodeURIComponent(sujet) + "&body=" + encodeURIComponent(corps);
  });

  var noms = { linkedin: "LinkedIn", facebook: "Facebook", instagram: "Instagram", github: "GitHub" };
  $("footer-reseaux").innerHTML = Object.keys(E.reseaux || {}).map(function (k) {
    var u = safeUrl(E.reseaux[k]);
    return u ? '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + (noms[k] || esc(k)) + "</a>" : "";
  }).join("");

  /* ---------- Navigation ---------- */
  var header = $("header"), burger = $("burger"), nav = $("nav");
  function onScroll() { header.classList.toggle("is-solid", window.scrollY > 30 || nav.classList.contains("is-open")); }
  window.addEventListener("scroll", onScroll, { passive: true });
  burger.addEventListener("click", function () {
    var open = nav.classList.toggle("is-open");
    burger.setAttribute("aria-expanded", open);
    burger.setAttribute("aria-label", open ? "Fermer le menu" : "Ouvrir le menu");
    onScroll();
  });
  nav.addEventListener("click", function (e) {
    if (e.target.tagName === "A") { nav.classList.remove("is-open"); burger.setAttribute("aria-expanded", "false"); onScroll(); }
  });
  onScroll();

  /* ---------- Animations & lien actif ---------- */
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); } });
    }, { threshold: 0.12 });
    document.querySelectorAll(".reveal").forEach(function (el) { io.observe(el); });

    var links = nav.querySelectorAll('a[href^="#"]:not(.btn)');
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        links.forEach(function (a) { a.classList.toggle("is-active", a.getAttribute("href") === "#" + en.target.id); });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    document.querySelectorAll("main section[id]").forEach(function (s) { spy.observe(s); });
  } else {
    document.querySelectorAll(".reveal").forEach(function (el) { el.classList.add("is-in"); });
  }
})();
