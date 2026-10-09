#include "material/MaterialRegistration.h"

#include <memory>
#include <utility>
#include <vector>

#include <react/renderer/componentregistry/ComponentDescriptorProvider.h>
#include <react/renderer/core/ConcreteComponentDescriptor.h>

#include "RNOHCorePackage/ComponentBinders/ViewComponentJSIBinder.h"
#include "material/PaseoMaterialViewShadowNodes.h"

namespace facebook {
namespace react {
const char PaseoMaterialViewName[] = "PaseoMaterialView";
} // namespace react
} // namespace facebook

namespace rnoh {
namespace paseo_material {

namespace {

/**
 * The JS view config is built from `createNativeProps`, and the Fabric renderer drops every prop
 * that is not listed there. Without these entries the material props never reach the descriptor
 * and the view silently keeps its defaults.
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

class PaseoMaterialViewComponentDescriptor final
    : public facebook::react::ConcreteComponentDescriptor<
          facebook::react::PaseoMaterialViewShadowNode> {
 public:
  explicit PaseoMaterialViewComponentDescriptor(
      const facebook::react::ComponentDescriptorParameters &parameters)
      : ConcreteComponentDescriptor(parameters) {}
};

} // namespace

std::vector<facebook::react::ComponentDescriptorProvider> createComponentDescriptorProviders() {
  using namespace facebook::react;
  return {concreteComponentDescriptorProvider<PaseoMaterialViewComponentDescriptor>()};
}

ComponentJSIBinderByString createComponentJSIBinderByName() {
  return {{facebook::react::PaseoMaterialViewName, std::make_shared<PaseoMaterialJSIBinder>()}};
}

} // namespace paseo_material
} // namespace rnoh
