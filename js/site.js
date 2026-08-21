/* msaunders.dev : nav toggle, scroll reveal, image lightbox */
(function () {
  'use strict';

  /* --- mobile nav ----------------------------------------- */
  var toggle = document.querySelector('.nav__toggle');
  var links  = document.getElementById('nav-links');

  function setNav(open) {
    if (!toggle || !links) return;
    toggle.setAttribute('aria-expanded', String(open));
    links.hidden = !open;
  }

  function syncNav() {
    if (!links) return;
    if (window.innerWidth > 720) { links.hidden = false; if (toggle) toggle.setAttribute('aria-expanded', 'false'); }
    else if (toggle && toggle.getAttribute('aria-expanded') !== 'true') { links.hidden = true; }
  }

  if (toggle && links) {
    toggle.addEventListener('click', function () {
      setNav(toggle.getAttribute('aria-expanded') !== 'true');
    });
    window.addEventListener('resize', syncNav);
    syncNav();
  }

  /* --- scroll reveal -------------------------------------- */
  var targets = document.querySelectorAll('.rv');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!targets.length) { /* nothing to do */ }
  else if (reduced || !('IntersectionObserver' in window)) {
    targets.forEach(function (el) { el.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    targets.forEach(function (el) { io.observe(el); });
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
