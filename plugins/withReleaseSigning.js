// Signature des builds de publication avec la clé d'envoi (upload key) de l'appli, sans jamais mettre de secret dans git.
// Les variables viennent de ~/Dev/Utils/keystore/led-strip-remote-upload.env (`source` avant `./gradlew bundleRelease`).
// Sans ces variables (machine sans la clé), le build de publication reste signé avec la clé de debug.
const { withAppBuildGradle } = require('expo/config-plugins');

const SIGNING = `
        release {
            if (System.getenv('LSR_UPLOAD_STORE_FILE')) {
                storeFile file(System.getenv('LSR_UPLOAD_STORE_FILE'))
                storePassword System.getenv('LSR_UPLOAD_STORE_PASSWORD')
                keyAlias System.getenv('LSR_UPLOAD_KEY_ALIAS')
                keyPassword System.getenv('LSR_UPLOAD_KEY_PASSWORD')
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;
    if (!gradle.includes('LSR_UPLOAD_STORE_FILE')) {
      // Ajoute la configuration « release » juste après la configuration « debug ».
      gradle = gradle.replace(/(signingConfigs \{\s*debug \{[^}]*\})/, `$1${SIGNING}`);
      // Le type de build « release » l'utilise quand la clé est disponible.
      gradle = gradle.replace(
        /(release \{\s*\/\/ Caution![^\n]*\n[^\n]*\n\s*)signingConfig signingConfigs\.debug/,
        "$1signingConfig System.getenv('LSR_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug",
      );
    }
    cfg.modResults.contents = gradle;
    return cfg;
  });
};
