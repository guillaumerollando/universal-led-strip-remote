// Configuration Metro : celle d'Expo, plus un remplaçant vide pour deux paquets inutiles sur Android
// (voir stubs/native-ui-absent.js) — l'appli publiée y gagne la place de Jetpack Compose et d'une police d'icônes.
// expo-glass-effect, exclu lui aussi de l'autolinking (package.json), n'a pas besoin de remplaçant : sa partie JS
// se passe de son module natif absent (effet de verre réservé à iOS).
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);
const STUB = path.resolve(__dirname, 'stubs/native-ui-absent.js');
const ABSENT = /^(@expo\/ui(\/.*)?|expo-symbols(\/.*)?)$/;

const upstream = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'android' && ABSENT.test(moduleName)) return { type: 'sourceFile', filePath: STUB };
  return (upstream ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
