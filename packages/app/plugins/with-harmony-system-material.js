const { HarmonyManifest, withModuleJson } = require("@expo-harmony/config-plugins");

/**
 * Application-level switch for the immersive system material, written into the entry module's
 * `module.json5` metadata. `uiMaterial.getMaterialInfo().state` reports what ArkUI resolved from
 * it, and `packages/app/modules/paseo-unistyles/.../MaterialView.ets` logs that state on every
 * material change — `hdc hilog | grep PaseoMaterial` is how you check that this key was read.
 *
 * The key name comes from Huawei's "开启沉浸光感" documentation; it does not appear anywhere in the
 * SDK's declaration files, so it is the one string here that the toolchain cannot confirm.
 * Component-level `systemMaterial()` still works when the application step is DISABLE, it just
 * never upgrades the effect to the "immersive" strength.
 */
const SYSTEM_MATERIAL_STATE = "enable";
const SYSTEM_MATERIAL_METADATA_NAME = "ohos.arkui.UIMaterial.state";

function withHarmonySystemMaterial(config) {
  return withModuleJson(config, (mod) => {
    const module = HarmonyManifest.getModuleOrThrow(mod.modResults);
    HarmonyManifest.setMetadata(module, {
      name: SYSTEM_MATERIAL_METADATA_NAME,
      value: SYSTEM_MATERIAL_STATE,
    });
    return mod;
  });
}

module.exports = withHarmonySystemMaterial;
