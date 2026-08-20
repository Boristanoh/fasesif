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

  /* ---- Human-readable labels for the PDF recap (mirrors Code.gs FIELD_LABELS) ---- */
  var RECAP_FIELD_LABELS = {
    prenom: "Prénom",
    nom: "Nom",
    nom_association: "Nom de l'association",
    email: "Email",
    telephone: "Téléphone",
    date_naissance: "Date de naissance",
    ville: "Ville",
    statut: "Statut",
    etablissement: "Établissement",
    type_etablissement: "Type d'établissement",
    filiere: "Filière",
    moyenne: "Moyenne",
    nombre_membres: "Nombre de membres",
    message: "Message additionnel",
    message_accompagnement: "Message d'accompagnement",
    discipline: "Discipline",
    date_soutenance: "Date de soutenance",
    lien_travaux: "Lien vers les travaux",
    sous_thematique: "Sous-thématique",
    sous_thematique_autre: "Sous-thématique (précisée)",
    resume_intervention: "Résumé de l'intervention",
    engagement_participation: "Engagement à participer",
    justificatif_scolarite: "Justificatif de scolarité",
    releve_notes: "Relevé de notes",
    justificatif_nationalite: "Justificatif de nationalité",
    activites_phares: "Activités phares (ZIP)",
    justificatifs_activites: "Justificatifs des activités",
    note_presentation: "Note de présentation",
    publications: "Publications / travaux",
    lettre_recommandation: "Lettre de recommandation",
    support_notes: "Support ou notes",
  };

  function recapLabel(key) {
    return RECAP_FIELD_LABELS[key] || String(key).replace(/_/g, " ");
  }

  /* ---- Recap download: nicely formatted PDF (falls back to plain text
     if the PDF library failed to load, e.g. no internet access) ---- */
  const downloadBtn = document.querySelector("[data-download-recap]");
  if (downloadBtn) {
    downloadBtn.addEventListener("click", () => {
      const form = document.querySelector("[data-wizard-form]");
      const data = form ? new FormData(form) : new FormData();
      const categorieLabel = (form && form.dataset.categorieLabel) || "";
      const fileNameBase =
        "recapitulatif-" + (categorieLabel || "candidature").toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

      const entries = [];
      for (const [key, value] of data.entries()) {
        if (["engagement", "website", "secret", "categorie", "categorie_label"].includes(key)) continue;
        if (value instanceof File) {
          if (value.name) entries.push([recapLabel(key), value.name]);
        } else if (value) {
          entries.push([recapLabel(key), String(value)]);
        }
      }

      if (window.jspdf && window.jspdf.jsPDF) {
        downloadRecapAsPdf(categorieLabel, entries, fileNameBase);
      } else {
        downloadRecapAsText(categorieLabel, entries, fileNameBase);
      }
    });
  }

  function downloadRecapAsPdf(categorieLabel, entries, fileNameBase) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 48;
    const contentWidth = pageWidth - marginX * 2;

    function drawHeader() {
      doc.setFillColor(113, 55, 0); // brand primary #713700
      doc.rect(0, 0, pageWidth, 92, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("FASESIF — GEEIF 3 · 2026", marginX, 38);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(12);
      doc.text("Récapitulatif de candidature", marginX, 58);
      if (categorieLabel) doc.text(categorieLabel, marginX, 76);
    }

    drawHeader();
    doc.setTextColor(28, 28, 24);
    let y = 130;

    entries.forEach(([label, value]) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      const labelLines = doc.splitTextToSize(label + " :", contentWidth);
      const valueLines = doc.splitTextToSize(value, contentWidth);
      const blockHeight = (labelLines.length + valueLines.length) * 13 + 10;

      if (y + blockHeight > pageHeight - 60) {
        doc.addPage();
        drawHeader();
        doc.setTextColor(28, 28, 24);
        y = 130;
      }

      doc.setFont("helvetica", "bold");
      doc.setTextColor(113, 55, 0);
      doc.text(labelLines, marginX, y);
      y += labelLines.length * 13;

      doc.setFont("helvetica", "normal");
      doc.setTextColor(28, 28, 24);
      doc.text(valueLines, marginX, y);
      y += valueLines.length * 13 + 10;
    });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(135, 115, 103);
    doc.text(
      "Généré le " + new Date().toLocaleString("fr-FR") + " — GEEIF 3, 03 octobre 2026, Ritz Plazza, Bobigny.",
      marginX,
      pageHeight - 30
    );

    doc.save(fileNameBase + ".pdf");
  }

  function downloadRecapAsText(categorieLabel, entries, fileNameBase) {
    let text = "GEEIF 3 · 2026 — Récapitulatif de candidature\n";
    if (categorieLabel) text += "Catégorie : " + categorieLabel + "\n";
    text += "03 octobre 2026 — Ritz Plazza, Bobigny\n\n";
    entries.forEach(([label, value]) => {
      text += label + " : " + value + "\n";
    });
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileNameBase + ".txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  showStep(0);
})();
