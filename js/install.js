/* The copy button on the install line, shared by the project pages.

   The command itself lives in the markup, so the page still shows it with
   scripting off; all this adds is the one-click copy. Nothing here is
   page-specific, so Crucible and tiny load the same file. */
(function () {
  "use strict";

  /* Clipboard access needs a secure context, which rules it out on plain
     http (a LAN preview, say). The textarea route is the old way and still
     works there, so it stands in rather than leaving the button dead. */
  function copy(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (ok, fail) {
      var pad = document.createElement("textarea");
      pad.value = text;
      pad.setAttribute("readonly", "");
      /* Off screen rather than hidden: a display:none field cannot be
         selected, and selecting is what the copy acts on. */
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
        /* Nothing was copied, so do not claim it was. The command is on
           screen and selectable either way. */
        say("Select it", "Copy failed. Select the command and copy it.");
      });
    });

    /* The button's own label carries the result, and the status line repeats
       it for a screen reader: swapping the label alone is silent unless the
       button happens to be focused. */
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
