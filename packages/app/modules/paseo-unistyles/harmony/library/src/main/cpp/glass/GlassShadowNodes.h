#pragma once

#include <react/renderer/components/view/ConcreteViewShadowNode.h>
#include <react/renderer/components/view/ViewEventEmitter.h>
#include <react/renderer/components/view/ViewProps.h>

namespace facebook {
namespace react {

// One shadow node per thickness variant so each registers as its own component name.
// They share the standard ViewProps surface, so no codegen step is involved.
extern const char PaseoGlassThinName[];
extern const char PaseoGlassRegularName[];
extern const char PaseoGlassThickName[];

using PaseoGlassThinShadowNode = ConcreteViewShadowNode<PaseoGlassThinName, ViewProps, ViewEventEmitter>;
using PaseoGlassRegularShadowNode = ConcreteViewShadowNode<PaseoGlassRegularName, ViewProps, ViewEventEmitter>;
using PaseoGlassThickShadowNode = ConcreteViewShadowNode<PaseoGlassThickName, ViewProps, ViewEventEmitter>;

} // namespace react
} // namespace facebook
