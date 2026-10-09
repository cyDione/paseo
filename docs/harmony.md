# HarmonyOS

The Harmony target uses React Native Harmony and native Expo modules. It requires
HarmonyOS 6.1 (API 23) or newer and builds with the official DevEco command-line
suite 26.0.0. The Expo Harmony adapters are community packages; their versions are
pinned separately from the Huawei toolchain.

## Build and develop

Install the repository dependencies with `npm ci`, then activate your DevEco
environment. You need the complete SDK root (both HMS and OpenHarmony), OHPM,
Hvigor, HDC and JDK 21 on `PATH`. Set `DEVECO_SDK_HOME` to the SDK root containing
`default`, rather than the nested OpenHarmony directory.

From the repository root:

```sh
npm run build:app-deps
npm run harmony:prebuild --workspace=@getpaseo/app
npm run harmony:doctor
npm run harmony:build
```

`harmony:prepare` regenerates the terminal WebView HTML, builds the local audio
and Unistyles source HARs and supplies project-local links for hoisted npm
packages. The terminal HTML embeds the current renderer in the native app,
including its link-opening bridge. RNOH code generation and Expo's
isolated CNG check require those links. Run the npm scripts after `npm ci`; invoking
the underlying CLIs directly bypasses preparation.

The generated `packages/app/harmony` directory is disposable. Keep app settings in
`app.config.js`, native module metadata in `package.json`, and local module sources
outside that generated directory. Changes to a source HAR require linking again.

On a clean checkout `harmony:prepare` builds the module HARs and also leaves a stub
`packages/app/harmony`. A stub makes `expo-harmony prebuild` skip project
generation, so `harmony:build` then fails in doctor with a missing
`build-profile.json5`. Run `harmony:prepare`, delete `packages/app/harmony`, run
`expo-harmony prebuild`, then `harmony:build`. The workflow does this. The module
HARs also need `npm run build:app-deps` first.

The npm and OHPM versions of `expo-two-way-audio` must match. When upstream bumps
its npm version, update both `oh-package.json5` files under
`packages/expo-two-way-audio/harmony`, or `prepare` fails.

Release builds export Hermes bytecode before compiling the native libraries. For
native compiler troubleshooting, `EXPO_HARMONY_BUNDLE_PREBUILT=1` allows Hvigor to
reuse an existing verified bytecode bundle. Rebuild through `npm run harmony:build`
before distributing an artifact so its JavaScript matches the current sources.

Use `npm run harmony` with an HDC-connected device for development. A cloud machine
without an HDC target can compile an unsigned HAP; it cannot verify touch,
microphone, camera or keyboard behavior. To sign for installation, set
`EXPO_HARMONY_SIGNING_CONFIG_FILE` to an external DevEco signing configuration.
Keep certificates, passwords and device profiles outside the checkout.

## Automatic upstream synchronization

`Harmony Upstream Sync` checks `getpaseo/paseo:main` hourly, at minute 17, and can
also run manually. It merges upstream without choosing either side of a conflict.
Conflicts abort the merge and appear in the run summary and diagnostics artifact;
resolve them manually before rerunning. A clean merge is checked for types, lint,
format, panel/audio/clipboard behavior, browser resizing and native terminal HTML.

The workflow updates one PR from the reserved `automation/harmony-upstream`
branch. Do not use that branch for manual work. Application validation has a
read-only token; only the final publishing job can push or create a PR. Candidate
bundles preserve the exact checked commit between jobs, and publication stops if
the downstream branch changed during validation. Because PRs created with
`GITHUB_TOKEN` do not trigger ordinary PR workflows, these checks run inside the
sync workflow itself.

Merge the port and this workflow into the fork's default branch before enabling
the schedule. Enable Actions for the fork and allow GitHub Actions to create pull
requests in **Settings → Actions → General → Workflow permissions**. The target
defaults to `main`; set `HARMONY_DOWNSTREAM_BRANCH` as a repository variable to
maintain another branch containing the Harmony port and sync script.

Native validation runs on a GitHub-hosted `ubuntu-latest` runner by default. Set
`HARMONY_NATIVE_CI_ENABLED=true` to turn it on. The job downloads the DevEco CLI
26.0.0.821 from the community release at
[ErBWs/ohos-sdk](https://github.com/ErBWs/ohos-sdk), because the official archive
needs a Huawei login. The three SHA-256 digests in the workflow pin the exact
files. That archive is a third-party redistribution of Huawei software: the digests
prove the files did not change, not that they match Huawei's. Use a self-hosted
runner if that trust is not acceptable. Bump the URL and all three digests together.

The hosted runner has 16 GB of memory against a roughly 15 GB Hermes compiler peak
reported for the tested build, so the job adds a 16 GB swap file. If the compile
runs out of memory anyway, use a self-hosted runner.

The expo-harmony CLI kills the Hvigor build after 15 minutes by default. A cold
hosted build already takes about 14, so `harmony-build` raises
`EXPO_HARMONY_HVIGOR_BUILD_TIMEOUT_MS`. Lower it only if the Hvigor build gets
faster; the job timeout still bounds a hung build.

`Harmony HAP` (`harmony-hap.yml`) builds the unsigned HAP for the commit you push
to any `harmony/**` branch, or run it by hand. It needs no repository variable and
does not merge upstream, so it works for feature work that the sync workflow skips.
Both workflows share the toolchain install and the build steps in
`.github/actions/harmony-toolchain` and `.github/actions/harmony-build`.

Hosted builds restore four caches (npm, the ohpm download cache, ccache for the
native C++, and Metro's transform cache), which takes a repeat build from about 32
minutes to about 15. The compile is the biggest part: the SDK pins its compilers in
`ohos.toolchain.cmake`, so the toolchain action appends a ccache launcher to that
file after it verifies the archive digest. `harmony-build` prints `ccache` statistics
at the end; a warm build shows a high hit rate there and a cold one shows none. If the
hit rate stays near zero on a repeat build, the launcher is not reaching the compile.

A cache is readable only from the branch that wrote it and from the default branch,
so do all Harmony UI work on `harmony/ui` and push there. A new branch starts cold.
Entries unused for seven days are evicted, and the repository cap is 10 GB.

To use a self-hosted Linux x64 runner instead, give it a label and set
`HARMONY_RUNNER_LABEL` to that label. Set `HARMONY_ENV_FILE` to its DevEco
activation script (default `/workspace/harmony-tools/env.sh`). That script must
configure the complete SDK, Node 24.14.1, JDK 21, OHPM and Hvigor for the runner's
account. Use 32 GB of memory.

Without native CI, updates remain draft PRs. Native failures also keep PRs in
draft. A successful build uploads an unsigned HAP, its checksum and the Hermes
source map to the run's `harmony-hap-<commit>` artifact for 14 days; the map
(`hermes_bundle.hbc.map`) turns a bytecode offset from a device `jscrash` stack
back into a source line. It does not replace a release or the checked-in `hap/`
package. Signing and device validation remain separate.

Automatic merge is off by default. Enable the repository's auto-merge setting and
set `HARMONY_AUTO_MERGE=true` only if unattended merges are wanted. It requires
both JavaScript checks and a full native build to pass and matches the exact PR
head commit. SDK upgrades, new native APIs and conflicting Harmony adapters still
need code changes by a maintainer; merging and compilation cannot supply them.

## Native dependencies

React 19.2.3, RNOH 0.84.1 and Hermes 250829098.0.9 must stay paired. The Expo 55
modules and their Harmony adapters must also match. Use the manifest and lockfile
as the version source; upgrade the adapters and validate native compilation
together.

The Expo preset uses the Harmony worklets adapter's own Babel plugin to match its
native worklet version. The standard worklets plugin remains active on the other
platforms. Navigation overrides keep the app and Expo Router on one set of types.

Unistyles retains its version 3 Fabric implementation. The local
`paseo-unistyles` module supplies the Harmony platform bridge; preparation stages
the pinned upstream 3.2.4 C++ sources and the Harmony Nitro headers into a source
HAR. Nitrogen 0.31.10 regenerates its bindings for the Harmony Nitro 0.31 ABI.
Review that bridge before upgrading either dependency. Using the version 2
Harmony fork would change the app's styling and theme behavior.

SVG, Skia, async storage, keyboard controller and masked view need explicit native
autolinking metadata because their packages do not supply it. A JavaScript alias
alone does not register their native implementations. The compatibility header
for keyboard controller preserves its exported class despite the HAR's filename
casing. Masked view implements its native view in C++ only; the pinned
autolinker patch supports `etsPackageImport: "none"` while retaining its C++
registration.

The Harmony editor uses native RN TextInput. Paste text through the system menu;
paste an image through **Add attachment → Paste image**. This action uses the
Harmony clipboard module. The iOS/Android Mattermost input is not loaded on
Harmony.

The Hermes build in RNOH has no `Intl` global. Any reference to it throws
`Property 'Intl' doesn't exist`, and three modules read it while loading, so the app
dies at startup. `packages/app/src/polyfills/intl.ts` installs `NumberFormat` and
`DateTimeFormat` when the runtime has no `Intl`, and `index.ts` loads it first. The
output is English (en-US) whatever the locale; the time zone and 12/24-hour clock come
from `expo-localization`. `Segmenter` and `PluralRules` are left out because the app and
i18next check for them and fall back. Do not call `toLocaleDateString` or
`toLocaleString` with options: Hermes ignores the options without `Intl`. Use
`Intl.DateTimeFormat` or `Intl.NumberFormat`, and extend the polyfill, with a test against
Node's `Intl`, when a screen needs an option it does not handle.

The native notification module is linked, but Paseo's background notification
transport uses Expo Push Service, which does not support HarmonyOS. The Harmony
app skips Expo token registration. Huawei Push Kit requires an AppGallery Connect
application, signing configuration and a daemon transport adapter. In-app agent
updates continue through the existing connection.

RNOH's status bar manager defaults the status bar content color to white, which
leaves the light themes with a system-drawn contrast backdrop behind the clock
and icons. `packages/app/src/appearance/use-system-bars.harmony.ts` resolves the
effective color scheme from the contributed theme or the theme preference, with
`auto` following the system scheme, and calls `StatusBar.setBarStyle`. It re-runs
when the system scheme changes.

## Frosted chrome (ArkUI)

The composer card and the pills above it are frosted translucent surfaces on HarmonyOS. The effect
is ArkUI's own backdrop blur plus a translucent fill, with an HDS flowing-light overlay on top. JS
reaches it through `MaterialView` (`packages/app/src/components/ui/material-view.harmony.tsx`), a
plain `View` on every other platform, so call sites stay unconditional. Decorative use only: the
component, the values below and the transcript layout around it are the whole contract.

The RN children live inside the component (`ContentSlot`): the ArkTS node is the surface's own box,
and the RN children are laid out inside it by the C++ layout rects.

This component deliberately does not use `RNViewBase`: the ArkUI node for an ArkTS component is
already positioned by the layout rect the C++ side sets on its wrapper, and `RNViewBase` re-applies
the same origin from `layoutMetrics`, which would offset anything that does not start at (0, 0). It
applies the corner radius (which clips the background), the border, the border style and the opacity
from the descriptor instead.

### The immersive system material is out of scope here

`.systemMaterial()` creates a material object on any component, but the engine only _activates_ it
inside the components the material belongs to. On device, every surface of ours answers with:

```
W C03900/sh.paseo.harmony/Ace: Material inactive: out of scope. Use component in navigation title bar or Tabbar.
```

The material object exists, `uiMaterial.getMaterialInfo()` reports `state=1` (the application-level
metadata switch below was read), `isImmersiveMaterialSupported()` is true and the computing level is
`EXQUISITE` — and nothing is drawn, because a composer card is not a Navigation title bar. That is
what "transparent, no blur, no tint" was in the earlier attempts; the props and the registration
were never the problem.

`SYSTEM_MATERIAL_ENABLED` in `MaterialView.ets` is therefore `false` and the call is skipped, which
also silences the engine warning. The code path and the logs stay so that a container that _is_ in
scope can switch it on. Which entries do get a real system material (evaluation only, not used
here):

| Entry                | Where the material is honoured                                                                                          | What it would take                                                                                        |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Navigation title bar | `navigation.d.ts`, the title bar's `systemMaterial` option                                                              | Move the header into an ArkUI `Navigation`/`HdsNavigation` title bar; the RN header is its own view tree  |
| Tabs tab bar         | `tabs.d.ts`, tab bar options with `systemMaterial`, `maskColor`, `maskHeight`, `adaptToHandedness`                      | Render the compact bottom/segment bar as an ArkUI `Tabs` bar instead of RN                                |
| Built-in components  | Dialog, Toast, `bindSheet`, Menu, Select, Toggle, Slider, Chip/ChipGroup, SegmentButton, SelectionMenu, AlphabetIndexer | Replace the RN equivalent — a chip's material comes with the chip's own component, not with our container |

### What paints instead

- **Backdrop blur and fill.** `.backgroundEffect()` with an explicit radius, saturation, brightness
  and a translucent `color`, plus the corner radius that clips it. Unlike the material this works on
  any container and on every supported system version (the API is much older than 26), so the
  surface is frosted wherever the app runs. `.clip(true)` closes the corners for the RN children
  too. The radii are deliberately large — 16 vp thin, 28 vp regular, 44 vp thick — because a blur
  you have to look for is not the point; saturation and brightness lift the transcript behind the
  glass on light themes (1.6 / 1.08) and calm it on dark ones (1.4 / 0.92). All of them are feel
  values in `MaterialView.ets`, tuned by eye.
- **Flowing light.** An `HdsVisualComponent` overlay inside the same component,
  `HdsSceneType.DUAL_EDGE_FLOW_LIGHT_WITH_BACKGROUND_MASK`, driven by an `HdsSceneController` that
  is started in `aboutToAppear` and stopped in `aboutToDisappear`. It sits above the RN content and
  is `HitTestMode.None`, so it takes no touches. Its colors are the adopted tint (mask) and the
  light color (both translucent, from JS or the built-in defaults), and it is skipped entirely when
  `canIUse('SystemCapability.UIDesign.HDSComponent.Core')` is false. `FLOW_LIGHT_ENABLED` is the
  switch. Whether the engine treats _this_ scene as out of scope as well is not documented; the
  scene's finish callback logs once (`PaseoMaterial: flowLight finished`) so the device answers it.

### The surface is visible without props

`materialColor` defaults to `Color.Transparent`, and a prop that never arrives would leave the
surface exactly that. The built-in tints exist for that failure: `material-color.ts` sends `surface0`
at 55% on light themes and `surface1` at 55% on dark ones, and the ArkTS side falls back to
`#B3FFFFFF` / `#66000000` when it hears nothing at all. The component _name_
(`PaseoMaterialLight` / `PaseoMaterialDark`) carries the scheme, so the fallback is right in both
themes even if no prop ever reaches the device.

The RN side stays transparent for the same reason. `platformChromeMaterialFill`
(`styles/platform-chrome.harmony.ts`) is `transparent` on HarmonyOS and `null` elsewhere, which
`composer/pill-styles.ts` and any other surface reads inside its `StyleSheet.create`; the composer
card's own entry (`platformChromeStyles.composerCard`) does the same.

### Registration and prop delivery

| Piece                                | Where                                                                                                                                                                          |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| RN props contract                    | `components/ui/material-view.types.ts`, mirrored by `PaseoMaterialRawProps` / `PaseoMaterialTypedProps` in `MaterialView.ets`                                                  |
| ArkTS component                      | `harmony/library/src/main/ets/MaterialView.ets`, registered by `PaseoUnistylesPackage.ets` in `createWrappedCustomRNComponentBuilderByComponentNameMap` (one builder per name) |
| Descriptor, view config, prop binder | `harmony/library/src/main/cpp/material/`, built into the existing `paseo_unistyles` target                                                                                     |

The C++ side registers a descriptor and a `ComponentJSIBinder` per name — without the binder the JS
view config drops the material props before they reach the device — and deliberately no component
instance: a C++ instance would move the component onto the C-API mounting path, where the ArkTS
component is never built.

There are two prop channels, and the ArkTS side logs which one carried each value:

1. `descriptor.props`, typed, filled by the package's `ComponentNapiBinder` (`MaterialRegistration.cpp`)
   and parsed in `PaseoMaterialViewProps` through `convertRawProp`.
2. `descriptor.rawProps`, the generic copy RNOH attaches to every mutation
   (`MutationsToNapiConverter.cpp`), which needs no binder.

Neither is trusted alone: `MaterialView.ets` prefers the typed copy, falls back to `rawProps`, then
to its built-in default, and the appearance summary names the channel each value came from.

### Application-level switch

The entry module's `module.json5` metadata carries
`{ "name": "ohos.arkui.UIMaterial.state", "value": "enable" }`. `packages/app/harmony` is generated
by prebuild, so the key comes from the local config plugin
`packages/app/plugins/with-harmony-system-material.js` (through `withModuleJson`). The device
confirms the system read it: `state=1` in the appearance line. The key name comes from Huawei's
"开启沉浸光感" documentation and is not present in the SDK declarations. It is kept because a
container that is in scope would need it; it has no effect on the current surfaces either way.

### Diagnosing it on a device

Every `PaseoMaterial:` line is **WARN**, never INFO. A device's default global log level is `W`
(`param get hilog.loggable.global`), which filters `hilog.info` and `LOG(INFO)` completely: one
device run captured 12.7k lines with not one `PaseoMaterial` line in them. ArkTS logs go through
`hilog.warn(domain, tag, '%{public}s', message)` — the format string is what keeps the arguments out
of the `<private>` mask — and the C++ line goes through `LOG(WARNING)`, which RNOH's `LogSink`
(`LogSink.cpp`) turns into `OH_LOG_WARN`.

`hdc hilog | grep PaseoMaterial` then shows, per process and per surface:

```
PaseoMaterial: module loaded
PaseoMaterial: registered PaseoMaterialLight / PaseoMaterialDark descriptors, view configs and prop binders
PaseoMaterial: appear name=PaseoMaterialLight supported=true level=0 state=1 propsReceived=props+rawProps materialColor=#8CFFFFFF(from=props) style=regular
PaseoMaterial: effect blur=radius:28,saturation:1.6,brightness:1.08 flowLight=true systemMaterial=skipped(flag)
```

| Line                 | Says                                                                                                                                                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `module loaded`      | The ArkTS module was evaluated at all — once per process, before anything is built.                                                                                                                                                                                       |
| `registered …`       | The shared library registered the two names, their view configs and the prop binder.                                                                                                                                                                                      |
| `appear …`           | One per view instance, at `aboutToAppear`: the variant that was built, material support/computing level/metadata `state`, the channels the props arrived on (`props`, `rawProps`, `props+rawProps`, `none`), and the adopted tint with its source (`default` = built-in). |
| `effect …`           | The values actually painting: the blur parameters, whether the flowing light was added, and whether `.systemMaterial()` was called (`called`, or `skipped(flag)` while the switch is off).                                                                                |
| `flowLight finished` | The HDS scene reported completion — a scene the engine refused would not. Logged once per instance.                                                                                                                                                                       |

## HarmonyOS 7 (API 26) UI capability cheat sheet

Everything below exists in the CLI SDK under `~/deveco/command-line-tools/sdk/default` (OpenHarmony
plus HMS). "Used" is what this repository actually depends on.

| Capability              | Declaration                                                                                                                                                                                                                                  | Where                                            | Used                                                                            |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------- |
| Basic components        | `openharmony/ets/component/*.d.ts` (121 files: `stack.d.ts`, `column.d.ts`, `content_slot.d.ts`, `custom_dialog_controller.d.ts`, …)                                                                                                         | universal attributes and events in `common.d.ts` | `Stack`, `Column`, `ContentSlot`, `.systemMaterial()`, `.backgroundBlurStyle()` |
| Advanced components     | `openharmony/ets/api/@ohos.arkui.advanced.*.d.ets` (`Chip`, `SegmentButton`, `Dialog`, `SubHeader`, `ToolBar`, …)                                                                                                                            | `@kit.ArkUI`                                     | not used                                                                        |
| System material         | `openharmony/ets/api/@ohos.arkui.uiMaterial.d.ts` (`ImmersiveMaterial`, `ImmersiveStyle`, `MaterialState`, `MaterialLevel`, `getMaterialInfo`, `isImmersiveMaterialSupported`), attribute `.systemMaterial(material)`                        | `common.d.ts:22642`; kit `@kit.ArkUI`            | yes — composer card and pills                                                   |
| HDS navigation and bars | `hms/ets/api/@hms.hds.{HdsNavigation,HdsNavDestination,HdsTabs,HdsActionBar,HdsSnackBar,HdsSideBar,HdsSideMenu,HdsListItemCard}`                                                                                                             | `@kit.UIDesignKit`                               | not used                                                                        |
| HDS visual effects      | `hms/ets/api/@hms.hds.HdsVisualComponent.d.ets` (`HdsSceneType.DUAL_EDGE_FLOW_LIGHT_WITH_BACKGROUND_MASK`), `@hms.hds.hdsBaseComponent.d.ets` (`hdsEffect`: `EdgeFlowLightParam`, `PointLightEffect`, `PressShadowType`, `HdsEffectBuilder`) | `@kit.UIDesignKit`                               | not used                                                                        |
| HDS material            | `hms/ets/api/@hms.hds.hdsMaterial.d.ets` (`hdsMaterial`)                                                                                                                                                                                     | `@kit.UIDesignKit`                               | not used                                                                        |

## Foldable and split-window behavior

Follow Huawei's [cross-device application development rules](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/ide-cross-device-app-dev).
The CLI suite does not supply a Codex skill for this work.

Use the current window's logical width, including split-screen changes. The
compact boundary is 720; it is shared with Unistyles. Do not infer layout from the
device model, physical display resolution, screen orientation or platform name.
The Harmony runtime bridge publishes current window bounds, scale, font scale,
safe areas and keyboard insets to Unistyles.

The navigator and editor retain their ancestry while the layout changes between
compact panels and a wide window. Keep the gesture and explorer content hosts
mounted and change their enabled state. Panel motion remains normalized; width
only changes its projection. See [mobile panels](mobile-panels.md).

On Pura X Max, verify these transitions on the real device:

- Type an unsent draft, fold/unfold, rotate and enter/leave split-screen. Check
  the active workspace, draft, selection and focus.
- Resize while a panel drag or animation is active. Check that the panel and its
  backdrop agree and that navigation is committed once.
- Open the keyboard in both compact and wide windows, including a bottom sheet.
  Check that the composer and submit controls remain reachable.
- Change theme and font scale, then repeat the transitions. Check safe areas and
  labels without resetting the native navigator.
- Record/play voice, interrupt playback, background/restore the app, scan a QR
  code, pick a file and paste an image through the attachment menu.

Unit tests cover panel state during resizing; browser tests cover the active
workspace and draft. Browser layouts use a separate split-pane view at wide
widths. Native editor identity, selection and focus require device checks, as does
the device's installed OS version.
