/**
 * Dynamic Expo config.
 * Dev-client exclusion: package.json `expo.autolinking` (scripts/configure-eas-autolinking.mjs
 * via eas-build-pre-install) and react-native.config.js for RN modules on SDK 54.
 */
const app = require('./app.json');

/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  expo: {
    ...app.expo,
  },
};
