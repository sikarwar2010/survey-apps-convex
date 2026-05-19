const { getDefaultConfig } = require("@expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const expoConfig = getDefaultConfig(__dirname);
const expoTransformer = expoConfig.transformer ?? {};

const config = withNativeWind(expoConfig, { input: "./global.css" });

// NativeWind's wrap drops Expo's marker; EAS CLI uses it to detect a valid Metro setup.
config.transformer = {
  ...config.transformer,
  ...("_expoRelativeProjectRoot" in expoTransformer
    ? { _expoRelativeProjectRoot: expoTransformer._expoRelativeProjectRoot }
    : {}),
};

// convex package exports only define "import" and "require", not "react-native".
config.resolver.unstable_conditionsByPlatform = {
  ios: ["react-native", "import", "require", "default"],
  android: ["react-native", "import", "require", "default"],
  web: ["browser", "import", "require", "default"],
};

module.exports = config;
