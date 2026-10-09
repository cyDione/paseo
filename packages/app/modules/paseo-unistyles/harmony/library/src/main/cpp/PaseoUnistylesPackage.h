#pragma once
#include "RNOH/Package.h"
#include "RNOH/ArkTSTurboModule.h"
#include "material/MaterialRegistration.h"

namespace rnoh {
class HarmonyPlatform;
class PaseoUnistylesTurboModule : public ArkTSTurboModule {
public:
  PaseoUnistylesTurboModule(const ArkTSTurboModule::Context ctx, const std::string name);
  ~PaseoUnistylesTurboModule() noexcept override;
private:
  std::shared_ptr<HarmonyPlatform> platform_;
};

class PaseoUnistylesFactory : public TurboModuleFactoryDelegate {
public:
  SharedTurboModule createTurboModule(Context ctx, const std::string &name) const override {
    if (name == "Unistyles") return std::make_shared<PaseoUnistylesTurboModule>(ctx, name);
    return nullptr;
  }
};

class PaseoUnistylesPackage : public Package {
public:
  explicit PaseoUnistylesPackage(Package::Context ctx) : Package(ctx) {}
  std::unique_ptr<TurboModuleFactoryDelegate> createTurboModuleFactoryDelegate() override {
    return std::make_unique<PaseoUnistylesFactory>();
  }

  // The ArkTS material view rides along in this module (material/MaterialRegistration.cpp). It
  // registers no component instance: ArkTS owns the node, so the mounting manager must keep it
  // on the ArkTS path.
  std::vector<facebook::react::ComponentDescriptorProvider> createComponentDescriptorProviders() override {
    return paseo_material::createComponentDescriptorProviders();
  }

  ComponentJSIBinderByString createComponentJSIBinderByName() override {
    return paseo_material::createComponentJSIBinderByName();
  }

  // Second prop channel: `descriptor.props` on the ArkTS side; `rawProps` needs no binder.
  ComponentNapiBinderByString createComponentNapiBinderByName() override {
    return paseo_material::createComponentNapiBinderByName();
  }
};
}
