/* The copy button on the install lines, shared by the project pages.

   The command is in the markup, so it shows and can be selected with scripting
   off; this only adds the one-click copy. */
(function () {
  "use strict";

  /* The clipboard API needs a secure context, which a plain http preview on
     the LAN is not. The old textarea route still works there. */
  function copy(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (ok, fail) {
      var pad = document.createElement("textarea");
      pad.value = text;
      pad.setAttribute("readonly", "");
      /* Off screen, not hidden: a display:none field cannot be selected. */
      pad.style.cssText = "position:fixed;top:-100px;opacity:0";
      document.body.appendChild(pad);
      pad.select();
      var done = false;
      try { done = document.execCommand("copy"); } catch (err) { done = false; }
      document.body.removeChild(pad);
      done ? ok() : fail(new Error("copy refused"));
    });
  }

  document.querySelectorAll(".cmd__copy").forEach(function (btn) {
    var text = document.getElementById(btn.dataset.copy);
    var label = btn.querySelector(".cmd__copy-label");
    var note = document.getElementById(btn.dataset.note);
    var timer = 0;

    btn.addEventListener("click", function () {
      copy(text.textContent.trim()).then(function () {
        say("Copied", "Command copied to the clipboard");
      }, function () {
        /* Nothing was copied, so do not say it was. */
        say("Select it", "Copy failed. Select the command and copy it.");
      });
    });

    /* The label carries the result and the status line repeats it: swapping
       the label alone is silent unless the button happens to be focused. */
    function say(short, full) {
      label.textContent = short;
      btn.classList.add("is-said");
      if (note) note.textContent = full;
      clearTimeout(timer);
      timer = setTimeout(function () {
        label.textContent = "Copy";
        btn.classList.remove("is-said");
        if (note) note.textContent = "";
      }, 2000);
    }
  });
})();
