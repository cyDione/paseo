#include "GlassShadowNodes.h"

#include <react/renderer/core/propsConversions.h>

namespace facebook {
namespace react {

PaseoGlassProps::PaseoGlassProps(
    const PropsParserContext &context,
    const PaseoGlassProps &sourceProps,
    const RawProps &rawProps)
    : ViewProps(context, sourceProps, rawProps),
      materialColor(convertRawProp(context, rawProps, "materialColor", sourceProps.materialColor, 0)),
      lightColor(convertRawProp(context, rawProps, "lightColor", sourceProps.lightColor, 0)),
      interactive(convertRawProp(context, rawProps, "interactive", sourceProps.interactive, false)),
      applyShadow(convertRawProp(context, rawProps, "applyShadow", sourceProps.applyShadow, true)) {}

extern const char PaseoGlassThinName[] = "PaseoGlassThin";
extern const char PaseoGlassRegularName[] = "PaseoGlassRegular";
extern const char PaseoGlassThickName[] = "PaseoGlassThick";

} // namespace react
} // namespace facebook
