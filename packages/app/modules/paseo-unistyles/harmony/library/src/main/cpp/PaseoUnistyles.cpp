#include "PaseoUnistylesPackage.h"
#include <NitroModules/HybridObjectRegistry.hpp>
#include "HybridUnistylesRuntime.h"
#include "HybridStyleSheet.h"
#include "HybridShadowRegistry.h"
#include <optional>

using namespace facebook;
using namespace margelo::nitro;
using namespace margelo::nitro::unistyles;

namespace rnoh {
class HarmonyPlatform final : public HybridNativePlatformSpec {
public:
  HarmonyPlatform() : HybridObject(TAG) {}
  Insets getInsets() override { return snapshot().insets; }
  ColorScheme getColorScheme() override { return snapshot().colorScheme; }
  double getFontScale() override { return snapshot().fontScale; }
  double getPixelRatio() override { return snapshot().pixelRatio; }
  Orientation getOrientation() override {
    return snapshot().isLandscape ? Orientation::LANDSCAPE : Orientation::PORTRAIT;
  }
  std::string getContentSizeCategory() override { return snapshot().contentSizeCategory; }
  Dimensions getScreenDimensions() override { return snapshot().screen; }
  Dimensions getStatusBarDimensions() override { return snapshot().statusBar; }
  Dimensions getNavigationBarDimensions() override { return snapshot().navigationBar; }
  bool getPrefersRtlDirection() override { return snapshot().rtl; }
  void setRootViewBackgroundColor(double color) override { chrome_("background", color); }
  void setNavigationBarHidden(bool hidden) override { chrome_("navigation", hidden ? 1 : 0); }
  void setStatusBarHidden(bool hidden) override { chrome_("status", hidden ? 1 : 0); }
  void setImmersiveMode(bool enabled) override { chrome_("immersive", enabled ? 1 : 0); }
  UnistylesNativeMiniRuntime getMiniRuntime() override { return snapshot(); }

  void registerPlatformListener(const std::function<void(const std::vector<UnistyleDependency>&,
    const UnistylesNativeMiniRuntime&)>& callback) override { listener_ = callback; }
  void registerImeListener(const std::function<void(const UnistylesNativeMiniRuntime&)>& callback) override {
    imeListener_ = callback;
  }
  void unregisterPlatformListeners() override { listener_ = nullptr; imeListener_ = nullptr; }
  void setChrome(std::function<void(std::string, double)> callback) { chrome_ = std::move(callback); }

  void update(const UnistylesNativeMiniRuntime& next) {
    std::vector<UnistyleDependency> changed;
    if (snapshot_) {
      const auto& previous = *snapshot_;
      if (previous.screen.width != next.screen.width || previous.screen.height != next.screen.height) changed.push_back(UnistyleDependency::DIMENSIONS);
      if (previous.colorScheme != next.colorScheme) changed.push_back(UnistyleDependency::COLORSCHEME);
      if (previous.insets.top != next.insets.top || previous.insets.bottom != next.insets.bottom
        || previous.insets.left != next.insets.left || previous.insets.right != next.insets.right) changed.push_back(UnistyleDependency::INSETS);
      if (previous.fontScale != next.fontScale) changed.push_back(UnistyleDependency::FONTSCALE);
      if (previous.pixelRatio != next.pixelRatio) changed.push_back(UnistyleDependency::PIXELRATIO);
      if (previous.isLandscape != next.isLandscape) changed.push_back(UnistyleDependency::ORIENTATION);
      if (previous.statusBar.width != next.statusBar.width || previous.statusBar.height != next.statusBar.height) changed.push_back(UnistyleDependency::STATUSBAR);
      if (previous.navigationBar.width != next.navigationBar.width || previous.navigationBar.height != next.navigationBar.height) changed.push_back(UnistyleDependency::NAVIGATIONBAR);
      if (previous.rtl != next.rtl) changed.push_back(UnistyleDependency::RTL);
      const bool imeChanged = previous.insets.ime != next.insets.ime;
      snapshot_ = next;
      if (imeChanged && imeListener_) imeListener_(next);
      if (!changed.empty() && listener_) listener_(changed, next);
    } else {
      snapshot_ = next;
    }
  }

private:
  const UnistylesNativeMiniRuntime& snapshot() const {
    if (!snapshot_) throw std::runtime_error("Initialize Paseo's Harmony window bridge before Unistyles");
    return *snapshot_;
  }
  std::optional<UnistylesNativeMiniRuntime> snapshot_;
  std::function<void(std::string, double)> chrome_;
  std::function<void(const std::vector<UnistyleDependency>&, const UnistylesNativeMiniRuntime&)> listener_;
  std::function<void(const UnistylesNativeMiniRuntime&)> imeListener_;
};
}

namespace rnoh {
PaseoUnistylesTurboModule::PaseoUnistylesTurboModule(const ArkTSTurboModule::Context ctx,
  const std::string name) : ArkTSTurboModule(ctx, name) {
  platform_ = std::make_shared<HarmonyPlatform>();
  auto executor = [invoker = jsInvoker_](std::function<void(jsi::Runtime&)>&& callback) {
    invoker->invokeAsync(std::move(callback));
  };
  auto runtime = std::make_shared<HybridUnistylesRuntime>(platform_, executor);
  auto styles = std::make_shared<HybridStyleSheet>(runtime);
  for (const auto& hybrid : {"UnistylesRuntime", "UnistylesStyleSheet", "UnistylesShadowRegistry"}) {
    if (HybridObjectRegistry::hasHybridObject(hybrid)) HybridObjectRegistry::unregisterHybridObjectConstructor(hybrid);
  }
  HybridObjectRegistry::registerHybridObjectConstructor("UnistylesRuntime", [runtime]() { return runtime; });
  HybridObjectRegistry::registerHybridObjectConstructor("UnistylesStyleSheet", [styles]() { return styles; });
  HybridObjectRegistry::registerHybridObjectConstructor("UnistylesShadowRegistry", [runtime]() {
    return std::make_shared<HybridShadowRegistry>(runtime);
  });
  methodMap_["initialize"] = {2, [](jsi::Runtime& rt, react::TurboModule& module,
    const jsi::Value* args, size_t count) {
    if (count != 2) throw jsi::JSError(rt, "Unistyles.initialize expects window state and a chrome callback");
    auto& platform = static_cast<PaseoUnistylesTurboModule&>(module).platform_;
    platform->setChrome(JSIConverter<std::function<void(std::string, double)>>::fromJSI(rt, args[1]));
    platform->update(JSIConverter<UnistylesNativeMiniRuntime>::fromJSI(rt, args[0]));
    return jsi::Value::undefined();
  }};
  methodMap_["updateWindow"] = {1, [](jsi::Runtime& rt, react::TurboModule& module,
    const jsi::Value* args, size_t count) {
    if (count != 1) throw jsi::JSError(rt, "Unistyles.updateWindow expects window state");
    auto& platform = static_cast<PaseoUnistylesTurboModule&>(module).platform_;
    platform->update(JSIConverter<UnistylesNativeMiniRuntime>::fromJSI(rt, args[0]));
    return jsi::Value::undefined();
  }};
  methodMap_.insert({ARK_METHOD_METADATA(getInsets, 0), ARK_ASYNC_METHOD_METADATA(setWindowStyle, 2)});
}

PaseoUnistylesTurboModule::~PaseoUnistylesTurboModule() noexcept {
  platform_->unregisterPlatformListeners();
  core::UnistylesRegistry::get().destroy();
  for (const auto& hybrid : {"UnistylesRuntime", "UnistylesStyleSheet", "UnistylesShadowRegistry"}) {
    if (HybridObjectRegistry::hasHybridObject(hybrid)) HybridObjectRegistry::unregisterHybridObjectConstructor(hybrid);
  }
}
}
