/**
 * Remplaçant vide de `@expo/ui` (Jetpack Compose) et `expo-symbols` sur Android.
 *
 * expo-router importe ces paquets pour sa barre d'outils et ses onglets natifs, que l'appli n'utilise pas.
 * Leur code natif (Compose, ~1 600 classes) et la police d'icônes Material (1 Mo) sont exclus de l'APK
 * (`expo.autolinking.exclude` dans package.json) ; ce module les remplace côté JavaScript : toute fonction
 * renvoie null (un composant qui n'affiche rien) au lieu de planter sur un module natif absent.
 * Voir metro.config.js.
 */
const nothing = () => null;
module.exports = new Proxy(
  {},
  {
    get: (_target, key) => (key === '__esModule' ? false : key === 'default' ? module.exports : nothing),
  },
);
