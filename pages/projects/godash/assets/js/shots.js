/* GoDash | the "New in GoDash 3" photos.
   Each spot has a fixed file name (see index.html). Until that file exists the
   <img> fails to load and is removed, leaving the frame's placeholder showing,
   so adding a photo is only a matter of saving it under its name. */
(function () {
  document.querySelectorAll('.shot img').forEach(function (img) {
    function drop() { img.remove(); }
    if (img.complete && img.naturalWidth === 0) { drop(); return; }
    img.addEventListener('error', drop);
  });
})();
