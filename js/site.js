/* ============================================================
   msaunders.dev : page behavior

   Two unrelated jobs, both presentation only. Nothing here is
   required to read the page: the name and the images both work with
   the script absent.
     1. the typed name in the hero
     2. a lightbox for anything marked [data-zoom]
   ============================================================ */
(function () {
  'use strict';

  /* --- typed name ----------------------------------------- */
  /* Opens on the domain, holds, backspaces it away, then types the name.
     The finished name is what sits in the markup, so it is what ships in the
     HTML and what a screen reader announces via aria-label; the animation only
     controls what is painted. If this never runs, the name is simply there. */
  var name = document.getElementById('typed');
  if (name) {
    var full = name.textContent;
    name.setAttribute('aria-label', full);

    var caret = document.createElement('span');
    caret.className = 'caret';
    caret.setAttribute('aria-hidden', 'true');
    caret.textContent = '_';

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      name.appendChild(caret);
    } else {
      var INTRO = 'msaunders.dev';
      var DOT = INTRO.indexOf('.');
      var out = document.createElement('span');
      out.setAttribute('aria-hidden', 'true');

      /* The domain's dot takes the accent, so the intro is painted as markup
         rather than text. INTRO is a literal with no markup characters in it,
         which is what makes composing it this way safe. */
      var showIntro = function (n) {
        if (n > DOT) {
          out.innerHTML = INTRO.slice(0, DOT)
                        + '<span class="typed__dot">.</span>'
                        + INTRO.slice(DOT + 1, n);
        } else {
          out.textContent = INTRO.slice(0, n);
        }
      };
      showIntro(INTRO.length);
      name.textContent = '';
      name.appendChild(out);
      name.appendChild(caret);

      var type = function (n) {
        out.textContent = full.slice(0, n);
        if (n < full.length) {
          /* Jitter, so it reads as typing rather than a ticker. */
          setTimeout(function () { type(n + 1); }, 45 + Math.random() * 55);
        }
      };

      var erase = function (n) {
        showIntro(n);
        if (n > 0) setTimeout(function () { erase(n - 1); }, 38);
        else setTimeout(function () { type(1); }, 260);
      };

      setTimeout(function () { erase(INTRO.length - 1); }, 2000);
    }
  }

  /* --- detail lists --------------------------------------- */
  /* The tag rows ship open, so the page reads whole with this script absent.
     On a phone they are most of its height, so they start folded and the
     summary becomes the tap target.

     The query is the one css/site.css uses for the phone layout, repeated
     here: change one and change the other. It is read on load and then only
     when it flips, never on every resize, so a list the reader opened stays
     open while they are reading it. */
  var PHONE = '(max-width: 860px), (pointer: coarse) and (max-width: 900px)';
  var drops = document.querySelectorAll('.drop');
  if (drops.length && window.matchMedia) {
    var phone = window.matchMedia(PHONE);
    var fold = function () {
      for (var i = 0; i < drops.length; i++) drops[i].open = !phone.matches;
    };
    fold();
    if (phone.addEventListener) phone.addEventListener('change', fold);
    else if (phone.addListener) phone.addListener(fold);   /* older Safari */
  }

  /* --- lightbox ------------------------------------------- */
  var zoomables = document.querySelectorAll('[data-zoom]');
  if (!zoomables.length) return;

  var lb = document.createElement('div');
  lb.className = 'lb';
  lb.hidden = true;
  lb.setAttribute('role', 'dialog');
  lb.setAttribute('aria-modal', 'true');
  lb.setAttribute('aria-label', 'Image viewer');
  lb.innerHTML =
    '<button class="lb__x" type="button" aria-label="Close image viewer">×</button>' +
    '<img alt=""><div class="lb__cap"></div>';
  document.body.appendChild(lb);

  var lbImg = lb.querySelector('img');
  var lbCap = lb.querySelector('.lb__cap');
  var lbX   = lb.querySelector('.lb__x');
  var last  = null;

  function open(fig) {
    var img = fig.querySelector('img');
    var cap = fig.querySelector('figcaption');
    if (!img) return;
    lbImg.src = img.currentSrc || img.src;
    lbImg.alt = img.alt || '';
    /* No figcaption means no caption: alt text is for assistive tech, not
       a visible fallback subtitle. */
    lbCap.textContent = cap ? cap.textContent : '';
    lb.hidden = false;
    document.body.style.overflow = 'hidden';
    last = fig;
    lbX.focus();
  }

  function close() {
    lb.hidden = true;
    lbImg.removeAttribute('src');
    document.body.style.overflow = '';
    if (last) { last.focus(); last = null; }
  }

  zoomables.forEach(function (fig) {
    fig.setAttribute('tabindex', '0');
    fig.setAttribute('role', 'button');
    fig.addEventListener('click', function () { open(fig); });
    fig.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(fig); }
    });
  });

  lb.addEventListener('click', close);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !lb.hidden) close();
  });
})();
