// Version plus légère : l'appli n'affiche ni GIF ni image WebP (Fresco). Sans ces décodeurs, l'APK perd
// libgifimage.so et libstatic-webp.so (~0,8 Mo par architecture). Les icônes WebP du lanceur ne passent
// pas par Fresco : Android les décode lui-même.
const { withGradleProperties } = require('expo/config-plugins');

const SET = { 'expo.gif.enabled': 'false', 'expo.webp.enabled': 'false', 'expo.webp.animated': 'false' };

module.exports = function withLeanImages(config) {
  return withGradleProperties(config, (cfg) => {
    for (const [key, value] of Object.entries(SET)) {
      const item = cfg.modResults.find((p) => p.type === 'property' && p.key === key);
      if (item) item.value = value;
      else cfg.modResults.push({ type: 'property', key, value });
    }
    return cfg;
  });
};
