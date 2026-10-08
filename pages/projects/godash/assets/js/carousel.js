/* GoDash hero screenshot carousel: arrows, dots, swipe, gentle autoplay. */
(function () {
  var root = document.getElementById('heroCarousel');
  if (!root) return;

  var track = root.querySelector('.carousel-track');
  var slides = Array.prototype.slice.call(root.querySelectorAll('.carousel-slide'));
  var dotsWrap = root.querySelector('.carousel-dots');
  var prev = root.querySelector('.carousel-arrow.prev');
  var next = root.querySelector('.carousel-arrow.next');
  if (!track || !slides.length) return;

  var index = 0;
  var count = slides.length;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Build one dot per slide.
  var dots = slides.map(function (_, i) {
    var b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', 'Show screenshot ' + (i + 1));
    b.addEventListener('click', function () { go(i); });
    dotsWrap.appendChild(b);
    return b;
  });

  function update() {
    track.style.transform = 'translateX(' + (-index * 100) + '%)';
    dots.forEach(function (d, i) { d.classList.toggle('active', i === index); });
  }
  function go(i) { index = (i + count) % count; update(); restart(); }
  function nextSlide() { go(index + 1); }
  function prevSlide() { go(index - 1); }

  next.addEventListener('click', nextSlide);
  prev.addEventListener('click', prevSlide);

  // Arrow keys when the carousel has focus.
  root.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') { e.preventDefault(); nextSlide(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); prevSlide(); }
  });

  // Touch swipe.
  var startX = null;
  root.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; }, { passive: true });
  root.addEventListener('touchend', function (e) {
    if (startX === null) return;
    var dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 40) { dx < 0 ? nextSlide() : prevSlide(); }
    startX = null;
  });

  // Gentle autoplay, paused on hover and disabled for reduced motion.
  var timer = null;
  function start() { if (reduceMotion) return; stop(); timer = setInterval(nextSlide, 9000); }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }
  function restart() { if (timer) { stop(); start(); } }
  root.addEventListener('mouseenter', stop);
  root.addEventListener('mouseleave', start);

  update();
  start();
})();
