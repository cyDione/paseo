#include "glass/GlassRegistration.h"

#include <memory>
#include <utility>
#include <vector>

#include <react/renderer/componentregistry/ComponentDescriptorProvider.h>

#include "RNOH/BaseComponentJSIBinder.h"
#include "RNOH/BaseComponentNapiBinder.h"
#include "glass/GlassComponentDescriptor.h"
#include "glass/GlassComponentInstance.h"

namespace rnoh {
namespace paseo_glass {

namespace {

// Keep these names in sync with the JS side (glass-layer.harmony.tsx).
constexpr const char *kThinComponentName = "PaseoGlassThin";
constexpr const char *kRegularComponentName = "PaseoGlassRegular";
constexpr const char *kThickComponentName = "PaseoGlassThick";

/**
 * The JS view config is built from `createNativeProps`, and the Fabric renderer drops every prop
 * that is not listed there (`ReactNativeAttributePayload.create`/`diff` filter by
 * `validAttributes`). Without these four, the material props never reach the native props
 * parser and the layer silently keeps its defaults — the invisible v1 again.
 *
 * The colors declare as "number" so the value crosses the bridge untouched: they are already
 * processed 0xAARRGGBB ints, and "Color" would run `processColor` a second time and rotate the
 * channels.
 */
class GlassComponentJSIBinder : public BaseComponentJSIBinder {
protected:
  facebook::jsi::Object createNativeProps(facebook::jsi::Runtime &rt) override {
    auto nativeProps = BaseComponentJSIBinder::createNativeProps(rt);
    nativeProps.setProperty(rt, "materialColor", "number");
    nativeProps.setProperty(rt, "lightColor", "number");
    nativeProps.setProperty(rt, "interactive", "boolean");
    nativeProps.setProperty(rt, "applyShadow", "boolean");
    return nativeProps;
  }
};

class GlassComponentInstanceFactoryDelegate : public ComponentInstanceFactoryDelegate {
public:
  ComponentInstance::Shared create(ComponentInstance::Context ctx) override {
    if (ctx.componentName == kThinComponentName) {
      return std::make_shared<GlassComponentInstance<facebook::react::PaseoGlassThinShadowNode>>(
          std::move(ctx), ARKUI_IMMERSIVE_STYLE_THIN);
    }
    if (ctx.componentName == kRegularComponentName) {
      return std::make_shared<GlassComponentInstance<facebook::react::PaseoGlassRegularShadowNode>>(
          std::move(ctx), ARKUI_IMMERSIVE_STYLE_REGULAR);
    }
    if (ctx.componentName == kThickComponentName) {
      return std::make_shared<GlassComponentInstance<facebook::react::PaseoGlassThickShadowNode>>(
          std::move(ctx), ARKUI_IMMERSIVE_STYLE_THICK);
    }
    return nullptr;
  }
};

} // namespace

ComponentInstanceFactoryDelegate::Shared createComponentInstanceFactoryDelegate() {
  return std::make_shared<GlassComponentInstanceFactoryDelegate>();
}

std::vector<facebook::react::ComponentDescriptorProvider> createComponentDescriptorProviders() {
  using namespace facebook::react;
  return {
      concreteComponentDescriptorProvider<PaseoGlassComponentDescriptor<PaseoGlassThinShadowNode>>(),
      concreteComponentDescriptorProvider<PaseoGlassComponentDescriptor<PaseoGlassRegularShadowNode>>(),
      concreteComponentDescriptorProvider<PaseoGlassComponentDescriptor<PaseoGlassThickShadowNode>>(),
  };
}

ComponentJSIBinderByString createComponentJSIBinderByName() {
  return {
      {kThinComponentName, std::make_shared<GlassComponentJSIBinder>()},
      {kRegularComponentName, std::make_shared<GlassComponentJSIBinder>()},
      {kThickComponentName, std::make_shared<GlassComponentJSIBinder>()},
  };
}

ComponentNapiBinderByString createComponentNapiBinderByName() {
  return {
      {kThinComponentName, std::make_shared<BaseComponentNapiBinder>()},
      {kRegularComponentName, std::make_shared<BaseComponentNapiBinder>()},
      {kThickComponentName, std::make_shared<BaseComponentNapiBinder>()},
  };
}

} // namespace paseo_glass
} // namespace rnoh
