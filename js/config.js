/* ==========================================================================
   FASESIF — Configuration

   1. APPS_SCRIPT_URL : collez ici l'URL de votre application Web Google
      Apps Script, obtenue après avoir déployé apps-script/Code.gs (voir
      README.md, section "Enregistrer les candidatures dans Google Drive
      / Sheets").

   2. APPS_SCRIPT_SECRET : recopiez EXACTEMENT la même valeur que la
      constante SHARED_SECRET définie en haut de apps-script/Code.gs.
      Ce n'est pas un vrai secret serveur (il est visible dans le code
      source du site), mais il bloque la quasi-totalité des robots qui
      spamment automatiquement les points de collecte Apps Script ouverts.

   Exemple :
   APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbx.../exec",
   APPS_SCRIPT_SECRET: "un-mot-de-passe-long-et-aleatoire-a-vous"
   ========================================================================== */

window.FASESIF_CONFIG = {
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbxkXHZz9eAqwylg3ThmXFBaC-g8yBrbsysXCSsvASrn5TyfDVpHS_osLLoZdXemiQzf3g/exec",
  APPS_SCRIPT_SECRET: "cle_test"
};
