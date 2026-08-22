/* msaunders.dev : image lightbox */
(function () {
  'use strict';

  /* --- typed name ----------------------------------------- */
  /* The full name stays in the markup, so it is what ships in the HTML and
     what a screen reader announces via aria-label; the typing only controls
     what is painted. If this script never runs, the name is simply there. */
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
      var out = document.createElement('span');
      out.setAttribute('aria-hidden', 'true');
      name.textContent = '';
      name.appendChild(out);
      name.appendChild(caret);

      var i = 0;
      (function step() {
        out.textContent = full.slice(0, ++i);
        if (i < full.length) {
          /* Slight jitter so it reads as typing rather than a ticker. */
          setTimeout(step, 45 + Math.random() * 55);
        }
      })();
    }
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
    lbCap.textContent = cap ? cap.textContent : (img.alt || '');
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
