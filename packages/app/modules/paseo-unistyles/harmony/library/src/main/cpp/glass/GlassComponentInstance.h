#pragma once

#include <cstddef>
#include <memory>
#include <utility>

#include "RNOH/CppComponentInstance.h"
#include "glass/GlassStackNode.h"

namespace rnoh {
namespace paseo_glass {

template <typename ShadowNodeT>
class GlassComponentInstance : public CppComponentInstance<ShadowNodeT> {
  using Super = CppComponentInstance<ShadowNodeT>;
  using ConcreteProps = typename ShadowNodeT::ConcreteProps;

public:
  GlassComponentInstance(ComponentInstance::Context context, ArkUI_ImmersiveStyle materialStyle)
      : Super(std::move(context)), m_stackNode(materialStyle) {}

  void onChildInserted(ComponentInstance::Shared const &childComponentInstance, std::size_t index) override {
    m_stackNode.insertChild(childComponentInstance->getLocalRootArkUINode(), index);
  }

  void onChildRemoved(ComponentInstance::Shared const &childComponentInstance) override {
    m_stackNode.removeChild(childComponentInstance->getLocalRootArkUINode());
  }

  /**
   * The base class keeps the standard view surface (background color, borders, transforms) in
   * sync; the material is rebuilt on top of that whenever one of its own props changes.
   */
  void onPropsChanged(std::shared_ptr<const ConcreteProps> const &props) override {
    Super::onPropsChanged(props);
    m_stackNode.applyMaterial({
        props->materialColor,
        props->lightColor,
        props->interactive,
        props->applyShadow,
    });
  }

  GlassStackNode &getLocalRootArkUINode() override { return m_stackNode; }

private:
  GlassStackNode m_stackNode;
};

} // namespace paseo_glass
} // namespace rnoh
