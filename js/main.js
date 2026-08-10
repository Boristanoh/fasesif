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

    nav.querySelectorAll("a").forEach((link) => {
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

  /* ---- Upload zones: show selected filename ---- */
  document.querySelectorAll("[data-upload]").forEach((zone) => {
    const input = zone.querySelector('input[type="file"]');
    const label = zone.querySelector("[data-upload-label]");
    const hint = zone.querySelector("[data-upload-hint]");
    if (!input) return;

    const defaultLabel = label ? label.textContent : "";
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
        if (label) label.textContent = file.name;
        if (hint) hint.textContent = "Fichier ajouté \u2713";
      } else {
        zone.classList.remove("has-file");
        if (label) label.textContent = defaultLabel;
        if (hint) hint.textContent = defaultHint;
      }
    });
  });

  /* ---- Contact form: lightweight client-side handling ---- */
  const contactForm = document.querySelector("[data-contact-form]");
  if (contactForm) {
    contactForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const feedback = contactForm.querySelector("[data-form-feedback]");
      if (feedback) {
        feedback.hidden = false;
        feedback.textContent = "Merci, votre message a bien été envoyé. Nous revenons vers vous sous 48h.";
      }
      contactForm.reset();
      contactForm.querySelectorAll(".has-file").forEach((z) => z.classList.remove("has-file"));
    });
  }

  /* ---- Simple candidature form (single step, candidature.html) ---- */
  const simpleForm = document.querySelector("[data-simple-candidature-form]");
  if (simpleForm) {
    simpleForm.addEventListener("submit", (e) => {
      e.preventDefault();
      window.location.href = "merci.html";
    });
  }
})();
