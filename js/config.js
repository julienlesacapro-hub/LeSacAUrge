/* LeSacAUrge - configuration
   Renseignez ici l'adresse de votre base Firebase Realtime Database pour qu'elle
   soit pre-remplie sur tous vos appareils (facultatif : elle peut aussi etre
   saisie dans les reglages de l'application).
   ©2026 LESACA Julien - Tous droits reserves. */
window.LSAU_CONFIG = {
  version: '1.2.0',
  firebaseDatabaseUrl: 'https://lesacaurge-default-rtdb.europe-west1.firebasedatabase.app',
  // Verification orthographique et grammaticale (LanguageTool) : remplacer par
  // l'adresse d'un serveur auto-heberge pour que le texte reste dans votre reseau.
  languageToolUrl: 'https://api.languagetool.org/v2/check',
  // API de transcription (moteur « API » de la dictee), cle saisie dans les reglages
  cloud: {
    mistral: { endpoint: 'https://api.mistral.ai/v1/audio/transcriptions', model: 'voxtral-mini-latest' },
    openai: { endpoint: 'https://api.openai.com/v1/audio/transcriptions', model: 'whisper-1' }
  }
};
