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
  // Imprimer
  var pr = document.getElementById('imprimer');
  if (pr) pr.addEventListener('click', function () {
    document.querySelectorAll('details.carte').forEach(function (d) { d.open = true; });
    window.print();
  });
  // Tout replier / déplier
  var tout = document.getElementById('toutbtn');
  if (tout) tout.addEventListener('click', function () {
    var cartes = document.querySelectorAll('details.carte');
    var ouvrir = tout.getAttribute('data-etat') === 'ferme';
    cartes.forEach(function (d) { d.open = ouvrir; });
    tout.setAttribute('data-etat', ouvrir ? 'ouvert' : 'ferme');
    tout.textContent = ouvrir ? 'Tout replier' : 'Tout déplier';
  });
  // Filtre par sous-thème
  var filtres = document.querySelectorAll('.f[data-sub]');
  filtres.forEach(function (b) {
    b.addEventListener('click', function () {
      var sub = b.getAttribute('data-sub');
      filtres.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      document.querySelectorAll('details.carte').forEach(function (carte) {
        var n = 0;
        carte.querySelectorAll('.mesure').forEach(function (m) {
          var ok = sub === 'tous' || m.getAttribute('data-sub') === sub;
          m.hidden = !ok; if (ok) n++;
        });
        var aucun = carte.querySelector('.aucun-sub');
        var aMesures = carte.querySelectorAll('.mesure').length > 0;
        if (aucun) aucun.hidden = !(aMesures && n === 0);
      });
    });
  });

  // Raison du vote de chaque groupe : bulle au survol (souris), au toucher (mobile) et au clavier.
  // Une seule bulle ouverte à la fois. Le choix survol / toucher dépend de l'appareil, pas de la largeur d'écran.
  var groupes = document.querySelectorAll('.grp');
  if (groupes.length) {
    var survol = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    var ouvert = null, minuteur = null;
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
      ouvert.querySelector('.grp-btn').setAttribute('aria-expanded', 'false');
      ouvert = null;
    };
    var ouvrir = function (li) {
      if (ouvert === li) return;
      fermer();
      li.classList.add('ouvert');
      li.querySelector('.grp-btn').setAttribute('aria-expanded', 'true');
      ouvert = li;
      placer(li);
    };
    groupes.forEach(function (li) {
      var btn = li.querySelector('.grp-btn');
      if (!btn) return;
      btn.addEventListener('click', function () {
        if (ouvert === li && btn.getAttribute('data-survol') !== '1') fermer(); else ouvrir(li);
        btn.removeAttribute('data-survol');
      });
      if (survol) {
        li.addEventListener('mouseenter', function () {
          clearTimeout(minuteur);
          minuteur = setTimeout(function () { ouvrir(li); btn.setAttribute('data-survol', '1'); }, 120);
        });
        li.addEventListener('mouseleave', function () {
          clearTimeout(minuteur);
          btn.removeAttribute('data-survol');
          if (ouvert === li && !li.contains(document.activeElement)) fermer();
        });
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && ouvert) { var b = ouvert.querySelector('.grp-btn'); fermer(); b.focus(); }
    });
    document.addEventListener('click', function (e) {
      if (ouvert && !ouvert.contains(e.target)) fermer();
    });
    document.addEventListener('focusin', function (e) {
      if (ouvert && !ouvert.contains(e.target)) fermer();
    });
    window.addEventListener('resize', function () { if (ouvert) placer(ouvert); });
  }
// Étiquette de viabilité : explication au clic, au toucher, au clavier (details natif) et au survol (souris).
  // Une seule explication ouverte à la fois ; Échap la referme.
  var nivs = document.querySelectorAll('details.niv');
  if (nivs.length) {
    var survolNiv = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    nivs.forEach(function (d) {
      var sm = d.querySelector('summary');
      d.addEventListener('toggle', function () {
        if (d.open) nivs.forEach(function (o) { if (o !== d && o.open) o.open = false; });
      });
      if (survolNiv) {
        var t = null;
        d.addEventListener('mouseenter', function () {
          clearTimeout(t);
          t = setTimeout(function () { if (!d.open) { d.setAttribute('data-survol', '1'); d.open = true; } }, 150);
        });
        d.addEventListener('mouseleave', function () {
          clearTimeout(t);
          if (d.getAttribute('data-survol') === '1') { d.open = false; d.removeAttribute('data-survol'); }
        });
        // Un clic sur une explication ouverte au survol la garde ouverte
        sm.addEventListener('click', function (e) {
          if (d.getAttribute('data-survol') === '1') { e.preventDefault(); d.removeAttribute('data-survol'); }
        });
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      nivs.forEach(function (d) { if (d.open) { d.open = false; d.removeAttribute('data-survol'); d.querySelector('summary').focus(); } });
    });
  }
})();
