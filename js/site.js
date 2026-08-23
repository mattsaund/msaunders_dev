/* msaunders.dev : image lightbox */
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

  /* --- section label travel --------------------------------- */
  /* A sticky label is bounded by its grid area, which runs to the bottom of the
     list beside it. That lets the label drift past the last entry's title and
     come to rest level with a tag row or a stray line of body copy. Shortening
     the area with a bottom margin stops it level with that title instead.

     The tail below the last title differs per section, so it has to be measured.
     This is presentation only: with no JS the label simply travels the whole
     section, which is what it did before. Below the split's breakpoint the label
     is its own grid row, where a bottom margin would push the content down, so
     the margin is cleared there. */
  var wide = window.matchMedia('(min-width: 861px)');

  function labelStops() {
    var secs = document.querySelectorAll('.section--rail');
    for (var i = 0; i < secs.length; i++) {
      var label = secs[i].querySelector('.split__label');
      var list = secs[i].querySelector('.tl');
      if (!label || !list) continue;

      label.style.marginBottom = '';
      if (!wide.matches) continue;

      var items = list.querySelectorAll('.tl__item');
      if (!items.length) continue;

      var eyebrow = label.querySelector('.eyebrow');
      if (!eyebrow) continue;

      /* Measure against the column beside the label, not the list inside it:
         the last li's bottom margin escapes the ol, so the list ends ~7px above
         the grid area that actually bounds the sticky label. */
      var col = label.nextElementSibling;
      if (!col) continue;

      /* Aim at the line the rail's notch sits on, not the middle of the title's
         box. Read it off the notch itself: an unregistered custom property comes
         back as its raw calc() text, but a pseudo-element's top resolves to px. */
      var last = items[items.length - 1];
      var title = last.querySelector('.tl__what');
      if (!title) continue;

      var mid = parseFloat(getComputedStyle(last, '::after').top);
      if (!isFinite(mid)) mid = title.getBoundingClientRect().height / 2;

      var r = title.getBoundingClientRect();
      var tail = col.getBoundingClientRect().bottom - (r.top + mid);

      /* The margin stops the label's BOX at the target line, but what should
         land there is the label's text, which sits above the box's bottom edge
         by its own trailing margin. Take that offset back off. */
      var lab = label.getBoundingClientRect();
      var eb = eyebrow.getBoundingClientRect();
      var inset = lab.bottom - (eb.top + mid);

      var stop = tail - inset;
      if (stop > 0) label.style.marginBottom = Math.round(stop) + 'px';
    }
  }

  labelStops();

  var reflow;
  window.addEventListener('resize', function () {
    clearTimeout(reflow);
    reflow = setTimeout(labelStops, 120);
  });

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
