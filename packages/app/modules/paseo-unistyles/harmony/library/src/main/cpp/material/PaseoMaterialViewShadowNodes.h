#pragma once

#include <react/renderer/components/view/ConcreteViewShadowNode.h>
#include <react/renderer/components/view/ViewEventEmitter.h>
#include <react/renderer/components/view/ViewProps.h>

namespace facebook {
namespace react {

/**
 * One component name, declared here and defined in MaterialRegistration.cpp so every translation
 * unit that stamps the shadow node sees the same string. Ring the JS side along when it changes
 * (components/ui/material-view.harmony.tsx).
 */
extern const char PaseoMaterialViewName[];

/**
 * Plain `ViewProps`: the material props are raw (read from `descriptor.rawProps` on the ArkTS
 * side), so nothing here consumes them and no codegen step is involved. The component is mounted
 * as an ArkTS component — it must not register a C++ component instance, or the mounting manager
 * would take the C-API path and the material would never be created.
 */
using PaseoMaterialViewShadowNode =
    ConcreteViewShadowNode<PaseoMaterialViewName, ViewProps, ViewEventEmitter>;

} // namespace react
} // namespace facebook
