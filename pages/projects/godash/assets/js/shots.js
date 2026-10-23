/* GoDash | the "New in GoDash 3" photos.
   Each spot has a fixed file name (see index.html). Until that file exists the
   <img> fails to load and is removed, leaving the frame's placeholder showing,
   so adding a photo is only a matter of saving it under its name. The
   placeholder is hidden from screen readers while a photo covers it, and read
   out once it is all the frame holds. */
(function () {
  document.querySelectorAll('.shot img').forEach(function (img) {
    function drop() {
      var empty = img.closest('.shot').querySelector('.shot__empty');
      if (empty) empty.removeAttribute('aria-hidden');
      img.remove();
    }
    if (img.complete && img.naturalWidth === 0) { drop(); return; }
    img.addEventListener('error', drop);
  });
})();
