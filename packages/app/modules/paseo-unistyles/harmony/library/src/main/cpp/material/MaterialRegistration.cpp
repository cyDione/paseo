#include "material/MaterialRegistration.h"

#include <memory>
#include <utility>
#include <vector>

#include <react/renderer/componentregistry/ComponentDescriptorProvider.h>
#include <react/renderer/core/ConcreteComponentDescriptor.h>

#include <glog/logging.h>

#include "RNOH/ArkJS.h"
#include "RNOH/BaseComponentNapiBinder.h"
#include "RNOHCorePackage/ComponentBinders/ViewComponentJSIBinder.h"
#include "material/PaseoMaterialViewShadowNodes.h"

namespace rnoh {
namespace paseo_material {

namespace {

/**
 * The JS view config is built from `createNativeProps`, and the Fabric renderer drops every prop
 * that is not listed there (`ReactNativeAttributePayload` filters by `validAttributes`). Without
 * these entries the material props never reach the descriptor and the view silently keeps its
 * defaults.
 *
 * Scalar type names without a processor ("string", "boolean") pass the value through untouched:
 * colors travel as `#AARRGGBB` strings, which ArkUI's `ResourceColor` accepts directly.
 */
class PaseoMaterialJSIBinder : public ViewComponentJSIBinder {
 protected:
  facebook::jsi::Object createNativeProps(facebook::jsi::Runtime &rt) override {
    auto nativeProps = ViewComponentJSIBinder::createNativeProps(rt);
    nativeProps.setProperty(rt, "thickness", "string");
    nativeProps.setProperty(rt, "materialColor", "string");
    nativeProps.setProperty(rt, "degradedColor", "string");
    nativeProps.setProperty(rt, "lightColor", "string");
    nativeProps.setProperty(rt, "interactive", "boolean");
    nativeProps.setProperty(rt, "applyShadow", "boolean");
    return nativeProps;
  }
};

/**
 * Second delivery channel. `descriptor.props` reaches ArkTS through this binder, `descriptor.rawProps`
 * through `MutationsToNapiConverter` regardless of any binder. The ArkTS component reads the typed
 * copy first and reports which channel carried the value, so a prop that only ever arrives on one of
 * them shows up in the log instead of turning into a silent default.
 */
class PaseoMaterialNapiBinder : public BaseComponentNapiBinder {
 public:
  napi_value createProps(napi_env env, facebook::react::ShadowView const shadowView) override {
    auto propsBuilder = ArkJS(env).createObjectBuilder();
    if (auto props = std::dynamic_pointer_cast<const facebook::react::PaseoMaterialViewProps>(
            shadowView.props)) {
      propsBuilder.addProperty("thickness", props->thickness)
          .addProperty("materialColor", props->materialColor)
          .addProperty("degradedColor", props->degradedColor)
          .addProperty("lightColor", props->lightColor)
          .addProperty("interactive", props->interactive)
          .addProperty("applyShadow", props->applyShadow);
    }
    return propsBuilder.build();
  }
};

template <typename ShadowNodeT>
class PaseoMaterialComponentDescriptor final
    : public facebook::react::ConcreteComponentDescriptor<ShadowNodeT> {
 public:
  explicit PaseoMaterialComponentDescriptor(
      const facebook::react::ComponentDescriptorParameters &parameters)
      : ConcreteComponentDescriptor<ShadowNodeT>(parameters) {}
};

} // namespace

std::vector<facebook::react::ComponentDescriptorProvider> createComponentDescriptorProviders() {
  using namespace facebook::react;
  return {
      concreteComponentDescriptorProvider<PaseoMaterialComponentDescriptor<PaseoMaterialLightShadowNode>>(),
      concreteComponentDescriptorProvider<PaseoMaterialComponentDescriptor<PaseoMaterialDarkShadowNode>>(),
  };
}

ComponentJSIBinderByString createComponentJSIBinderByName() {
  // WARN, not INFO: a device's default global log level is W, which filters INFO out entirely, and
  // this line is what separates "the component was never registered" from "it was registered but
  // never built". RNOH's LogSink turns LOG(WARNING) into OH_LOG_WARN (LogSink.cpp).
  LOG(WARNING) << "PaseoMaterial: registered " << facebook::react::PaseoMaterialLightName << " / "
               << facebook::react::PaseoMaterialDarkName
               << " descriptors, view configs and prop binders";
  return {
      {facebook::react::PaseoMaterialLightName, std::make_shared<PaseoMaterialJSIBinder>()},
      {facebook::react::PaseoMaterialDarkName, std::make_shared<PaseoMaterialJSIBinder>()},
  };
}

ComponentNapiBinderByString createComponentNapiBinderByName() {
  return {
      {facebook::react::PaseoMaterialLightName, std::make_shared<PaseoMaterialNapiBinder>()},
      {facebook::react::PaseoMaterialDarkName, std::make_shared<PaseoMaterialNapiBinder>()},
  };
}

} // namespace paseo_material
} // namespace rnoh
