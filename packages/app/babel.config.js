module.exports = function (api) {
  const isHarmony = api.cache.using(() => process.env.EXPO_METRO_TARGET === "harmony");

  const expoPreset = [
    "babel-preset-expo",
    {
      // Transform `import.meta` for ALL platforms (web + native)
      // Required for modern ESM deps like Zustand 5 that use import.meta.env
      unstable_transformImportMeta: true,
      ...(isHarmony ? { worklets: false, reanimated: false } : {}),
    },
  ];

  return {
    presets: [expoPreset],
    plugins: [
      // The hoisted Expo preset cannot discover the workspace-local router.
      require("babel-preset-expo/build/expo-router-plugin").expoRouterBabelPlugin,
      [
        "react-native-unistyles/plugin",
        {
          root: "src",
        },
      ],
      ...(isHarmony
        ? [
            require.resolve("react-native-worklets/plugin", {
              paths: [
                require("node:path").dirname(
                  require.resolve("@react-native-ohos/react-native-worklets/package.json"),
                ),
              ],
            }),
          ]
        : []),
    ],
  };
};
