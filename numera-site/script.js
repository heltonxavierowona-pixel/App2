/* NUMERA GROUPES — logique du site (le contenu se modifie dans data.js) */
(function () {
  "use strict";
  document.documentElement.classList.add("js");

  var D = window.NUMERA || {};
  var E = D.entreprise || {};
  var projets = D.projets || [];
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
  if (E.slogan) $("hero-slogan").textContent = E.slogan;
  $("hero-accroche").textContent = E.accroche || "";
  $("footer-slogan").textContent = E.slogan || "";
  $("annee").textContent = new Date().getFullYear();
  $("apropos-texte").innerHTML = (E.apropos || []).map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("");

  /* ---------- Chiffres clés (calculés à partir des projets) ---------- */
  var nbFinis = projets.filter(function (p) { return p.statut === "termine"; }).length;
  var nbCours = projets.filter(function (p) { return p.statut === "en-cours"; }).length;
  var categories = projets.map(function (p) { return p.categorie; }).filter(function (c, i, a) { return c && a.indexOf(c) === i; });
  $("stats").innerHTML = [
    [nbFinis, nbFinis > 1 ? "projets réalisés" : "projet réalisé"],
    [nbCours, nbCours > 1 ? "projets en cours" : "projet en cours"],
    [categories.length, categories.length > 1 ? "domaines d'expertise" : "domaine d'expertise"],
  ].map(function (s) { return "<div><dt>" + s[1] + "</dt><dd>" + pad(s[0]) + "</dd></div>"; }).join("");

  /* ---------- Services & méthode ---------- */
  $("services-liste").innerHTML = (D.services || []).map(function (s, i) {
    return '<article class="card reveal"><span class="card__num">' + pad(i + 1) + "</span><h3>" + esc(s.titre) + "</h3><p>" + esc(s.texte) + "</p></article>";
  }).join("");
  $("methode-liste").innerHTML = (D.methode || []).map(function (m) {
    return '<li class="reveal"><h3>' + esc(m.titre) + "</h3><p>" + esc(m.texte) + "</p></li>";
  }).join("");

  /* ---------- Projets ---------- */
  var PALETTE = [["#2f5bea", "#16255f"], ["#e0672f", "#6b2408"], ["#1f8a5b", "#0b3d2a"], ["#8b4fd9", "#33186b"], ["#d13d6a", "#5e1230"], ["#1c8ea8", "#0a3b49"]];
  function cover(p) {
    var i = Math.max(0, categories.indexOf(p.categorie)) % PALETTE.length;
    var c = PALETTE[i];
    var titre = String(p.titre || "").replace(/^Exemple\s*[—-]\s*/i, "");
    var inner = p.image
      ? '<img src="' + esc(p.image) + '" alt="" loading="lazy">'
      : '<span class="cover__letter" aria-hidden="true">' + esc(titre.charAt(0).toUpperCase()) + "</span>";
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
  chips($("filtre-statut"), [["tous", "Tous", projets.length], ["termine", "Réalisés", nbFinis], ["en-cours", "En cours", nbCours]], "statut");
  if (categories.length > 1) {
    chips($("filtre-categorie"), [["toutes", "Toutes catégories"]].concat(categories.map(function (c) { return [c, c]; })), "categorie");
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
  renderProjets();

  /* ---------- Fenêtre de détail ---------- */
  var modal = $("modal");
  $("projets-liste").addEventListener("click", function (e) {
    var card = e.target.closest(".project");
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
      ((p.technologies || []).length ? '<ul class="tags">' + p.technologies.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>" : "") +
      (lien ? '<a class="btn btn--dark" href="' + esc(lien) + '" target="_blank" rel="noopener">Visiter le projet</a>' : "") +
      "</div>";
    modal.showModal();
    modal.scrollTop = 0;
  });
  $("modal-close").addEventListener("click", function () { modal.close(); });
  modal.addEventListener("click", function (e) { if (e.target === modal) modal.close(); });

  /* ---------- Contact ---------- */
  var infos = [];
  if (E.email) infos.push(["E-mail", E.email, "mailto:" + E.email]);
  if (E.telephone) infos.push(["Téléphone", E.telephone, "tel:" + E.telephone.replace(/[^\d+]/g, "")]);
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
    var sujet = "Demande de projet (" + f.type.value + ") — " + f.nom.value.trim();
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
