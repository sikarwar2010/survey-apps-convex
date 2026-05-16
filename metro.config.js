const { getDefaultConfig } = require("expo/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// convex package exports only define "import" and "require", not "react-native".
// Include those conditions so Metro can resolve subpaths like "convex/react".
config.resolver.unstable_conditionsByPlatform = {
  ios: ["react-native", "import", "require", "default"],
  android: ["react-native", "import", "require", "default"],
  web: ["browser", "import", "require", "default"],
};

const { withNativeWind } = require("nativewind/metro");

module.exports = withNativeWind(config, { input: "./global.css" });
