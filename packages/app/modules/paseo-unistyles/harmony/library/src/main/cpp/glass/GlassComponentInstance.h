#pragma once

#include <cstddef>
#include <utility>

#include "RNOH/CppComponentInstance.h"
#include "glass/GlassStackNode.h"

namespace rnoh {
namespace paseo_glass {

template <typename ShadowNodeT>
class GlassComponentInstance : public CppComponentInstance<ShadowNodeT> {
public:
  GlassComponentInstance(ComponentInstance::Context context, ArkUI_ImmersiveStyle materialStyle)
      : CppComponentInstance<ShadowNodeT>(std::move(context)), m_stackNode(materialStyle) {}

  void onChildInserted(ComponentInstance::Shared const &childComponentInstance, std::size_t index) override {
    m_stackNode.insertChild(childComponentInstance->getLocalRootArkUINode(), index);
  }

  void onChildRemoved(ComponentInstance::Shared const &childComponentInstance) override {
    m_stackNode.removeChild(childComponentInstance->getLocalRootArkUINode());
  }

  GlassStackNode &getLocalRootArkUINode() override { return m_stackNode; }

private:
  GlassStackNode m_stackNode;
};

} // namespace paseo_glass
} // namespace rnoh
