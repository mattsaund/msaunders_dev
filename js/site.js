/* msaunders.dev : page behavior.

   Three small jobs, all presentation: the typed name in the hero, folding the
   detail lists on a phone, and a lightbox for anything marked [data-zoom].
   None of it is needed to read the page. */
(function () {
  'use strict';

  /* --- typed name ----------------------------------------- */
  /* Opens on the domain, holds, backspaces it, then types the name. The
     finished name is what sits in the markup and what a screen reader gets
     through aria-label, so if this never runs the name is simply there. */
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

      /* The dot takes the accent, so the intro is painted as markup. INTRO is
         a literal with no markup characters in it, so composing it this way is
         safe. */
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
  /* The lists ship open, so the page reads whole without this script. On a
     phone they are most of its height, so they start folded and the summary
     becomes the tap target.

     The query matches the phone layout in css/site.css, so change the two
     together. Read on load and then only when it flips, never on every resize,
     or a list the reader opened would close under them. */
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
