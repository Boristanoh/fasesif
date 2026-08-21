/* ==========================================================================
   FASESIF — Shared behaviour (nav, accordion, uploads, header state)
   ========================================================================== */

(function () {
  "use strict";

  /* ---- Mobile nav toggle ---- */
  const toggle = document.querySelector("[data-nav-toggle]");
  const nav = document.querySelector("[data-nav]");

  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const isOpen = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(isOpen));
    });

    nav.querySelectorAll("a, button").forEach((link) => {
      link.addEventListener("click", () => {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ---- FAQ accordion ---- */
  document.querySelectorAll("[data-accordion-item]").forEach((item) => {
    const trigger = item.querySelector("[data-accordion-trigger]");
    const panel = item.querySelector("[data-accordion-panel]");
    if (!trigger || !panel) return;

    trigger.addEventListener("click", () => {
      const isOpen = item.classList.contains("is-open");

      document.querySelectorAll("[data-accordion-item].is-open").forEach((openItem) => {
        if (openItem !== item) {
          openItem.classList.remove("is-open");
          openItem.querySelector("[data-accordion-panel]").style.maxHeight = null;
        }
      });

      item.classList.toggle("is-open", !isOpen);
      panel.style.maxHeight = !isOpen ? panel.scrollHeight + "px" : null;
    });
  });

  /* ---- Upload zones: show selected filename WITHOUT losing the
     original "what is requested" title ---- */
  document.querySelectorAll("[data-upload]").forEach((zone) => {
    const input = zone.querySelector('input[type="file"]');
    const hint = zone.querySelector("[data-upload-hint]");
    if (!input) return;

    const defaultHint = hint ? hint.textContent : "";

    zone.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        input.click();
      }
    });

    input.addEventListener("change", () => {
      if (input.files && input.files.length > 0) {
        const file = input.files[0];
        zone.classList.add("has-file");
        // The label (what document is requested) is left untouched on
        // purpose — only the hint line shows which file was picked, so
        // the candidate never loses track of what was asked for.
        if (hint) hint.textContent = "\u2713 " + file.name;
      } else {
        zone.classList.remove("has-file");
        if (hint) hint.textContent = defaultHint;
      }
    });
  });

  /* ---- Conditional "Autre" fields: a <select> with data-reveals="ID"
     shows/requires the field #ID only when its value is "autre". Reusable
     anywhere a category needs a free-text alternative to its options. ---- */
  document.querySelectorAll("[data-reveals]").forEach((select) => {
    const target = document.getElementById(select.getAttribute("data-reveals"));
    if (!target) return;
    const input = target.querySelector("input, textarea");

    function sync() {
      const show = select.value === "autre";
      target.hidden = !show;
      if (input) {
        input.required = show;
        if (!show) input.value = "";
      }
    }

    select.addEventListener("change", sync);
    sync();
  });

  /* ---- Contact form: send to Google Sheets via Apps Script (see config.js) ---- */
  const contactForm = document.querySelector("[data-contact-form]");
  if (contactForm) {
    contactForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const feedback = contactForm.querySelector("[data-form-feedback]");
      const submitBtn = contactForm.querySelector('button[type="submit"]');
      const url = (window.FASESIF_CONFIG && window.FASESIF_CONFIG.APPS_SCRIPT_URL) || "";

      if (feedback) {
        feedback.hidden = false;
        feedback.style.color = "";
      }

      if (!url) {
        if (feedback) {
          feedback.style.color = "var(--color-error)";
          feedback.textContent = "Erreur lors de l'envoi de la candidature. Veuillez réessayer s'il vous plaît.";
        }
        return;
      }

      const formData = new FormData(contactForm);
      const payload = {
        formType: "contact",
        secret: (window.FASESIF_CONFIG && window.FASESIF_CONFIG.APPS_SCRIPT_SECRET) || "",
      };
      formData.forEach((value, key) => {
        payload[key] = value;
      });

      const originalBtnText = submitBtn ? submitBtn.innerHTML : "";
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="btn-spinner" aria-hidden="true"></span> Envoi en cours…';
      }

      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || "Échec de l'envoi.");

        if (feedback) feedback.textContent = "Merci, votre message a bien été envoyé. Nous revenons vers vous sous 48h.";
        contactForm.reset();
      } catch (err) {
        if (feedback) {
          feedback.style.color = "var(--color-error)";
          feedback.textContent = "Votre message n'a pas pu être envoyé (" + err.message + "). Réessayez ou écrivez-nous directement par email.";
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnText;
        }
      }
    });
  }

  /* ---- Simple candidature form (legacy single-step forms, if any) ---- */
  const simpleForm = document.querySelector("[data-simple-candidature-form]");
  if (simpleForm) {
    simpleForm.addEventListener("submit", (e) => {
      e.preventDefault();
      window.location.href = "candidature.html";
    });
  }
})();
