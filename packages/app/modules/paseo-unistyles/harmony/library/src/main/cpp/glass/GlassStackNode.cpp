#include "GlassStackNode.h"

#include <dlfcn.h>

#include "RNOH/arkui/NativeNodeApi.h"
#include "glog/logging.h"

namespace rnoh {
namespace paseo_glass {

namespace {

// Backdrop blur radius for devices without the API 26 system material. NODE_BACKDROP_BLUR
// takes px, not vp; 24px is a starting point to tune on a real device.
constexpr float kBackdropBlurRadiusPx = 24.0f;

// The immersive material APIs are introduced in API 26 while the app supports API 23.
// Resolving them at runtime keeps this shared library loadable on older system images;
// linking them would turn the missing symbols into a load-time crash.
constexpr const char *kAceNdkLibrary = "libace_ndk.z.so";

using GetSystemMaterialSupportedFn = bool (*)();
using GetGlobalMaterialLevelFn = ArkUI_MaterialLevel (*)();
using CreateImmersiveMaterialFn = ArkUI_ImmersiveMaterialHandle (*)(ArkUI_ImmersiveStyle);
using DestroyImmersiveMaterialFn = void (*)(ArkUI_ImmersiveMaterialHandle);

struct MaterialApi {
  GetSystemMaterialSupportedFn getSystemMaterialSupported = nullptr;
  GetGlobalMaterialLevelFn getGlobalMaterialLevel = nullptr;
  CreateImmersiveMaterialFn createImmersiveMaterial = nullptr;
  DestroyImmersiveMaterialFn destroyImmersiveMaterial = nullptr;

  bool isComplete() const {
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

} // namespace

GlassStackNode::GlassStackNode(ArkUI_ImmersiveStyle materialStyle)
    : ArkUINode(NativeNodeApi::getInstance()->createNode(ArkUI_NodeType::ARKUI_NODE_STACK)) {
  applySystemMaterial(materialStyle);
}

GlassStackNode::~GlassStackNode() {
  if (m_material == nullptr) {
    return;
  }
  // Drop the attribute while the node is still alive, then release the material object.
  int32_t status = NativeNodeApi::getInstance()->resetAttribute(m_nodeHandle, NODE_SYSTEM_MATERIAL);
  LOG(INFO) << "PaseoGlass: resetAttribute(NODE_SYSTEM_MATERIAL) status=" << status;
  materialApi().destroyImmersiveMaterial(m_material);
  m_material = nullptr;
}

void GlassStackNode::insertChild(ArkUINode &child, std::size_t index) {
  maybeThrow(NativeNodeApi::getInstance()->insertChildAt(
      m_nodeHandle, child.getArkUINodeHandle(), static_cast<int32_t>(index)));
}

void GlassStackNode::removeChild(ArkUINode &child) {
  maybeThrow(NativeNodeApi::getInstance()->removeChild(m_nodeHandle, child.getArkUINodeHandle()));
}

void GlassStackNode::applySystemMaterial(ArkUI_ImmersiveStyle materialStyle) {
  const MaterialApi &api = materialApi();
  if (!api.isComplete()) {
    applyBackdropBlurFallback("API 26 material symbols not present");
    return;
  }

  const bool supported = api.getSystemMaterialSupported();
  const ArkUI_MaterialLevel level = api.getGlobalMaterialLevel();
  LOG(INFO) << "PaseoGlass: systemMaterial supported=" << (supported ? "true" : "false")
            << " level=" << materialLevelName(level) << " style=" << materialStyleName(materialStyle);
  if (!supported) {
    applyBackdropBlurFallback("systemMaterial unsupported on this device");
    return;
  }

  ArkUI_ImmersiveMaterialHandle material = api.createImmersiveMaterial(materialStyle);
  if (material == nullptr) {
    applyBackdropBlurFallback("ImmersiveMaterial_Create returned null");
    return;
  }

  ArkUI_AttributeItem item = {.value = nullptr, .size = 0, .string = nullptr, .object = material};
  int32_t status = NativeNodeApi::getInstance()->setAttribute(m_nodeHandle, NODE_SYSTEM_MATERIAL, &item);
  LOG(INFO) << "PaseoGlass: setAttribute(NODE_SYSTEM_MATERIAL) status=" << status;
  if (status != ARKUI_ERROR_CODE_NO_ERROR) {
    api.destroyImmersiveMaterial(material);
    applyBackdropBlurFallback("setAttribute rejected the material");
    return;
  }

  m_material = material;
}

void GlassStackNode::applyBackdropBlurFallback(const char *reason) {
  ArkUI_NumberValue radius[] = {{.f32 = kBackdropBlurRadiusPx}};
  ArkUI_AttributeItem item = {.value = radius, .size = 1};
  int32_t status = NativeNodeApi::getInstance()->setAttribute(m_nodeHandle, NODE_BACKDROP_BLUR, &item);
  LOG(INFO) << "PaseoGlass: degraded to backdrop blur (" << reason
            << ") radiusPx=" << kBackdropBlurRadiusPx << " status=" << status;
}

} // namespace paseo_glass
} // namespace rnoh
