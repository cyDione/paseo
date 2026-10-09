#pragma once

#include <react/renderer/components/view/ConcreteViewShadowNode.h>
#include <react/renderer/components/view/ViewEventEmitter.h>
#include <react/renderer/components/view/ViewProps.h>

#include <cstdint>

namespace facebook {
namespace react {

// One shadow node per thickness variant so each registers as its own component name.
// They share one props class, so no codegen step is involved.
extern const char PaseoGlassThinName[];
extern const char PaseoGlassRegularName[];
extern const char PaseoGlassThickName[];

/**
 * Props for the glass views. Everything here is a raw prop: the components are hand-registered,
 * so nothing reads them from a generated spec.
 *
 * The two color fields stay `int` (the only integer type `RawValue` casts to); JS sends the
 * 0xAARRGGBB bits as a signed 32-bit number (`value | 0`), and `GlassStackNode` casts back to
 * `uint32_t` when it calls the ArkUI setters. `materialColor == 0` leaves the material default
 * (transparent on high-end devices — the reason v1 was invisible), `lightColor == 0` disables
 * the light effect.
 */
class PaseoGlassProps final : public ViewProps {
public:
  PaseoGlassProps() = default;

  PaseoGlassProps(const PropsParserContext &context, const PaseoGlassProps &sourceProps, const RawProps &rawProps);

#pragma mark - Props

  int materialColor{0};
  int lightColor{0};
  bool interactive{false};
  bool applyShadow{true};
};

using PaseoGlassThinShadowNode = ConcreteViewShadowNode<PaseoGlassThinName, PaseoGlassProps, ViewEventEmitter>;
using PaseoGlassRegularShadowNode = ConcreteViewShadowNode<PaseoGlassRegularName, PaseoGlassProps, ViewEventEmitter>;
using PaseoGlassThickShadowNode = ConcreteViewShadowNode<PaseoGlassThickName, PaseoGlassProps, ViewEventEmitter>;

} // namespace react
} // namespace facebook
