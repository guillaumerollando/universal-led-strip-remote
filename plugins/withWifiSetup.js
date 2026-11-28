// Configurer une lumière Wi-Fi neuve (modules/led-strip-native/.../WifiSetup.kt) : voir les réseaux Wi-Fi autour et
// se connecter un instant à celui de la lumière. Doit rester en tête des plugins d'app.json : il passe ainsi après celui du
// Bluetooth, qui limite la localisation à Android 11.
// Voir les réseaux Wi-Fi exige la localisation sur toutes les versions d'Android, même 16 (« Appareils à proximité »
// ne suffit pas : refus « no location permission » vu sur le Redmi de Guillaume, 2026-11-28). Elle n'est demandée qu'à
// la recherche d'une lumière, et rien n'est localisé ni envoyé.
const { withAndroidManifest } = require('expo/config-plugins');

const LOCATION = ['android.permission.ACCESS_FINE_LOCATION', 'android.permission.ACCESS_COARSE_LOCATION'];
const NORMAL = ['android.permission.CHANGE_WIFI_STATE', 'android.permission.ACCESS_NETWORK_STATE', 'android.permission.CHANGE_NETWORK_STATE'];

module.exports = function withWifiSetup(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    for (const key of ['uses-permission', 'uses-permission-sdk-23']) {
      for (const p of manifest[key] ?? []) if (LOCATION.includes(p.$['android:name'])) delete p.$['android:maxSdkVersion'];
    }
    const list = (manifest['uses-permission'] ??= []);
    const has = (name) => list.some((p) => p.$['android:name'] === name);
    for (const name of NORMAL) if (!has(name)) list.push({ $: { 'android:name': name } });
    return cfg;
  });
};
