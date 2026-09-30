cmake_minimum_required(VERSION 3.13)
project(PaseoUnistyles)

file(GLOB_RECURSE UNISTYLES_CORE CONFIGURE_DEPENDS "generated/unistyles/cxx/*.cpp")
file(GLOB UNISTYLES_SPECS CONFIGURE_DEPENDS "generated/unistyles/specs/*.cpp")
add_library(paseo_unistyles SHARED PaseoUnistyles.cpp ${UNISTYLES_CORE} ${UNISTYLES_SPECS})
target_compile_features(paseo_unistyles PUBLIC cxx_std_20)
target_include_directories(paseo_unistyles PUBLIC
  ${CMAKE_CURRENT_SOURCE_DIR}
  ${CMAKE_CURRENT_SOURCE_DIR}/generated
  ${CMAKE_CURRENT_SOURCE_DIR}/generated/unistyles/specs
  ${CMAKE_CURRENT_SOURCE_DIR}/generated/unistyles/cxx
  ${CMAKE_CURRENT_SOURCE_DIR}/generated/unistyles/cxx/common
  ${CMAKE_CURRENT_SOURCE_DIR}/generated/unistyles/cxx/core
  ${CMAKE_CURRENT_SOURCE_DIR}/generated/unistyles/cxx/hybridObjects
  ${CMAKE_CURRENT_SOURCE_DIR}/generated/unistyles/cxx/parser
  ${CMAKE_CURRENT_SOURCE_DIR}/generated/unistyles/cxx/shadowTree
)
target_link_libraries(paseo_unistyles PUBLIC rnoh rnoh_nitro_modules)
