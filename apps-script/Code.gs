/**
 * ============================================================================
 * FASESIF — Réception des candidatures et messages de contact
 * ============================================================================
 *
 * Ce script reçoit les données envoyées par le site (candidature.html et
 * contact.html), les enregistre dans cette Google Sheet, et téléverse les
 * documents (CV, relevé de notes, justificatif d'identité) dans un dossier
 * Google Drive dédié à chaque candidat.
 *
 * INSTALLATION — voir le guide pas à pas dans README.md ("Enregistrer les
 * candidatures dans Google Drive / Sheets"). En résumé :
 *   1. Créez une Google Sheet vide.
 *   2. Extensions → Apps Script, effacez le contenu par défaut, collez tout
 *      ce fichier.
 *   3. Remplacez la valeur de SHARED_SECRET ci-dessous par une chaîne
 *      aléatoire longue à vous (voir le commentaire juste au-dessus de la
 *      variable), et reportez EXACTEMENT la même valeur dans js/config.js.
 *   4. Déployer → Nouveau déploiement → type "Application Web"
 *        - Exécuter en tant que : Moi
 *        - Qui a accès : Tout le monde
 *   5. Copiez l'URL fournie et collez-la dans js/config.js.
 *
 * Aucune autre configuration n'est nécessaire : le script crée lui-même le
 * dossier Drive et les en-têtes de colonnes au premier envoi.
 * ============================================================================
 */

var CANDIDATURES_SHEET_PREFIX = 'Candidatures — ';
var CONTACTS_SHEET = 'Messages de contact';
var DRIVE_FOLDER_NAME = 'FASESIF - Dossiers de candidature';

var MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 Mo par fichier, marge au-delà des 2 Mo annoncés côté site
var REQUIRED_CONTACT_FIELDS = ['nom', 'email', 'objet', 'message'];

function doPost(e) {
  var result;
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error('Aucune donnée reçue.');
    }

    var data = JSON.parse(e.postData.contents);

    if (!SHARED_SECRET || data.secret !== SHARED_SECRET) {
      throw new Error('Accès refusé.');
    }

    // Simple anti-spam: a hidden "website" field that must stay empty.
    if (data.website) {
      return jsonResponse({ success: true }); // silently ignore bots
    }

    if (data.formType === 'candidature') {
      assertCandidatureIsUsable(data);
      assertFileSizes(data);
      result = saveCandidature(data);
    } else if (data.formType === 'contact') {
      assertRequiredFields(data, REQUIRED_CONTACT_FIELDS);
      result = saveContactMessage(data);
    } else {
      throw new Error('Type de formulaire inconnu.');
    }

    return jsonResponse({ success: true, result: result });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

function assertRequiredFields(data, fields) {
  var missing = fields.filter(function (key) {
    return !data[key] || String(data[key]).trim() === '';
  });
  if (missing.length) {
    throw new Error('Champs manquants : ' + missing.join(', '));
  }
}

/**
 * Validation générique valable pour les 4 catégories du GEEIF (étudiant,
 * association, recherche, éloquence) sans code spécifique à chacune :
 * il faut un email, une catégorie, et au moins un champ d'identité
 * (prénom/nom pour une personne, ou nom_association pour une association).
 */
function assertCandidatureIsUsable(data) {
  if (!data.categorie || String(data.categorie).trim() === '') {
    throw new Error('Catégorie manquante.');
  }
  if (!data.email || String(data.email).trim() === '') {
    throw new Error('Email manquant.');
  }
  var hasIdentity = (data.prenom && data.nom) || data.nom_association;
  if (!hasIdentity) {
    throw new Error('Informations d\'identité manquantes.');
  }
}

function assertFileSizes(data) {
  if (!data.files) return;
  Object.keys(data.files).forEach(function (key) {
    var f = data.files[key];
    if (f && f.data) {
      // base64 length ≈ bytes * 4/3
      var approxBytes = (f.data.length * 3) / 4;
      if (approxBytes > MAX_FILE_BYTES) {
        throw new Error('Le fichier "' + (f.name || key) + '" dépasse la taille maximale autorisée.');
      }
    }
  });
}

/* ---------------------------------------------------------------------- */

/**
 * Enregistre une candidature quelle que soit sa catégorie (étudiant,
 * association, recherche, éloquence...). Chaque catégorie a son propre
 * onglet ("Candidatures — <Catégorie>"), avec des colonnes génériques :
 * l'ensemble des champs spécifiques à la catégorie est conservé sous forme
 * lisible dans la colonne "Détails". Ajouter une 5e catégorie plus tard ne
 * nécessite donc AUCUNE modification de ce script.
 */
function saveCandidature(data) {
  var rootFolder = getOrCreateFolder(DRIVE_FOLDER_NAME);
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HH-mm-ss');
  var identity = data.nom_association
    ? safe(data.nom_association)
    : (safe(data.prenom) + ' ' + safe(data.nom)).trim();
  var folderName = stamp + ' — ' + safe(data.categorie_label || data.categorie) + ' — ' + (identity || 'Candidat');
  var candidateFolder = rootFolder.createFolder(folderName);

  var fileLinks = {};
  if (data.files) {
    Object.keys(data.files).forEach(function (key) {
      var f = data.files[key];
      if (f && f.data) {
        var blob = Utilities.newBlob(Utilities.base64Decode(f.data), f.mimeType || 'application/octet-stream', f.name || key);
        var file = candidateFolder.createFile(blob);
        fileLinks[key] = file.getUrl();
      }
    });
  }

  var sheetName = CANDIDATURES_SHEET_PREFIX + (data.categorie_label || data.categorie);
  var sheet = getOrCreateSheet(sheetName);
  ensureHeader(sheet, ['Horodatage', 'Identité / Contact', 'Email', 'Téléphone', 'Détails', 'Documents', 'Dossier Drive']);

  sheet.appendRow([
    new Date(),
    identity,
    safe(data.email),
    safe(data.telephone),
    formatDetails(data),
    formatFileLinks(fileLinks),
    candidateFolder.getUrl()
  ]);

  return { folderUrl: candidateFolder.getUrl() };
}

/**
 * Transforme tous les champs "métier" (hors champs techniques) en texte
 * lisible sur plusieurs lignes pour la colonne "Détails" de la Sheet.
 */
function formatDetails(data) {
  var excluded = ['formType', 'secret', 'website', 'files', 'categorie', 'categorie_label',
    'prenom', 'nom', 'nom_association', 'email', 'telephone'];
  var lines = [];
  Object.keys(data).forEach(function (key) {
    if (excluded.indexOf(key) === -1 && data[key] !== '' && data[key] !== undefined && data[key] !== null) {
      lines.push(humanizeKey(key) + ' : ' + data[key]);
    }
  });
  return lines.join('\n');
}

function formatFileLinks(fileLinks) {
  return Object.keys(fileLinks).map(function (key) {
    return humanizeKey(key) + ' : ' + fileLinks[key];
  }).join('\n');
}

function humanizeKey(key) {
  return String(key).replace(/_/g, ' ');
}

function saveContactMessage(data) {
  var sheet = getOrCreateSheet(CONTACTS_SHEET);
  ensureHeader(sheet, ['Horodatage', 'Nom', 'Email', 'Objet', 'Message']);
  sheet.appendRow([
    new Date(), safe(data.nom), safe(data.email), safe(data.objet), safe(data.message)
  ]);
  return {};
}

/* ---------------------------------------------------------------------- */

function getOrCreateFolder(name) {
  var folders = DriveApp.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(name);
}

function getOrCreateSheet(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    var files = DriveApp.getFilesByName('FASESIF - Réponses');
    ss = files.hasNext() ? SpreadsheetApp.open(files.next()) : SpreadsheetApp.create('FASESIF - Réponses');
  }
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

function ensureHeader(sheet, headerRow) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headerRow);
    sheet.getRange(1, 1, 1, headerRow.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
}

function safe(value) {
  return value === undefined || value === null ? '' : String(value);
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Utilitaire facultatif : exécutez cette fonction une fois manuellement
 * depuis l'éditeur Apps Script (bouton ▷ en haut) pour vérifier que le
 * script a bien les autorisations Drive/Sheets nécessaires avant le
 * premier déploiement.
 */
function testSetup() {
  var folder = getOrCreateFolder(DRIVE_FOLDER_NAME);
  var sheet = getOrCreateSheet(CANDIDATURES_SHEET_PREFIX + 'Test');
  Logger.log('Dossier Drive prêt : ' + folder.getUrl());
  Logger.log('Feuille prête : ' + sheet.getSheetId());
}
