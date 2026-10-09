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

## System material glass layer

`PaseoGlassThin`, `PaseoGlassRegular` and `PaseoGlassThick` are Fabric views that
apply the API 26 immersive system material (`NODE_SYSTEM_MATERIAL`). JS reaches
them through `GlassLayer` (`packages/app/src/components/ui/glass-layer.*`), a
no-op on every other platform, so call sites stay unconditional. The layer is
absolutely positioned under the surface's content, takes no part in layout and
drops pointer events, so a surface only has to give it the same corner radius and
an empty fill.

### The material needs a color to be visible

`OH_ArkUI_NativeModule_ImmersiveMaterial_Create` on its own produces something you
cannot see. `native_material.h` states that an unset material color is transparent
at the EXQUISITE and GENTLE device levels, and only SMOOTH devices substitute a
default background color — a material without `SetMaterialColor` is an invisible
sheet over whatever the app drew. That is why the first version of this layer
showed nothing. A material keeps the values it was created with, so the other
knobs are set in the same pass: `SetApplyShadow` (material shadow, which takes
precedence over the general shadow property), `SetInteractive` (press response) and
the light effect (`LightEffectOptions_Create` → `_SetColor` → `SetLightEffect`).

`PaseoGlassProps` (`cpp/glass/GlassShadowNodes.*`) carries `materialColor`,
`lightColor` (0 disables the light effect), `interactive` and `applyShadow` as raw
props; the components are hand-registered, so nothing reads a generated spec. The
colors travel as signed 32-bit ints holding 0xAARRGGBB bits because `RawValue` only
casts to `int`: JS applies `| 0` and the native side casts back to `uint32_t`.
`GlassComponentInstance::onPropsChanged` rebuilds the material from that props set
and skips the work when none of the four values changed.

Tints are derived from theme tokens in a `withUnistyles` mapper
(`glass-layer.harmony.tsx`) and computed in `components/ui/glass-color.ts`: light
themes use `surface0` at 55% alpha, dark themes `surface1` at 55%, `tone="accent"`
swaps in the accent token at 25%, and the light effect is white at 50% (light) or
25% (dark). Only the light-effect white is a literal; unit tests pin the alpha byte
and the scheme mapping.

### Where the layer sits

| Surface                                                          | Thickness | Fill override                                               |
| ---------------------------------------------------------------- | --------- | ----------------------------------------------------------- |
| Circular header icon buttons                                     | `regular` | `platformChromeStyles.headerButton`                         |
| Composer card                                                    | `regular` | `platformChromeStyles.composerCard`                         |
| `AdaptiveModalSheet` compact sheet background and desktop card   | `thick`   | `platformChromeGlassFill`, `platformChromeStyles.modalCard` |
| Menu popovers (`menu-overlay.tsx`, `combobox.tsx` desktop panel) | `regular` | `platformChromeStyles.menuPanel`                            |
| Menu and combobox compact sheets                                 | `regular` | `platformChromeGlassFill`                                   |
| Compact left sidebar drawer                                      | `thick`   | `platformChromeGlassFill`                                   |

Every surface has to hand its own fill to the layer; an opaque `backgroundColor`
covers the material. `platformChromeStyles` entries are for ordinary views, while
the bottom-sheet backgrounds and the drawer are Reanimated `Animated.View`s and
take the plain `platformChromeGlassFill` object instead, because a registered style
on those nodes can crash on theme change ([Unistyles gotchas](unistyles.md)).
`GLASS_LAYER_ENABLED` is exported by `glass-layer.tsx` (false) and
`glass-layer.harmony.tsx` (true) for the one case where a shared call site has to
render differently on Harmony — `header-toggle-button.tsx` wraps its children in a
state function only there.

### Failure and logging

The native sources live in the `paseo-unistyles` HAR (`cpp/glass/`) because the
view has no HAR of its own yet; give it one if the material is kept. The material
APIs are introduced in API 26 while the app supports API 23, so `GlassStackNode.cpp`
resolves every one of them from `libace_ndk.z.so` with `dlopen`/`dlsym` at runtime.
Linking them directly would make `libpaseo_unistyles.so` unloadable on older system
images. A missing symbol skips that knob and logs it; if `SetMaterialColor` itself is
missing or rejects the color, the material cannot be visible and the view degrades
instead. That fallback is `NODE_BACKDROP_BLUR` plus `NODE_BACKGROUND_COLOR` set to
the same material color, so a degraded layer still reads as tinted frosted glass
rather than disappearing again. The JS layer is wrapped in an error boundary, so a
HAP that skipped the native registration renders nothing instead of failing the
surface. Nothing here throws or aborts.

`hdc hilog | grep PaseoGlass` prints the support flag, the device material level, the
style and the requested values, the return code of each knob (`SetMaterialColor`,
`SetApplyShadow`, `SetInteractive`, `LightEffectOptions_SetColor`, `SetLightEffect`),
the `setAttribute(NODE_SYSTEM_MATERIAL)` status, the degradation reason when one was
taken, and the live glass view count on create and destroy.

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
