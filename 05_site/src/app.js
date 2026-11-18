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

  // Filtre par sous thème : un candidat sans mesure sur le sous thème garde sa place
  var filtres = document.querySelectorAll('.f[data-sub]');
  filtres.forEach(function (b) {
    b.addEventListener('click', function () {
      var sub = b.getAttribute('data-sub');
      filtres.forEach(function (x) {
        var actif = x === b;
        x.setAttribute('aria-pressed', actif ? 'true' : 'false');
        x.classList.toggle('on', actif);
      });
      document.querySelectorAll('.pc').forEach(function (carte) {
        var n = 0;
        carte.querySelectorAll('.mes').forEach(function (m) {
          var ok = sub === 'tous' || m.getAttribute('data-sub') === sub;
          m.classList.toggle('masque', !ok);
          if (ok) n++;
        });
        var aucun = carte.querySelector('.aucun-sub');
        if (aucun) aucun.hidden = n > 0;
      });
    });
  });

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
