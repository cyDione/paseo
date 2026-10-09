#include "GlassStackNode.h"

#include <dlfcn.h>

#include <atomic>
#include <iomanip>
#include <sstream>
#include <string>

#include "RNOH/arkui/NativeNodeApi.h"
#include "glog/logging.h"

namespace rnoh {
namespace paseo_glass {

namespace {

// Backdrop blur radius for the fill every glass view carries. NODE_BACKDROP_BLUR takes px, not
// vp; 24px is a starting point to tune on a real device.
constexpr float kBackdropBlurRadiusPx = 24.0f;

// Diagnostic-only (its JS counterpart is GLASS_DIAGNOSTIC_TINTS in glass-layer.harmony.tsx, and
// docs/harmony.md explains both): with this on, a degraded layer mixes an orange cast into its
// fill so a device test can tell "system material applied" from "fell back to the tinted blur" on
// sight. Set both to false once the material is verified on a device.
constexpr bool kDiagnosticTintOnDegrade = true;
// 0xAARRGGBB like every color here: orange at 0x33 alpha, composited over the material color.
constexpr uint32_t kDiagnosticTint = 0x33FF8800;

/// Alpha-composites a 0xAARRGGBB overlay over a 0xAARRGGBB base. Diagnostic colors only.
uint32_t mixOver(uint32_t base, uint32_t overlay) {
  const uint32_t alpha = (overlay >> 24) & 0xFFu;
  const uint32_t inverse = 255u - alpha;
  const auto channel = [&](unsigned shift) {
    return (((overlay >> shift) & 0xFFu) * alpha + ((base >> shift) & 0xFFu) * inverse) / 255u;
  };
  const uint32_t baseAlpha = (base >> 24) & 0xFFu;
  const uint32_t resultAlpha = baseAlpha > alpha ? baseAlpha : alpha;
  return (resultAlpha << 24) | (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

// Live glass views, so `hdc hilog | grep PaseoGlass` answers "how many layers did the app
// actually mount". Everything runs on the UI thread; the counter is atomic to stay safe if a
// future teardown path runs elsewhere.
std::atomic<int> g_liveGlassViewCount{0};

// The immersive material APIs are introduced in API 26 while the app supports API 23.
// Resolving them at runtime keeps this shared library loadable on older system images;
// linking them would turn the missing symbols into a load-time crash.
constexpr const char *kAceNdkLibrary = "libace_ndk.z.so";

using GetSystemMaterialSupportedFn = bool (*)();
using GetGlobalMaterialLevelFn = ArkUI_MaterialLevel (*)();
using CreateImmersiveMaterialFn = ArkUI_ImmersiveMaterialHandle (*)(ArkUI_ImmersiveStyle);
using DestroyImmersiveMaterialFn = void (*)(ArkUI_ImmersiveMaterialHandle);
using SetMaterialColorFn = ArkUI_ErrorCode (*)(ArkUI_ImmersiveMaterialHandle, uint32_t);
using SetApplyShadowFn = ArkUI_ErrorCode (*)(ArkUI_ImmersiveMaterialHandle, bool);
using SetInteractiveFn = ArkUI_ErrorCode (*)(ArkUI_ImmersiveMaterialHandle, bool);
using CreateLightEffectOptionsFn = ArkUI_LightEffectOptionsHandle (*)();
using DestroyLightEffectOptionsFn = void (*)(ArkUI_LightEffectOptionsHandle);
using SetLightEffectColorFn = ArkUI_ErrorCode (*)(ArkUI_LightEffectOptionsHandle, uint32_t);
using SetLightEffectFn = ArkUI_ErrorCode (*)(ArkUI_ImmersiveMaterialHandle, ArkUI_LightEffectOptionsHandle);

struct MaterialApi {
  GetSystemMaterialSupportedFn getSystemMaterialSupported = nullptr;
  GetGlobalMaterialLevelFn getGlobalMaterialLevel = nullptr;
  CreateImmersiveMaterialFn createImmersiveMaterial = nullptr;
  DestroyImmersiveMaterialFn destroyImmersiveMaterial = nullptr;
  SetMaterialColorFn setMaterialColor = nullptr;
  SetApplyShadowFn setApplyShadow = nullptr;
  SetInteractiveFn setInteractive = nullptr;
  CreateLightEffectOptionsFn createLightEffectOptions = nullptr;
  DestroyLightEffectOptionsFn destroyLightEffectOptions = nullptr;
  SetLightEffectColorFn setLightEffectColor = nullptr;
  SetLightEffectFn setLightEffect = nullptr;

  // Without these four there is nothing to build a material with.
  bool hasCore() const {
    return getSystemMaterialSupported != nullptr && getGlobalMaterialLevel != nullptr &&
        createImmersiveMaterial != nullptr && destroyImmersiveMaterial != nullptr;
  }
};

const MaterialApi &materialApi() {
  static const MaterialApi api = [] {
    MaterialApi resolved;
    void *library = dlopen(kAceNdkLibrary, RTLD_NOW);
    if (library == nullptr) {
      return resolved;
    }
    resolved.getSystemMaterialSupported = reinterpret_cast<GetSystemMaterialSupportedFn>(
        dlsym(library, "OH_ArkUI_NativeModule_GetSystemMaterialSupported"));
    resolved.getGlobalMaterialLevel = reinterpret_cast<GetGlobalMaterialLevelFn>(
        dlsym(library, "OH_ArkUI_NativeModule_GetGlobalMaterialLevel"));
    resolved.createImmersiveMaterial = reinterpret_cast<CreateImmersiveMaterialFn>(
        dlsym(library, "OH_ArkUI_NativeModule_ImmersiveMaterial_Create"));
    resolved.destroyImmersiveMaterial = reinterpret_cast<DestroyImmersiveMaterialFn>(
        dlsym(library, "OH_ArkUI_NativeModule_ImmersiveMaterial_Destroy"));
    resolved.setMaterialColor = reinterpret_cast<SetMaterialColorFn>(
        dlsym(library, "OH_ArkUI_NativeModule_ImmersiveMaterial_SetMaterialColor"));
    resolved.setApplyShadow = reinterpret_cast<SetApplyShadowFn>(
        dlsym(library, "OH_ArkUI_NativeModule_ImmersiveMaterial_SetApplyShadow"));
    resolved.setInteractive = reinterpret_cast<SetInteractiveFn>(
        dlsym(library, "OH_ArkUI_NativeModule_ImmersiveMaterial_SetInteractive"));
    resolved.createLightEffectOptions = reinterpret_cast<CreateLightEffectOptionsFn>(
        dlsym(library, "OH_ArkUI_NativeModule_LightEffectOptions_Create"));
    resolved.destroyLightEffectOptions = reinterpret_cast<DestroyLightEffectOptionsFn>(
        dlsym(library, "OH_ArkUI_NativeModule_LightEffectOptions_Destroy"));
    resolved.setLightEffectColor = reinterpret_cast<SetLightEffectColorFn>(
        dlsym(library, "OH_ArkUI_NativeModule_LightEffectOptions_SetColor"));
    resolved.setLightEffect = reinterpret_cast<SetLightEffectFn>(
        dlsym(library, "OH_ArkUI_NativeModule_ImmersiveMaterial_SetLightEffect"));
    return resolved;
  }();
  return api;
}

const char *materialLevelName(ArkUI_MaterialLevel level) {
  switch (level) {
    case ARKUI_MATERIAL_LEVEL_EXQUISITE:
      return "exquisite";
    case ARKUI_MATERIAL_LEVEL_GENTLE:
      return "gentle";
    case ARKUI_MATERIAL_LEVEL_SMOOTH:
      return "smooth";
  }
  return "unknown";
}

const char *materialStyleName(ArkUI_ImmersiveStyle style) {
  switch (style) {
    case ARKUI_IMMERSIVE_STYLE_ULTRA_THIN:
      return "ultraThin";
    case ARKUI_IMMERSIVE_STYLE_THIN:
      return "thin";
    case ARKUI_IMMERSIVE_STYLE_REGULAR:
      return "regular";
    case ARKUI_IMMERSIVE_STYLE_THICK:
      return "thick";
    case ARKUI_IMMERSIVE_STYLE_ULTRA_THICK:
      return "ultraThick";
  }
  return "unknown";
}

std::string colorName(int32_t color) {
  std::ostringstream stream;
  stream << "0x" << std::uppercase << std::hex << std::setw(8) << std::setfill('0')
         << static_cast<uint32_t>(color);
  return stream.str();
}

} // namespace

GlassStackNode::GlassStackNode(ArkUI_ImmersiveStyle materialStyle)
    : ArkUINode(NativeNodeApi::getInstance()->createNode(ArkUI_NodeType::ARKUI_NODE_STACK)),
      m_style(materialStyle) {
  LOG(INFO) << "PaseoGlass: view created style=" << materialStyleName(materialStyle)
            << " liveViews=" << (++g_liveGlassViewCount);
}

GlassStackNode::~GlassStackNode() {
  teardownMaterial();
  LOG(INFO) << "PaseoGlass: view destroyed style=" << materialStyleName(m_style)
            << " liveViews=" << (--g_liveGlassViewCount);
}

void GlassStackNode::insertChild(ArkUINode &child, std::size_t index) {
  maybeThrow(NativeNodeApi::getInstance()->insertChildAt(
      m_nodeHandle, child.getArkUINodeHandle(), static_cast<int32_t>(index)));
}

void GlassStackNode::removeChild(ArkUINode &child) {
  maybeThrow(NativeNodeApi::getInstance()->removeChild(m_nodeHandle, child.getArkUINodeHandle()));
}

void GlassStackNode::applyMaterial(const GlassConfig &config) {
  if (m_hasConfig && m_config == config) {
    return;
  }
  m_config = config;
  m_hasConfig = true;

  // Rebuild from a clean node: material objects keep the knobs they were built with.
  teardownMaterial();

  const MaterialApi &api = materialApi();
  if (!api.hasCore()) {
    degradeToBackdropBlur("API 26 material symbols not present");
    return;
  }

  const bool supported = api.getSystemMaterialSupported();
  const ArkUI_MaterialLevel level = api.getGlobalMaterialLevel();
  LOG(INFO) << "PaseoGlass: systemMaterial supported=" << (supported ? "true" : "false")
            << " level=" << materialLevelName(level) << " style=" << materialStyleName(m_style)
            << " materialColor=" << colorName(config.materialColor)
            << " lightColor=" << colorName(config.lightColor) << " interactive=" << config.interactive
            << " applyShadow=" << config.applyShadow;
  if (!supported) {
    degradeToBackdropBlur("systemMaterial unsupported on this device");
    return;
  }

  // The material color is what makes the layer visible on EXQUISITE/GENTLE devices: without it
  // their material color is transparent. If the device library predates the setter, the material
  // would look exactly like the invisible v1, so take the tinted fallback instead.
  if (config.materialColor != 0 && api.setMaterialColor == nullptr) {
    degradeToBackdropBlur("SetMaterialColor symbol not present");
    return;
  }

  ArkUI_ImmersiveMaterialHandle material = api.createImmersiveMaterial(m_style);
  if (material == nullptr) {
    degradeToBackdropBlur("ImmersiveMaterial_Create returned null");
    return;
  }

  if (config.materialColor != 0) {
    ArkUI_ErrorCode code = api.setMaterialColor(material, static_cast<uint32_t>(config.materialColor));
    LOG(INFO) << "PaseoGlass: SetMaterialColor(" << colorName(config.materialColor)
              << ") code=" << static_cast<int32_t>(code);
    if (code != ARKUI_ERROR_CODE_NO_ERROR) {
      // Without the tint the material is invisible on EXQUISITE/GENTLE devices; the colored
      // blur still shows the layer.
      api.destroyImmersiveMaterial(material);
      degradeToBackdropBlur("SetMaterialColor rejected the color");
      return;
    }
  }

  if (api.setApplyShadow != nullptr) {
    ArkUI_ErrorCode code = api.setApplyShadow(material, config.applyShadow);
    LOG(INFO) << "PaseoGlass: SetApplyShadow(" << config.applyShadow << ") code=" << static_cast<int32_t>(code);
  } else {
    LOG(WARNING) << "PaseoGlass: SetApplyShadow symbol missing, skipped";
  }

  if (api.setInteractive != nullptr) {
    ArkUI_ErrorCode code = api.setInteractive(material, config.interactive);
    LOG(INFO) << "PaseoGlass: SetInteractive(" << config.interactive << ") code=" << static_cast<int32_t>(code);
  } else {
    LOG(WARNING) << "PaseoGlass: SetInteractive symbol missing, skipped";
  }

  ArkUI_LightEffectOptionsHandle lightEffectOptions = nullptr;
  if (api.setLightEffect != nullptr) {
    if (config.lightColor != 0) {
      if (api.createLightEffectOptions == nullptr) {
        LOG(WARNING) << "PaseoGlass: LightEffectOptions_Create symbol missing, light effect skipped";
      } else {
        lightEffectOptions = api.createLightEffectOptions();
        if (lightEffectOptions == nullptr) {
          LOG(WARNING) << "PaseoGlass: LightEffectOptions_Create returned null, light effect skipped";
        }
      }
    }
    if (lightEffectOptions != nullptr && api.setLightEffectColor != nullptr) {
      ArkUI_ErrorCode colorCode =
          api.setLightEffectColor(lightEffectOptions, static_cast<uint32_t>(config.lightColor));
      LOG(INFO) << "PaseoGlass: LightEffectOptions_SetColor(" << colorName(config.lightColor)
                << ") code=" << static_cast<int32_t>(colorCode);
    } else if (lightEffectOptions != nullptr) {
      LOG(WARNING) << "PaseoGlass: LightEffectOptions_SetColor symbol missing, skipped";
    }
    ArkUI_ErrorCode lightCode = api.setLightEffect(material, lightEffectOptions);
    LOG(INFO) << "PaseoGlass: SetLightEffect("
              << (lightEffectOptions != nullptr ? colorName(config.lightColor) : "off")
              << ") code=" << static_cast<int32_t>(lightCode);
  } else {
    LOG(WARNING) << "PaseoGlass: SetLightEffect symbol missing, skipped";
  }

  ArkUI_AttributeItem item = {.value = nullptr, .size = 0, .string = nullptr, .object = material};
  int32_t status = NativeNodeApi::getInstance()->setAttribute(m_nodeHandle, NODE_SYSTEM_MATERIAL, &item);
  LOG(INFO) << "PaseoGlass: setAttribute(NODE_SYSTEM_MATERIAL) status=" << status;
  if (status != ARKUI_ERROR_CODE_NO_ERROR) {
    // A partial symbol set could have handed us options without a destructor; never call through
    // a null function pointer.
    if (lightEffectOptions != nullptr && api.destroyLightEffectOptions != nullptr) {
      api.destroyLightEffectOptions(lightEffectOptions);
    }
    api.destroyImmersiveMaterial(material);
    degradeToBackdropBlur("setAttribute rejected the material");
    return;
  }

  m_material = material;
  m_lightEffectOptions = lightEffectOptions;

  // The material sits on top of the node's own fill. Setting both means every outcome is at
  // least tinted frosted glass: on EXQUISITE/GENTLE the material adds its filter and shadow over
  // the fill, and on SMOOTH, where the material drives the background color itself, our explicit
  // fill is the same tint the material was given.
  const FillStatus fill = applyTintedFill(false);
  const std::string materialStatus = std::to_string(status);
  logSummary("material", fill, materialStatus.c_str());
}

GlassStackNode::FillStatus GlassStackNode::applyTintedFill(bool degraded) {
  FillStatus status;
  if (m_config.materialColor == 0) {
    // Nothing tinted the material in the first place; there is no color to fall back on.
    return status;
  }

  uint32_t color = static_cast<uint32_t>(m_config.materialColor);
  if (degraded && kDiagnosticTintOnDegrade) {
    color = mixOver(color, kDiagnosticTint);
  }

  ArkUI_NumberValue radius[] = {{.f32 = kBackdropBlurRadiusPx}};
  ArkUI_AttributeItem blurItem = {.value = radius, .size = 1};
  status.blur = NativeNodeApi::getInstance()->setAttribute(m_nodeHandle, NODE_BACKDROP_BLUR, &blurItem);

  ArkUI_NumberValue tint[] = {{.u32 = color}};
  ArkUI_AttributeItem tintItem = {.value = tint, .size = 1};
  status.backgroundColor =
      NativeNodeApi::getInstance()->setAttribute(m_nodeHandle, NODE_BACKGROUND_COLOR, &tintItem);
  status.color = color;
  return status;
}

void GlassStackNode::logSummary(
    const char *path,
    const FillStatus &fill,
    const char *materialStatus) {
  // One line per view, after every attribute is set, so
  // `hdc hilog | grep "PaseoGlass: summary"` answers where each layer ended up.
  const std::string blur = fill.blur < 0 ? "none" : std::to_string(fill.blur);
  const std::string backgroundColor =
      fill.backgroundColor < 0 ? "none" : std::to_string(fill.backgroundColor);
  LOG(INFO) << "PaseoGlass: summary style=" << materialStyleName(m_style) << " path=" << path
            << " blur=" << blur << " bg=" << backgroundColor << " material=" << materialStatus;
}

void GlassStackNode::teardownMaterial() {
  const MaterialApi &api = materialApi();
  // Drop the attributes while the node is still alive, then release the objects.
  if (m_material != nullptr) {
    int32_t status = NativeNodeApi::getInstance()->resetAttribute(m_nodeHandle, NODE_SYSTEM_MATERIAL);
    LOG(INFO) << "PaseoGlass: resetAttribute(NODE_SYSTEM_MATERIAL) status=" << status;
  }
  if (m_lightEffectOptions != nullptr && api.destroyLightEffectOptions != nullptr) {
    api.destroyLightEffectOptions(m_lightEffectOptions);
    m_lightEffectOptions = nullptr;
  }
  if (m_material != nullptr && api.destroyImmersiveMaterial != nullptr) {
    api.destroyImmersiveMaterial(m_material);
    m_material = nullptr;
  }
  // The fill travels with every path (applyTintedFill); clearing it here keeps the next apply
  // from stacking a second one, and keeps the teardown symmetric with the setup.
  NativeNodeApi::getInstance()->resetAttribute(m_nodeHandle, NODE_BACKDROP_BLUR);
  NativeNodeApi::getInstance()->resetAttribute(m_nodeHandle, NODE_BACKGROUND_COLOR);
}

void GlassStackNode::degradeToBackdropBlur(const char *reason) {
  // The material is off the table, so the fill is the whole effect — with the diagnostic tint, so
  // the degraded path is visible on the device and not just in the log.
  const FillStatus fill = applyTintedFill(true);
  LOG(INFO) << "PaseoGlass: degraded to backdrop blur (" << reason
            << ") radiusPx=" << kBackdropBlurRadiusPx << " status=" << fill.blur
            << " backgroundColor=" << colorName(static_cast<int32_t>(fill.color))
            << " status=" << fill.backgroundColor;
  logSummary("degraded", fill, "none");
}

} // namespace paseo_glass
} // namespace rnoh
