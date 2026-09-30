import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(appRoot, "package.json"));
// RNOH invokes a project-local CLI and Expo's isolated CNG check links only
// project-local dependencies. Materialize links to npm's hoisted packages.
const manifest = JSON.parse(readFileSync(join(appRoot, "package.json"), "utf8"));
for (const name of Object.keys({ ...manifest.dependencies, ...manifest.devDependencies })) {
  const local = join(appRoot, "node_modules", name);
  if (existsSync(local)) continue;
  // Use a package subpath so dependencies named like Node built-ins (buffer)
  // still receive npm search paths after a fresh hoisted installation.
  const packageJson = (require.resolve.paths(`${name}/package.json`) ?? [])
    .map((directory) => join(directory, name, "package.json"))
    .find((candidate) => existsSync(candidate));
  if (!packageJson) throw new Error(`Install the app dependency ${name} before preparing Harmony`);
  mkdirSync(dirname(local), { recursive: true });
  symlinkSync(relative(dirname(local), dirname(packageJson)), local, "dir");
}
const reactNativeCommand = join(appRoot, "node_modules/.bin/react-native");
if (!existsSync(reactNativeCommand)) {
  mkdirSync(dirname(reactNativeCommand), { recursive: true });
  symlinkSync("../react-native/cli.js", reactNativeCommand, "file");
}
const moduleRoot = join(appRoot, "modules/paseo-unistyles");
const cpp = join(moduleRoot, "harmony/library/src/main/cpp");
const generated = join(cpp, "generated");
const unistyles = dirname(require.resolve("react-native-unistyles/package.json"));
const nitro = dirname(
  require.resolve("@react-native-ohos/react-native-nitro-modules/package.json"),
);
const version = JSON.parse(readFileSync(join(unistyles, "package.json"), "utf8")).version;
if (version !== "3.2.4")
  throw new Error(`Review the Harmony native bridge before upgrading Unistyles ${version}`);
const nitrogen = dirname(require.resolve("nitrogen/package.json"));
if (JSON.parse(readFileSync(join(nitrogen, "package.json"), "utf8")).version !== "0.31.10")
  throw new Error("Harmony Unistyles bindings require Nitrogen 0.31.10 for the Nitro 0.31 ABI");

// Ship the pinned upstream C++ implementation in a source HAR. Regenerate its
// bindings for Harmony's Nitro ABI; parsing, theme updates and Fabric stay upstream.
rmSync(generated, { recursive: true, force: true });
mkdirSync(join(generated, "NitroModules"), { recursive: true });
cpSync(join(unistyles, "cxx"), join(generated, "unistyles/cxx"), { recursive: true });
cpSync(join(unistyles, "src"), join(generated, "source/src"), {
  recursive: true,
});
run(
  process.execPath,
  [
    join(nitrogen, "lib/index.js"),
    join(generated, "source/src"),
    "--out",
    join(generated, "bindings"),
    "--config",
    join(moduleRoot, "nitro.json"),
  ],
  moduleRoot,
);
cpSync(join(generated, "bindings/shared/c++"), join(generated, "unistyles/specs"), {
  recursive: true,
});
cpSync(join(cpp, "NativePlatform.h"), join(generated, "unistyles/cxx/NativePlatform.h"));
cpSync(join(unistyles, "README.md"), join(generated, "unistyles/README.md"));
cpSync(join(unistyles, "package.json"), join(generated, "unistyles/UPSTREAM-METADATA.json"));
const nitroHeaders = join(nitro, "harmony/nitro_modules/src/main/cpp/shared");
for (const file of readdirSync(nitroHeaders)) {
  if (file.endsWith(".h") || file.endsWith(".hpp"))
    cpSync(join(nitroHeaders, file), join(generated, "NitroModules", file));
}
cpSync(join(moduleRoot, "NITRO-LICENSE"), join(generated, "NitroModules/LICENSE"));

// The keyboard-controller HAR names its header with a lowercase first letter,
// while RNOH generates an include from the exported C++ class name.
const appCpp = join(appRoot, "harmony/entry/src/main/cpp");
mkdirSync(appCpp, { recursive: true });
const harmonyNpmrc = join(appRoot, "harmony/.npmrc");
if (!existsSync(harmonyNpmrc)) {
  writeFileSync(
    harmonyNpmrc,
    "# Hvigor requires a project npmrc; credentials and CA configuration come from the environment.\nstrict-ssl=true\n",
  );
}
writeFileSync(
  join(appCpp, "KeyboardControllerPackage.h"),
  '#pragma once\n#include "keyboardControllerPackage.h"\n',
);

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit", env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(
  "npm",
  ["run", "harmony:build", "--workspace=@getpaseo/expo-two-way-audio"],
  resolve(appRoot, "../.."),
);
const harmony = join(moduleRoot, "harmony");
run("ohpm", ["install", "--all"], harmony);
run(
  "hvigorw",
  [
    "--mode",
    "module",
    "-p",
    "module=library@default",
    "-p",
    "product=default",
    "-p",
    "buildMode=release",
    "assembleHar",
    "--no-daemon",
  ],
  harmony,
);
cpSync(
  join(harmony, "library/build/default/outputs/default/library.har"),
  join(harmony, "library.har"),
);
