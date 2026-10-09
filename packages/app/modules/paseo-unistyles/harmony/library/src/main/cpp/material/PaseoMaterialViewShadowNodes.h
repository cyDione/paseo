#pragma once

#include <react/renderer/components/view/ConcreteViewShadowNode.h>
#include <react/renderer/components/view/ViewEventEmitter.h>
#include <react/renderer/components/view/ViewProps.h>

#include <string>

namespace facebook {
namespace react {

/**
 * Two component names, one props class. The name is the signal that survives when the props do not:
 * it selects the built-in tint the ArkTS side falls back to, so a light and a dark surface still
 * read as frosted glass when nothing else arrives. Defined in MaterialRegistration.cpp.
 */
extern const char PaseoMaterialLightName[];
extern const char PaseoMaterialDarkName[];

/**
 * The material props are read twice on purpose. `Props::rawProps` — the RNOH patch in
 * `Props.h` — already carries every prop the view config lets through, and this typed copy is what
 * the `ComponentNapiBinder` ships to ArkTS as `descriptor.props`. The ArkTS component prefers the
 * typed copy, falls back to `rawProps`, then to its built-in default, and logs which one it used:
 * a prop that never arrives has to be visible in hilog, not silently render the default.
 */
class PaseoMaterialViewProps final : public ViewProps {
 public:
  PaseoMaterialViewProps() = default;

  PaseoMaterialViewProps(
      const PropsParserContext &context,
      const PaseoMaterialViewProps &sourceProps,
      const RawProps &rawProps);

  std::string thickness{};
  std::string materialColor{};
  std::string degradedColor{};
  std::string lightColor{};
  bool interactive{false};
  bool applyShadow{true};
};

using PaseoMaterialLightShadowNode =
    ConcreteViewShadowNode<PaseoMaterialLightName, PaseoMaterialViewProps, ViewEventEmitter>;
using PaseoMaterialDarkShadowNode =
    ConcreteViewShadowNode<PaseoMaterialDarkName, PaseoMaterialViewProps, ViewEventEmitter>;

} // namespace react
} // namespace facebook
