/* NUMERA GROUPES — espace d'administration des projets */
(function () {
  "use strict";

  var CFG = window.NUMERA_CONFIG;
  var CLE_SESSION = "numera-admin-session";
  var $ = function (id) { return document.getElementById(id); };
  var session = null;
  var projets = [];
  var enEdition = null; // projet en cours de modification (null = nouveau)
  var imageChoisie = null; // fichier sélectionné, pas encore envoyé
  var imageActuelle = ""; // adresse de l'image déjà enregistrée

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------- Session ---------- */
  function lireSession() {
    try { return JSON.parse(localStorage.getItem(CLE_SESSION) || "null"); } catch (e) { return null; }
  }
  function ecrireSession(s) {
    session = s;
    try {
      if (s) localStorage.setItem(CLE_SESSION, JSON.stringify(s));
      else localStorage.removeItem(CLE_SESSION);
    } catch (e) {}
  }
  function depuisReponse(d) {
    return {
      access_token: d.access_token,
      refresh_token: d.refresh_token,
      expire: Date.now() + (d.expires_in || 3600) * 1000,
      email: (d.user && d.user.email) || (session && session.email) || "",
    };
  }
  function authFetch(chemin, corps) {
    return fetch(CFG.url + "/auth/v1/" + chemin, {
      method: "POST",
      headers: { apikey: CFG.key, "Content-Type": "application/json" },
      body: JSON.stringify(corps),
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) { var e = new Error(d.error_description || d.msg || d.message || "Erreur"); e.status = r.status; throw e; }
        return d;
      });
    });
  }
  /* Renvoie un jeton valide, en le renouvelant s'il expire bientôt. */
  function jeton() {
    if (!session) return Promise.reject(expiree());
    if (session.expire - Date.now() > 60000) return Promise.resolve(session.access_token);
    return authFetch("token?grant_type=refresh_token", { refresh_token: session.refresh_token }).then(function (d) {
      ecrireSession(depuisReponse(d));
      return session.access_token;
    }, function () { throw expiree(); });
  }
  function expiree() { var e = new Error("Votre session a expiré. Reconnectez-vous."); e.session = true; return e; }

  /* ---------- Accès aux données ---------- */
  function api(methode, requete, corps) {
    return jeton().then(function (t) {
      return fetch(CFG.url + "/rest/v1/vitrine_projets" + (requete || ""), {
        method: methode,
        headers: { apikey: CFG.key, Authorization: "Bearer " + t, "Content-Type": "application/json", Prefer: "return=representation" },
        body: corps ? JSON.stringify(corps) : undefined,
      });
    }).then(function (r) {
      if (r.status === 401) throw expiree();
      return r.json().catch(function () { return null; }).then(function (d) {
        if (!r.ok) {
          var refus = r.status === 403 || (d && d.code === "42501");
          throw new Error(refus ? "Ce compte n'a pas le droit de modifier les projets." : (d && d.message) || "L'enregistrement a échoué.");
        }
        // Une écriture qui ne touche aucune ligne a été bloquée par les règles de sécurité.
        if (methode !== "GET" && Array.isArray(d) && d.length === 0) throw new Error("Ce compte n'a pas le droit de modifier les projets.");
        return d;
      });
    });
  }
  function envoyerImage(fichier) {
    var ext = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" }[fichier.type];
    var nom = "projets/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + "." + ext;
    return jeton().then(function (t) {
      return fetch(CFG.url + "/storage/v1/object/vitrine/" + nom, {
        method: "POST",
        headers: { apikey: CFG.key, Authorization: "Bearer " + t, "Content-Type": fichier.type, "cache-control": "31536000" },
        body: fichier,
      });
    }).then(function (r) {
      if (!r.ok) throw new Error("L'image n'a pas pu être envoyée. Vérifiez votre connexion et vos droits.");
      return CFG.url + "/storage/v1/object/public/vitrine/" + nom;
    });
  }

  /* ---------- Écrans ---------- */
  function montrer(connecte) {
    $("ecran-connexion").hidden = connecte;
    $("ecran-projets").hidden = !connecte;
    $("barre-actions").hidden = !connecte;
  }
  var minuterie;
  function message(texte, erreur) {
    var m = $("message");
    m.textContent = texte;
    m.className = "notice" + (erreur ? " notice--err" : "");
    m.hidden = false;
    clearTimeout(minuterie);
    if (!erreur) minuterie = setTimeout(function () { m.hidden = true; }, 5000);
  }
  function echec(e) {
    if (e && e.session) {
      ecrireSession(null);
      montrer(false);
      var c = $("connexion-erreur"); c.textContent = e.message; c.hidden = false;
      if ($("fenetre").open) $("fenetre").close();
      return;
    }
    message((e && e.message) || "Une erreur est survenue.", true);
  }

  /* ---------- Connexion ---------- */
  $("form-connexion").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var err = $("connexion-erreur"), bouton = $("connexion-bouton");
    var email = $("c-email").value.trim(), mdp = $("c-mdp").value;
    err.hidden = true;
    if (!email || !mdp) { err.textContent = "Saisissez votre e-mail et votre mot de passe."; err.hidden = false; return; }
    bouton.disabled = true; bouton.textContent = "Connexion…";
    authFetch("token?grant_type=password", { email: email, password: mdp }).then(function (d) {
      ecrireSession(depuisReponse(d));
      $("c-mdp").value = "";
      montrer(true);
      return charger();
    }).catch(function (e) {
      err.textContent = e.status === 400 ? "E-mail ou mot de passe incorrect." : (e.status ? "Connexion impossible : " + e.message : "Connexion impossible. Vérifiez votre accès à Internet.");
      err.hidden = false;
    }).then(function () { bouton.disabled = false; bouton.textContent = "Se connecter"; });
  });
  $("deconnexion").addEventListener("click", function () {
    var t = session && session.access_token;
    if (t) fetch(CFG.url + "/auth/v1/logout", { method: "POST", headers: { apikey: CFG.key, Authorization: "Bearer " + t } }).catch(function () {});
    ecrireSession(null);
    montrer(false);
  });

  /* ---------- Liste des projets ---------- */
  function charger() {
    return api("GET", "?select=*&order=position.asc,created_at.asc").then(function (rows) {
      projets = rows || [];
      afficher();
    }).catch(echec);
  }
  function afficher() {
    var finis = projets.filter(function (p) { return p.statut === "termine"; }).length;
    $("compte-resume").textContent = projets.length + (projets.length > 1 ? " projets" : " projet") + " · " + finis + (finis > 1 ? " terminés" : " terminé") + " · " + (projets.length - finis) + " en cours";
    $("liste-vide").hidden = projets.length > 0;
    $("liste").innerHTML = projets.map(function (p, i) {
      var run = p.statut === "en-cours";
      return '<li class="prow" data-id="' + esc(p.id) + '">' +
        '<div class="prow__thumb">' + (p.image ? '<img src="' + esc(p.image) + '" alt="">' : '<img class="mark" src="numera-mark.svg" alt="">') + "</div>" +
        '<div class="prow__info"><h2>' + esc(p.titre) + ' <span class="badge badge--static' + (run ? " badge--run" : "") + '">' + (run ? "En cours" : "Terminé") + "</span></h2>" +
        "<p>" + esc([p.categorie, p.annee].filter(Boolean).join(" · ") || "Sans catégorie") + "</p></div>" +
        '<div class="prow__actions">' +
        '<button type="button" class="abtn' + (run ? " abtn--ok" : "") + '" data-a="statut">' + (run ? "✓ Marquer comme terminé" : "Remettre en cours") + "</button>" +
        '<button type="button" class="abtn" data-a="modifier">Modifier</button>' +
        '<button type="button" class="abtn abtn--icon" data-a="monter" aria-label="Monter" title="Monter"' + (i === 0 ? " disabled" : "") + ">↑</button>" +
        '<button type="button" class="abtn abtn--icon" data-a="descendre" aria-label="Descendre" title="Descendre"' + (i === projets.length - 1 ? " disabled" : "") + ">↓</button>" +
        '<span class="prow__spacer"></span>' +
        '<button type="button" class="abtn abtn--danger" data-a="supprimer">Supprimer</button>' +
        "</div></li>";
    }).join("");
    $("categories").innerHTML = projets.map(function (p) { return p.categorie; })
      .filter(function (c, i, a) { return c && a.indexOf(c) === i; })
      .map(function (c) { return '<option value="' + esc(c) + '">'; }).join("");
  }

  $("liste").addEventListener("click", function (ev) {
    var b = ev.target.closest("button[data-a]");
    if (!b || b.disabled) return;
    var id = b.closest(".prow").dataset.id;
    var i = projets.findIndex(function (p) { return p.id === id; });
    var p = projets[i];
    if (!p) return;
    var action = b.dataset.a;

    if (action === "modifier") return ouvrir(p);

    if (action === "statut") {
      var nouveau = p.statut === "en-cours" ? "termine" : "en-cours";
      b.disabled = true;
      return api("PATCH", "?id=eq." + id, { statut: nouveau, updated_at: new Date().toISOString() }).then(function () {
        message("« " + p.titre + " » est maintenant " + (nouveau === "termine" ? "marqué comme terminé." : "remis en cours."));
        return charger();
      }).catch(function (e) { b.disabled = false; echec(e); });
    }

    if (action === "supprimer") {
      if (!window.confirm("Supprimer définitivement « " + p.titre + " » ? Il disparaîtra du site.")) return;
      b.disabled = true;
      return api("DELETE", "?id=eq." + id).then(function () {
        message("« " + p.titre + " » a été supprimé.");
        return charger();
      }).catch(function (e) { b.disabled = false; echec(e); });
    }

    if (action === "monter" || action === "descendre") {
      var j = action === "monter" ? i - 1 : i + 1;
      if (j < 0 || j >= projets.length) return;
      var ordre = projets.slice();
      ordre[i] = projets[j]; ordre[j] = p;
      // On renumérote tout pour garder un ordre propre même si des positions étaient égales.
      var suite = Promise.resolve();
      ordre.forEach(function (q, k) {
        if (q.position !== k + 1) suite = suite.then(function () { return api("PATCH", "?id=eq." + q.id, { position: k + 1 }); });
      });
      return suite.then(charger).catch(function (e) { echec(e); charger(); });
    }
  });

  /* ---------- Formulaire ---------- */
  function majAvancement() {
    $("champ-avancement").hidden = $("form-projet").statut.value !== "en-cours";
  }
  function majApercu() {
    var a = $("apercu");
    var src = imageChoisie ? URL.createObjectURL(imageChoisie) : imageActuelle;
    a.hidden = !src;
    if (src) a.src = src;
    $("retirer-image").hidden = !src;
  }
  function ouvrir(p) {
    enEdition = p || null;
    imageChoisie = null;
    imageActuelle = (p && p.image) || "";
    var f = $("form-projet");
    $("fenetre-titre").textContent = p ? "Modifier le projet" : "Ajouter un projet";
    $("p-titre").value = p ? p.titre : "";
    $("p-categorie").value = p ? p.categorie : "";
    $("p-annee").value = p ? p.annee : String(new Date().getFullYear());
    f.statut.value = p ? p.statut : "en-cours";
    $("p-avancement").value = p && p.avancement != null ? p.avancement : "";
    $("p-resume").value = p ? p.resume : "";
    $("p-description").value = p ? p.description : "";
    $("p-points").value = p ? (p.points || []).join("\n") : "";
    $("p-client").value = p ? p.client : "";
    $("p-technologies").value = p ? (p.technologies || []).join(", ") : "";
    $("p-lien").value = p ? p.lien : "";
    $("p-vignette").value = p ? p.vignette : "";
    $("p-image").value = "";
    $("projet-erreur").hidden = true;
    majAvancement(); majApercu();
    $("fenetre").showModal();
    $("fenetre").querySelector(".pform__body").scrollTop = 0;
    $("p-titre").focus();
  }
  function fermer() { $("fenetre").close(); }

  $("ajouter").addEventListener("click", function () { ouvrir(null); });
  $("fermer").addEventListener("click", fermer);
  $("annuler").addEventListener("click", fermer);
  Array.prototype.forEach.call($("form-projet").statut, function (r) { r.addEventListener("change", majAvancement); });

  $("p-image").addEventListener("change", function () {
    var f = this.files[0], err = $("projet-erreur");
    err.hidden = true;
    if (!f) return;
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) { err.textContent = "Choisissez une image au format PNG, JPG ou WebP."; err.hidden = false; this.value = ""; return; }
    if (f.size > 3 * 1024 * 1024) { err.textContent = "Cette image dépasse 3 Mo. Choisissez une image plus légère."; err.hidden = false; this.value = ""; return; }
    imageChoisie = f;
    majApercu();
  });
  $("retirer-image").addEventListener("click", function () {
    imageChoisie = null; imageActuelle = ""; $("p-image").value = "";
    majApercu();
  });

  function lignes(texte, sep) {
    return texte.split(sep).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  $("form-projet").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var f = ev.target, err = $("projet-erreur"), bouton = $("enregistrer");
    var titre = $("p-titre").value.trim(), resume = $("p-resume").value.trim(), lien = $("p-lien").value.trim();
    var av = $("p-avancement").value.trim();
    var probleme = "";
    if (!titre) probleme = "Donnez un nom au projet.";
    else if (!resume) probleme = "Ajoutez un résumé en une phrase.";
    else if (lien && !/^https?:\/\/\S+$/i.test(lien)) probleme = "L'adresse du projet doit commencer par https://";
    else if (av && !(Number(av) >= 0 && Number(av) <= 100)) probleme = "L'avancement doit être compris entre 0 et 100.";
    if (probleme) { err.textContent = probleme; err.hidden = false; return; }
    err.hidden = true;

    var enCours = f.statut.value === "en-cours";
    var donnees = {
      titre: titre,
      categorie: $("p-categorie").value.trim(),
      annee: $("p-annee").value.trim(),
      statut: f.statut.value,
      avancement: enCours && av ? Math.round(Number(av)) : null,
      resume: resume,
      description: $("p-description").value.trim(),
      points: lignes($("p-points").value, "\n"),
      client: $("p-client").value.trim(),
      technologies: lignes($("p-technologies").value, ","),
      lien: lien,
      vignette: $("p-vignette").value.trim(),
      updated_at: new Date().toISOString(),
    };

    bouton.disabled = true; bouton.textContent = "Enregistrement…";
    var nouveau = !enEdition;
    (imageChoisie ? envoyerImage(imageChoisie) : Promise.resolve(imageActuelle)).then(function (url) {
      donnees.image = url;
      if (nouveau) {
        donnees.position = projets.reduce(function (m, p) { return Math.max(m, p.position || 0); }, 0) + 1;
        return api("POST", "", donnees);
      }
      return api("PATCH", "?id=eq." + enEdition.id, donnees);
    }).then(function () {
      fermer();
      message(nouveau ? "« " + titre + " » a été ajouté. Il est visible sur le site." : "« " + titre + " » a été mis à jour.");
      return charger();
    }).catch(function (e) {
      if (e && e.session) return echec(e);
      err.textContent = e.message || "L'enregistrement a échoué."; err.hidden = false;
    }).then(function () { bouton.disabled = false; bouton.textContent = "Enregistrer"; });
  });

  /* ---------- Démarrage ---------- */
  if (!CFG) {
    montrer(false);
    $("connexion-erreur").textContent = "La configuration de la base de données est absente (config.js).";
    $("connexion-erreur").hidden = false;
    return;
  }
  session = lireSession();
  if (session && session.refresh_token) { montrer(true); charger(); }
  else montrer(false);
})();
