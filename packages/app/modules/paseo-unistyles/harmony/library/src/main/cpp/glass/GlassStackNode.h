#pragma once

#include <arkui/native_material.h>
#include <cstddef>
#include <cstdint>

#include "RNOH/arkui/ArkUINode.h"

namespace rnoh {
namespace paseo_glass {

/**
 * Material knobs that arrive from JS. Colors keep the 0xAARRGGBB layout the ArkUI setters
 * expect; 0 means "leave the material default" (`materialColor`) or "no light effect"
 * (`lightColor`).
 */
struct GlassConfig {
  int32_t materialColor = 0;
  int32_t lightColor = 0;
  bool interactive = false;
  bool applyShadow = true;

  bool operator==(const GlassConfig &other) const {
    return materialColor == other.materialColor && lightColor == other.lightColor &&
        interactive == other.interactive && applyShadow == other.applyShadow;
  }
  bool operator!=(const GlassConfig &other) const { return !(*this == other); }
};

/**
 * Stack node that carries the system material and the tinted backdrop blur every glass view also
 * needs: the material can paint nothing (see the header), so the node's own fill is what keeps a
 * surface visible. It has no children of its own; the layer is a plain absolutely positioned view.
 */
class GlassStackNode : public ArkUINode {
public:
  explicit GlassStackNode(ArkUI_ImmersiveStyle materialStyle);
  ~GlassStackNode() override;

  void insertChild(ArkUINode &child, std::size_t index);
  void removeChild(ArkUINode &child);

  /**
   * Applies the material described by the latest props. Repeated calls with the same config are
   * a no-op so layout-only props updates do not rebuild the material. Rebuilding tears the old
   * attribute down first: a material object keeps the knobs it was built with, so partial
   * updates would leak the previous values.
   */
  void applyMaterial(const GlassConfig &config);

private:
  /** Status codes of the two fill attributes; -1 means the attribute was not set at all. */
  struct FillStatus {
    int32_t blur = -1;
    int32_t backgroundColor = -1;
    uint32_t color = 0;
  };

  /**
   * Sets the node's own fill — backdrop blur plus the material color — whatever the material
   * does. `degraded` mixes the diagnostic tint into the color.
   */
  FillStatus applyTintedFill(bool degraded);
  void logSummary(const char *path, const FillStatus &fill, const char *materialStatus);
  void teardownMaterial();
  void degradeToBackdropBlur(const char *reason);

  const ArkUI_ImmersiveStyle m_style;
  GlassConfig m_config{};
  bool m_hasConfig = false;
  // Owned material object and its light-effect options. Both stay alive while the attribute is
  // set; the header does not say the material copies the options object.
  ArkUI_ImmersiveMaterialHandle m_material = nullptr;
  ArkUI_LightEffectOptionsHandle m_lightEffectOptions = nullptr;
};

} // namespace paseo_glass
} // namespace rnoh
