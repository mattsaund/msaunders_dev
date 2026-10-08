/* GoDash hero screenshot carousel: arrows, dots, swipe, gentle autoplay.

   It loops. A copy of the last slide sits before the first and a copy of the
   first after the last, so stepping past either end slides one place onto the
   copy, like any other step, and then jumps without animation to the real
   slide it shows. Wrapping never runs back through the whole set. */
(function () {
  var root = document.getElementById('heroCarousel');
  if (!root) return;

  var track = root.querySelector('.carousel__track');
  var slides = Array.prototype.slice.call(root.querySelectorAll('.carousel__slide'));
  var dotsWrap = root.querySelector('.carousel__dots');
  var prev = root.querySelector('.carousel__arrow.prev');
  var next = root.querySelector('.carousel__arrow.next');
  if (!track || !slides.length) return;

  var count = slides.length;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // The two copies. Hidden from assistive tech: they repeat what is already there.
  function copy(slide) {
    var c = slide.cloneNode(true);
    c.setAttribute('aria-hidden', 'true');
    var img = c.querySelector('img');
    if (img) img.alt = '';
    return c;
  }
  track.insertBefore(copy(slides[count - 1]), slides[0]);
  track.appendChild(copy(slides[0]));

  // pos is the position on the track: 0 is the copy of the last slide, 1 to
  // count are the real slides, count + 1 is the copy of the first.
  var pos = 1;

  // Build one dot per real slide.
  var dots = slides.map(function (_, i) {
    var b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', 'Show screenshot ' + (i + 1));
    b.addEventListener('click', function () { settle(); moveTo(i + 1); });
    dotsWrap.appendChild(b);
    return b;
  });

  function render(animate) {
    if (!animate) track.style.transition = 'none';
    track.style.transform = 'translateX(' + (-pos * 100) + '%)';
    if (!animate) {
      void track.offsetWidth;          // commit the jump before transitions return
      track.style.transition = '';
    }
    var real = (pos - 1 + count) % count;
    dots.forEach(function (d, i) { d.classList.toggle('active', i === real); });
  }

  // From a copy, the real slide it shows.
  function settle() {
    if (pos === 0) { pos = count; render(false); }
    else if (pos === count + 1) { pos = 1; render(false); }
  }

  function moveTo(p) {
    if (reduceMotion) {
      // No animation, so nothing to hide: go straight to the real slide.
      pos = ((p - 1 + count) % count) + 1;
      render(false);
    } else {
      pos = p;
      render(true);
    }
    restart();
  }
  // Settle first: a fast second click can land mid-wrap, on a copy, and the
  // step has to count from the real slide or it runs off the end.
  function step(d) { settle(); moveTo(pos + d); }
  function nextSlide() { step(1); }
  function prevSlide() { step(-1); }

  track.addEventListener('transitionend', function (e) {
    if (e.target === track) settle();
  });

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

  render(false);
  start();
})();
