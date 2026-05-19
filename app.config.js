/**
 * Dynamic Expo config.
 * Preview/production APKs must NOT link expo-dev-client (crashes without Metro).
 * Only the "development" EAS profile includes the dev client.
 */
const app = require("./app.json");

const isDevClientBuild = process.env.EAS_BUILD_PROFILE === "development";

/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  expo: {
    ...app.expo,
    autolinking: {
      exclude: isDevClientBuild ? [] : ["expo-dev-client"],
    },
  },
};
