#pragma once

#include <arkui/native_material.h>
#include <cstddef>

#include "RNOH/arkui/ArkUINode.h"

namespace rnoh {
namespace paseo_glass {

/**
 * Stack node that carries the system material (or its blur fallback). It has no
 * children of its own; the layer is a plain absolutely positioned view.
 */
class GlassStackNode : public ArkUINode {
public:
  explicit GlassStackNode(ArkUI_ImmersiveStyle materialStyle);
  ~GlassStackNode() override;

  void insertChild(ArkUINode &child, std::size_t index);
  void removeChild(ArkUINode &child);

private:
  void applySystemMaterial(ArkUI_ImmersiveStyle materialStyle);
  void applyBackdropBlurFallback(const char *reason);

  // Owned material object; null when the device fell back to the backdrop blur.
  ArkUI_ImmersiveMaterialHandle m_material = nullptr;
};

} // namespace paseo_glass
} // namespace rnoh
