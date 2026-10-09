#pragma once
#include "RNOH/Package.h"
#include "RNOH/ArkTSTurboModule.h"
#include "glass/GlassRegistration.h"

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

  // Glass views ride along in this module; see GlassRegistration.h.
  ComponentInstanceFactoryDelegate::Shared createComponentInstanceFactoryDelegate() override {
    return paseo_glass::createComponentInstanceFactoryDelegate();
  }

  std::vector<facebook::react::ComponentDescriptorProvider> createComponentDescriptorProviders() override {
    return paseo_glass::createComponentDescriptorProviders();
  }

  ComponentJSIBinderByString createComponentJSIBinderByName() override {
    return paseo_glass::createComponentJSIBinderByName();
  }

  ComponentNapiBinderByString createComponentNapiBinderByName() override {
    return paseo_glass::createComponentNapiBinderByName();
  }
};
}
