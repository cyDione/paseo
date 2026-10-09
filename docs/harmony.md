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

## System material (ArkUI)

The composer card and the pills above it are immersive system materials on HarmonyOS. The material
is a component attribute (`.systemMaterial()`), so this is ArkTS: `PaseoMaterialLight` /
`PaseoMaterialDark` in the `paseo-unistyles` HAR wrap the RN children of a surface in a `Stack` that
carries the material. JS reaches them through `MaterialView`
(`packages/app/src/components/ui/material-view.harmony.tsx`), a plain `View` on every other
platform, so call sites stay unconditional. Decorative use only: the components, the transcript and
the material rules below are the whole contract.

### The material contains its content

`ImmersiveOptions.colorInvert` adapts text and icon colors across the material node's _subtree_,
so the RN children sit inside that node — that is what the `ContentSlot` in the middle of the
Stack is for. A material painted on a sibling behind the content can never do that.

The container is the RN node's own box: the C++ mounting manager positions the ArkTS component
through the layout rect it sets on the component's frame node. This component therefore does not
use `RNViewBase` — that struct re-applies `layoutMetrics.frame.origin` as a `position()`, which
would offset any node whose origin is not (0, 0). It applies the corner radius (which is what clips
the material), the border, the border style and the opacity from the descriptor instead.

### The surface is visible without the material and without the props

The material is an enhancement, never the only paint. Two things are applied on every path, before
it:

- A backdrop blur through `.backgroundBlurStyle()` — the device's own, independent of the material.
  The material does not blur at every material level (at low computing power it only affects the
  node's background, border and shadow), so a surface that relied on it alone would show color
  without blur.
- A translucent fill through `.backgroundColor()` — the JS tint when it arrived, the component's
  built-in tint otherwise.

`materialColor` defaults to `Color.Transparent`, and a prop that never arrives leaves the surface
exactly that: transparent, with nothing behind it. The built-in tints exist for that failure.
`material-color.ts` sends `surface0` at 55% on light themes and `surface1` at 55% on dark ones; the
ArkTS side falls back to `#B3FFFFFF` / `#66000000` when it hears nothing at all, and the component
_name_ carries the scheme, so the fallback is right in both themes even if no prop ever reaches the
device. Every fill is translucent by construction — a fully opaque color blocks the material filter,
and the same rule applies to any background set on the container.

The RN side stays transparent for the same reason. `platformChromeMaterialFill`
(`styles/platform-chrome.harmony.ts`) is `transparent` on HarmonyOS and `null` elsewhere, which
`composer/pill-styles.ts` and any other material surface reads inside its `StyleSheet.create`; the
composer card's own entry (`platformChromeStyles.composerCard`) does the same. The card's shadow
comes from the material (`applyShadow`), not from the theme's `shadow.md`.

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
to its built-in default, and prints the raw values, the typed values and the adopted value with its
source. A prop that only ever travels on one channel, or on neither, is visible in the log instead
of turning into a silent default.

### Application-level switch

The entry module's `module.json5` metadata carries
`{ "name": "ohos.arkui.UIMaterial.state", "value": "enable" }`. `packages/app/harmony` is generated
by prebuild, so the key comes from the local config plugin
`packages/app/plugins/with-harmony-system-material.js` (through `withModuleJson`), not from a file
in the checkout. The key name comes from Huawei's "开启沉浸光感" documentation and is not present in
the SDK declarations; `uiMaterial.getMaterialInfo().state` — the `state=` field of the log line
below — is how you confirm the system read it.

### Degradation and diagnostics

Every `uiMaterial` API is `@since 26.0.0` while the app's compatible SDK version is 23, so ArkTS
warns on each use and the component gates on `deviceInfo.sdkApiVersion >= 26` — the probe the
compiler's own suggestion (`deviceInfo.apiAvailable`) is too new to be. Older devices take the
degraded path instead of touching the module.

`uiMaterial.isImmersiveMaterialSupported()` gates the material per component on top of that. When
it is false the material is simply not created (`path=degraded` in the log) and the blur plus fill
described above are all the surface gets. `getGlobalMaterialLevel()` reports how much the device can
do at all, and the material has different effects per level: at `SMOOTH` it drives the node's
background, border and shadow — but does not blur, which is why the backdrop blur is applied
unconditionally; at `EXQUISITE` and `GENTLE` it adds the filter, light and shadow over the fill.

Two tints are on by default and are meant to be turned off (or deleted with their constants) once
the material is verified on a device:

| Signal                                        | Meaning                                                                                     | Where                                                      |
| --------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Red translucent fill, `rgba(255, 0, 0, 0.25)` | The native view never registered or threw while rendering, so the surface is a plain `View` | `MATERIAL_DIAGNOSTIC_TINTS` in `material-view.harmony.tsx` |
| Orange cast mixed into the fill               | The material degraded to the backdrop-blur path                                             | `materialDegradedFillColor` in `material-color.ts`         |
| No tint                                       | The system material applied                                                                 | —                                                          |

`hdc hilog | grep PaseoMaterial` prints one line per material change:

```
PaseoMaterial: view=PaseoMaterialLight scheme=light api=26 supported=true level=0 state=1
PaseoMaterial: raw props thickness=regular materialColor=#8CFFFFFF lightColor=#80FFFFFF interactive=true applyShadow=true
PaseoMaterial: typed props thickness=regular materialColor=#8CFFFFFF lightColor=#80FFFFFF
PaseoMaterial: adopted style=regular tint=#8CFFFFFF(js|default=props) light=#80FFFFFF(js|default=props) degraded=#8CFFE7CC(js|default=props) interactive=true applyShadow=true blur=1 path=material
```

The first line is the device: `view`/`scheme` is the component name that was built, `api=` its SDK
version (the guard behind it, see above), `supported=`/`level=`/`state=` the material support,
computing level and — `state=1` — that ArkUI read the metadata key from the section below. `level`
and `state` read `-1` when the material APIs do not exist on the system.

The next two lines are the two prop channels verbatim, and the last line is what was adopted: the
`js|default=` fields name the channel each value came from (`props`, `rawProps`, or `default` for
the built-in tint). `path=material` means the material was created and set; `path=degraded` means it
was not, and only the blur and fill paint.

### The floating composer

The composer floats over the transcript on HarmonyOS so the material has content to blur: the
transcript runs to the bottom of the pane and passes under the card, and the card's own box is the
only thing above it. `packages/app/src/composer/dock/overlay-layout.ts` /
`overlay-layout.harmony.ts` decide whether the platform can do this, and `ComposerDock`'s
`overlayContent` prop decides which panes ask for it. Only the agent chat pane does: the draft and
new-workspace docks put a setup form under the composer, and a floating composer would leave that
form's bottom under a card.

The dock measures the floating composer and publishes the height through
`ComposerOverlayHeightContext`; `agent-panel.tsx` adds it to the transcript's tail and
scroll-control clearance (`resolveComposerOverlayInset`, `composer/dock/internal/overlay-clearance.ts`)
and the pill strip takes it as its own `bottom`, so the pills stay directly on the card. The
composer keeps its place inside `KeyboardTranslateView`: the whole surface moves with the keyboard,
and `ComposerViewportContent`'s capacity bound still limits how tall the card may grow.

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
