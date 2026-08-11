/* ==========================================================================
   FASESIF — Dossier de candidature — multi-step wizard (start screen + N steps)
   ========================================================================== */

(function () {
  "use strict";

  /* ---- Intro → wizard handoff ---- */
  const introScreen = document.querySelector("[data-intro-screen]");
  const wizardEl = document.querySelector("[data-wizard]");

  document.querySelectorAll("[data-start-wizard]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      if (!wizardEl) return; // no wizard on this page, let the link behave normally
      e.preventDefault();
      if (introScreen) introScreen.hidden = true;
      wizardEl.hidden = false;
      wizardEl.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  const steps = Array.from(document.querySelectorAll("[data-step-panel]"));
  const stepperItems = Array.from(document.querySelectorAll("[data-stepper-step]"));
  const lines = Array.from(document.querySelectorAll("[data-stepper-line]"));
  if (steps.length === 0) return;

  let current = 0;

  function renderStepper() {
    stepperItems.forEach((item, i) => {
      item.classList.remove("is-active", "is-done");
      const number = item.querySelector("[data-step-number]");
      const check = item.querySelector("[data-step-check]");
      if (i < current) {
        item.classList.add("is-done");
        if (number) number.hidden = true;
        if (check) check.hidden = false;
      } else {
        if (i === current) item.classList.add("is-active");
        if (number) number.hidden = false;
        if (check) check.hidden = true;
      }
    });
    lines.forEach((line, i) => {
      line.style.background = i < current ? "var(--color-secondary)" : "var(--color-outline-variant)";
    });
  }

  const headingEl = document.querySelector("[data-step-heading]");
  const subheadingEl = document.querySelector("[data-step-subheading]");

  function showStep(index) {
    steps.forEach((panel, i) => {
      panel.hidden = i !== index;
    });
    current = index;
    renderStepper();

    const panel = steps[index];
    if (panel) {
      if (headingEl && panel.dataset.title) headingEl.textContent = panel.dataset.title;
      if (subheadingEl && panel.dataset.subtitle) subheadingEl.textContent = panel.dataset.subtitle;
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  document.querySelectorAll("[data-next-step]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const panel = steps[current];
      const requiredFields = panel.querySelectorAll("[required]");
      let valid = true;
      requiredFields.forEach((field) => {
        if (!field.checkValidity()) {
          valid = false;
          field.reportValidity();
        }
      });
      if (!valid) return;

      if (current < steps.length - 1) {
        showStep(current + 1);
      } else {
        // final submit
        const successScreen = document.querySelector("[data-success-screen]");
        const wizard = document.querySelector("[data-wizard]");
        if (wizard && successScreen) {
          wizard.hidden = true;
          successScreen.hidden = false;
          successScreen.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    });
  });

  document.querySelectorAll("[data-prev-step]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (current > 0) showStep(current - 1);
    });
  });

  /* ---- Recap download (client-side, no backend) ---- */
  const downloadBtn = document.querySelector("[data-download-recap]");
  if (downloadBtn) {
    downloadBtn.addEventListener("click", () => {
      const form = document.querySelector("[data-wizard-form]");
      const data = form ? new FormData(form) : new FormData();
      let text = "GALA IVOIRE — Récapitulatif de candidature\n";
      text += "Édition du 03 octobre 2026 — Paris\n\n";
      for (const [key, value] of data.entries()) {
        if (value instanceof File) {
          if (value.name) text += `${key}: ${value.name}\n`;
        } else if (value) {
          text += `${key}: ${value}\n`;
        }
      }
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "recapitulatif-candidature-gala-ivoire.txt";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  showStep(0);
})();
