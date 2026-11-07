// Configuración de Metro: la de Expo, ignorando la carpeta de la app de escritorio
// (Electron y sus compilaciones no forman parte de la app móvil/web).
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const desktopBuild = /[/\\]desktop[/\\](node_modules|app|release)[/\\].*/;
config.resolver.blockList = [].concat(config.resolver.blockList || [], [desktopBuild]);

module.exports = config;
