#include "material/PaseoMaterialViewShadowNodes.h"

#include <react/renderer/core/propsConversions.h>

namespace facebook {
namespace react {

const char PaseoMaterialLightName[] = "PaseoMaterialLight";
const char PaseoMaterialDarkName[] = "PaseoMaterialDark";

PaseoMaterialViewProps::PaseoMaterialViewProps(
    const PropsParserContext &context,
    const PaseoMaterialViewProps &sourceProps,
    const RawProps &rawProps)
    : ViewProps(context, sourceProps, rawProps),
      thickness(convertRawProp(context, rawProps, "thickness", sourceProps.thickness, std::string{})),
      materialColor(
          convertRawProp(context, rawProps, "materialColor", sourceProps.materialColor, std::string{})),
      degradedColor(
          convertRawProp(context, rawProps, "degradedColor", sourceProps.degradedColor, std::string{})),
      lightColor(convertRawProp(context, rawProps, "lightColor", sourceProps.lightColor, std::string{})),
      interactive(convertRawProp(context, rawProps, "interactive", sourceProps.interactive, false)),
      applyShadow(convertRawProp(context, rawProps, "applyShadow", sourceProps.applyShadow, true)) {}

} // namespace react
} // namespace facebook
