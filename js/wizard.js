/* ==========================================================================
   FASESIF — Dossier de candidature — multi-step wizard (start screen + N steps)

   La soumission finale envoie les données (+ fichiers en base64) à un script
   Google Apps Script déployé comme application Web, qui les enregistre dans
   une Google Sheet et téléverse les documents dans Google Drive. Aucun
   serveur propre n'est nécessaire — voir js/config.js et README.md.
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

  /* ---- Helpers: read a <input type="file"> as base64 ---- */
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // reader.result looks like "data:<mime>;base64,<data>" — strip the prefix
        const base64 = String(reader.result).split(",")[1] || "";
        resolve(base64);
      };
      reader.onerror = () => reject(new Error("Impossible de lire le fichier " + file.name));
      reader.readAsDataURL(file);
    });
  }

  async function buildCandidaturePayload(form) {
    const formData = new FormData(form);
    const payload = {
      formType: "candidature",
      secret: (window.FASESIF_CONFIG && window.FASESIF_CONFIG.APPS_SCRIPT_SECRET) || "",
      files: {},
    };

    // Generic: any <input type="file"> with a selected file is treated as a
    // document to upload, whatever its field name — this lets each category
    // page (étudiant, association, recherche, éloquence) define its own set
    // of documents without touching this file.
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        if (value.size > 0) {
          const base64 = await fileToBase64(value);
          payload.files[key] = { name: value.name, mimeType: value.type, data: base64 };
        }
      } else if (key !== "engagement") {
        payload[key] = value;
      }
    }

    return payload;
  }

  function getAppsScriptUrl() {
    return (window.FASESIF_CONFIG && window.FASESIF_CONFIG.APPS_SCRIPT_URL) || "";
  }

  /* Content-Type: text/plain avoids a CORS preflight (OPTIONS) request,
     which Google Apps Script Web Apps do not handle. The script itself
     reads the body as text and JSON.parse()s it — see apps-script/Code.gs */
  async function sendToAppsScript(payload) {
    const url = getAppsScriptUrl();
    if (!url) {
      throw new Error(
        "Le site n'est pas encore connecté à Google Sheets/Drive. " +
        "Configurez l'URL dans js/config.js (voir README.md)."
      );
    }
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    let json;
    try {
      json = await res.json();
    } catch (e) {
      throw new Error("Réponse inattendue du serveur.");
    }
    if (!json.success) {
      throw new Error(json.error || "Échec de l'enregistrement.");
    }
    return json;
  }

  /* ---- Final-step submission (with loading + error UI) ---- */
  const errorBox = document.querySelector("[data-submit-error]");

  function setSubmitLoading(btn, isLoading) {
    if (!btn) return;
    btn.disabled = isLoading;
    btn.classList.toggle("is-loading", isLoading);
    if (isLoading) {
      btn.dataset.originalHtml = btn.innerHTML;
      btn.innerHTML = '<span class="btn-spinner" aria-hidden="true"></span> Envoi en cours…';
    } else if (btn.dataset.originalHtml) {
      btn.innerHTML = btn.dataset.originalHtml;
    }
  }

  function showSubmitError(message) {
    if (errorBox) {
      errorBox.hidden = false;
      errorBox.textContent = message;
      errorBox.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      alert(message);
    }
  }

  function clearSubmitError() {
    if (errorBox) {
      errorBox.hidden = true;
      errorBox.textContent = "";
    }
  }

  document.querySelectorAll("[data-next-step]").forEach((btn) => {
    btn.addEventListener("click", async () => {
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
        clearSubmitError();
        showStep(current + 1);
        return;
      }

      // ---- Last step: real submission to Google Sheets/Drive ----
      clearSubmitError();
      const form = document.querySelector("[data-wizard-form]");
      const successScreen = document.querySelector("[data-success-screen]");
      const wizard = document.querySelector("[data-wizard]");

      setSubmitLoading(btn, true);
      try {
        const payload = await buildCandidaturePayload(form);
        await sendToAppsScript(payload);
        if (wizard && successScreen) {
          wizard.hidden = true;
          successScreen.hidden = false;
          successScreen.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      } catch (err) {
        showSubmitError(
          "Votre dossier n'a pas pu être envoyé : " + err.message +
          " Vos réponses sont conservées, vous pouvez réessayer."
        );
      } finally {
        setSubmitLoading(btn, false);
      }
    });
  });

  document.querySelectorAll("[data-prev-step]").forEach((btn) => {
    btn.addEventListener("click", () => {
      clearSubmitError();
      if (current > 0) showStep(current - 1);
    });
  });

  /* ---- Recap download (always available, works even offline) ---- */
  const downloadBtn = document.querySelector("[data-download-recap]");
  if (downloadBtn) {
    downloadBtn.addEventListener("click", () => {
      const form = document.querySelector("[data-wizard-form]");
      const data = form ? new FormData(form) : new FormData();
      const categorieLabel = form ? form.dataset.categorieLabel : "";
      let text = "GEEIF 3 · 2026 — Récapitulatif de candidature\n";
      if (categorieLabel) text += "Catégorie : " + categorieLabel + "\n";
      text += "03 octobre 2026 — Ritz Plazza, Bobigny\n\n";
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
