#pragma once

#include "RNOH/Package.h"

namespace rnoh {
namespace paseo_material {

// The material view rides along in the Unistyles package, like the earlier glass experiment did:
// it has no HAR of its own yet.
std::vector<facebook::react::ComponentDescriptorProvider> createComponentDescriptorProviders();
ComponentJSIBinderByString createComponentJSIBinderByName();
ComponentNapiBinderByString createComponentNapiBinderByName();

} // namespace paseo_material
} // namespace rnoh
