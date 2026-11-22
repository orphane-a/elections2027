// Elections 2027 : petits comportements de la fiche thème (aucun cookie, aucun suivi)
(function () {
  // Copier le lien de la fiche
  var copy = document.getElementById('copier');
  if (copy) copy.addEventListener('click', function () {
    var lab = copy.querySelector('[role=status]');
    var url = location.href.split('#')[0];
    var done = function () { if (lab) lab.textContent = 'Lien copié'; };
    try { navigator.clipboard.writeText(url).then(done, done); } catch (e) { done(); }
  });
  // Imprimer : la feuille de style d impression déplie toutes les mesures
  var pr = document.getElementById('imprimer');
  if (pr) pr.addEventListener('click', function () { window.print(); });

  // Mesures clefs : chaque mesure se déplie seule (bouton avec aria-expanded)
  document.querySelectorAll('.mbtn').forEach(function (b) {
    b.addEventListener('click', function () {
      b.setAttribute('aria-expanded', b.getAttribute('aria-expanded') === 'true' ? 'false' : 'true');
    });
  });

  // Filtre par sous thème : un candidat sans mesure sur le sous thème n'est pas masqué.
  // Il passe sous le bloc des candidats qui ont une mesure sur ce sous thème, avec la mention
  // « Aucune mesure clef retenue sur ce sous thème ». Chaque bloc reste dans l'ordre alphabétique.
  var filtres = document.querySelectorAll('.f[data-sub]');
  var liste = document.querySelector('.qpq-liste');
  if (liste && filtres.length) {
    var cartesPc = Array.prototype.slice.call(liste.querySelectorAll('.pc'));
    var col2Initiale = liste.querySelector('.pc.col2');
    var listeSans = document.createElement('ul');
    listeSans.className = 'qpq-liste sans';
    listeSans.setAttribute('aria-label', 'Candidats sans mesure clef sur ce sous thème');
    listeSans.hidden = true;
    liste.parentNode.insertBefore(listeSans, liste.nextSibling);
    // Deux colonnes : choisit la carte qui ouvre la colonne 2 pour équilibrer les hauteurs
    var couper = function (ul) {
      var lis = Array.prototype.slice.call(ul.children);
      lis.forEach(function (li) { li.classList.remove('col2'); });
      if (lis.length < 2 || getComputedStyle(ul).columnCount === '1') return;
      var h = lis.map(function (li) { return li.offsetHeight; });
      var total = h.reduce(function (a, b) { return a + b; }, 0), cumul = 0, meilleur = 1, ecart = Infinity;
      h.forEach(function (x, i) {
        cumul += x;
        var e = Math.abs(total - 2 * cumul);
        if (i < h.length - 1 && e < ecart) { ecart = e; meilleur = i + 1; }
      });
      lis[meilleur].classList.add('col2');
    };
    var appliquer = function (sub) {
      filtres.forEach(function (x) {
        var actif = x.getAttribute('data-sub') === sub;
        x.setAttribute('aria-pressed', actif ? 'true' : 'false');
        x.classList.toggle('on', actif);
      });
      var avec = [], sans = [];
      cartesPc.forEach(function (carte) {
        var n = 0;
        carte.querySelectorAll('.mes').forEach(function (m) {
          var ok = sub === 'tous' || m.getAttribute('data-sub') === sub;
          m.classList.toggle('masque', !ok);
          if (ok) n++;
        });
        var aucun = carte.querySelector('.aucun-sub');
        if (aucun) aucun.hidden = n > 0;
        carte.classList.toggle('sans-sub', n === 0);
        (n > 0 ? avec : sans).push(carte);
      });
      avec.forEach(function (c) { liste.appendChild(c); });
      sans.forEach(function (c) { listeSans.appendChild(c); });
      listeSans.hidden = sans.length === 0;
      if (sub === 'tous') {
        cartesPc.forEach(function (c) { c.classList.remove('col2'); });
        if (col2Initiale) col2Initiale.classList.add('col2');
      } else {
        couper(liste);
        couper(listeSans);
      }
      var etat = document.getElementById('filtre-etat');
      var nb = document.querySelectorAll('.mes:not(.masque)').length;
      if (etat) etat.textContent = nb + (nb > 1 ? ' mesures affichées' : ' mesure affichée') + (sub === 'tous' ? '' : ' pour le sous thème ' + sub + '. ' + avec.length + ' candidat' + (avec.length > 1 ? 's' : '') + ' en tête, ' + sans.length + ' sans mesure sur ce sous thème en dessous') + '.';
    };
    filtres.forEach(function (b) {
      b.addEventListener('click', function () { appliquer(b.getAttribute('data-sub')); });
    });
    // À l'impression, toutes les mesures sont dépliées dans l'ordre alphabétique : on revient à « Tous »
    window.addEventListener('beforeprint', function () { appliquer('tous'); });
  }

  // Groupes à l Assemblée : un clic ouvre la bulle (nom complet, raison du vote, candidats rattachés).
  // Une seule bulle ouverte à la fois ; Échap ou un clic ailleurs la referme.
  var groupes = document.querySelectorAll('.gchip');
  if (groupes.length) {
    var ouvert = null;
    var placer = function (li) {
      var b = li.querySelector('.bulle');
      b.style.left = '0px';
      var r = b.getBoundingClientRect(), marge = 16, largeur = document.documentElement.clientWidth;
      if (r.right > largeur - marge) b.style.left = (largeur - marge - r.right) + 'px';
      r = b.getBoundingClientRect();
      if (r.left < marge) b.style.left = (parseFloat(b.style.left) + marge - r.left) + 'px';
    };
    var fermer = function () {
      if (!ouvert) return;
      ouvert.classList.remove('ouvert');
      ouvert.querySelector('.gbtn').setAttribute('aria-expanded', 'false');
      ouvert = null;
    };
    var ouvrir = function (li) {
      fermer();
      li.classList.add('ouvert');
      li.querySelector('.gbtn').setAttribute('aria-expanded', 'true');
      ouvert = li;
      placer(li);
    };
    groupes.forEach(function (li) {
      li.querySelector('.gbtn').addEventListener('click', function () {
        if (ouvert === li) fermer(); else ouvrir(li);
      });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && ouvert) { var b = ouvert.querySelector('.gbtn'); fermer(); b.focus(); }
    });
    document.addEventListener('click', function (e) {
      if (ouvert && !ouvert.contains(e.target)) fermer();
    });
    document.addEventListener('focusin', function (e) {
      if (ouvert && !ouvert.contains(e.target)) fermer();
    });
    window.addEventListener('resize', function () { if (ouvert) placer(ouvert); });
  }
  // Impression : les sources du chiffrage s'impriment en entier, puis reprennent leur état d'avant
  var srcch = document.querySelectorAll('details.srcch');
  if (srcch.length) {
    var fermes = [];
    window.addEventListener('beforeprint', function () {
      fermes = [];
      srcch.forEach(function (d) { if (!d.open) { fermes.push(d); d.open = true; } });
    });
    window.addEventListener('afterprint', function () {
      fermes.forEach(function (d) { d.open = false; });
      fermes = [];
    });
  }
})();
// Cloche des nouveautés (ticket 90) : ouverture au clic, à Entrée ou Espace, fermeture par Échap, « Fermer » ou clic extérieur.
// Pastille : nombre de nouveautés pas encore vues, mémorisé dans le navigateur (localStorage), jamais de cookie.
(function () {
  var cloche = document.querySelector('.cloche');
  if (!cloche) return;
  var btn = cloche.querySelector('.cloche-js');
  var pop = document.getElementById('cloche-pop');
  if (!btn || !pop) return;
  var CLE = 'nouveautes-vues';
  var date = cloche.getAttribute('data-maj') || '';
  var nb = parseInt(cloche.getAttribute('data-nb') || '0', 10) || 0;
  var lire = function () { try { return window.localStorage.getItem(CLE); } catch (e) { return null; } };
  var ecrire = function (v) { try { window.localStorage.setItem(CLE, v); } catch (e) { /* stockage indisponible : pas de pastille mémorisée */ } };
  var pastille = null;
  // Visiter la page des mises à jour compte comme avoir vu les nouveautés
  if (date && /nouveautes\.html$/.test(location.pathname)) ecrire(date);
  if (date && nb > 0 && lire() !== date) {
    pastille = document.createElement('span');
    pastille.className = 'pastille';
    pastille.setAttribute('aria-hidden', 'true');
    pastille.textContent = String(nb);
    btn.appendChild(pastille);
    btn.setAttribute('aria-label', 'Nouveautés, ' + nb + ' non vue' + (nb > 1 ? 's' : ''));
  }
  var ouvert = function () { return btn.getAttribute('aria-expanded') === 'true'; };
  var ouvrir = function () {
    pop.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    if (date) ecrire(date);
    // La pastille est cachée, pas retirée : un clic tombé sur elle reste un clic dans la cloche
    if (pastille) { pastille.hidden = true; pastille = null; btn.setAttribute('aria-label', 'Nouveautés'); }
    // Une seule fenêtre ouverte à la fois : on referme les étiquettes de niveau
    document.querySelectorAll('details.niv[open], details.burger[open]').forEach(function (d) { d.open = false; });
    pop.focus();
  };
  var fermer = function (rendreFocus) {
    if (!ouvert()) return;
    pop.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    if (rendreFocus) btn.focus();
  };
  btn.addEventListener('click', function () { if (ouvert()) fermer(false); else ouvrir(); });
  var f = pop.querySelector('.fermer');
  if (f) f.addEventListener('click', function () { fermer(true); });
  // Phase de capture : Échap ferme d'abord la cloche et rend le focus au bouton, sans toucher au reste de la page
  document.addEventListener('keydown', function (e) {
    if ((e.key === 'Escape' || e.key === 'Esc') && ouvert()) { e.preventDefault(); e.stopImmediatePropagation(); fermer(true); }
  }, true);
  var dansCloche = function (e) {
    var chemin = e.composedPath ? e.composedPath() : [];
    return cloche.contains(e.target) || chemin.indexOf(cloche) > -1;
  };
  document.addEventListener('click', function (e) {
    if (ouvert() && !dansCloche(e)) fermer(false);
  });
  document.addEventListener('focusin', function (e) {
    if (ouvert() && !cloche.contains(e.target)) fermer(false);
  });
})();
