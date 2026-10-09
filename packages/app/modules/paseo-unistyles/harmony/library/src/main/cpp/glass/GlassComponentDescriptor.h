#pragma once

#include <react/renderer/core/ConcreteComponentDescriptor.h>

#include "GlassShadowNodes.h"

namespace facebook {
namespace react {

template <typename ShadowNodeT>
class PaseoGlassComponentDescriptor final : public ConcreteComponentDescriptor<ShadowNodeT> {
public:
  explicit PaseoGlassComponentDescriptor(const ComponentDescriptorParameters &parameters)
      : ConcreteComponentDescriptor<ShadowNodeT>(parameters) {}
};

} // namespace react
} // namespace facebook
