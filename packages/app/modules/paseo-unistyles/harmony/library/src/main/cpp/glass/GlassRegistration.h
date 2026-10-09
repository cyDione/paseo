#pragma once

#include "RNOH/Package.h"

namespace rnoh {
namespace paseo_glass {

// Glass views are registered through the Unistyles package for now. They have nothing to do
// with Unistyles; move them into their own module once the material spike is accepted.
ComponentInstanceFactoryDelegate::Shared createComponentInstanceFactoryDelegate();
std::vector<facebook::react::ComponentDescriptorProvider> createComponentDescriptorProviders();
ComponentJSIBinderByString createComponentJSIBinderByName();
ComponentNapiBinderByString createComponentNapiBinderByName();

} // namespace paseo_glass
} // namespace rnoh
