import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative as relativePath } from "node:path";
import test from "node:test";
import {
  prepareCandidate,
  sealCandidate,
  publishCandidate,
  publicationPolicy,
  SyncConflictError,
} from "./harmony-upstream-sync.mjs";

const repoRoot = new URL("../", import.meta.url);
const ciWorkflowPath = new URL(".github/workflows/ci.yml", repoRoot);
const dockerWorkflowPath = new URL(".github/workflows/docker.yml", repoRoot);
const nixWorkflowPath = new URL(".github/workflows/nix.yml", repoRoot);
const filtersPath = new URL(".github/ci-paths.yml", repoRoot);
const serverTsconfigPath = new URL("packages/server/tsconfig.server.json", repoRoot);
const desktopPackagePath = new URL("packages/desktop/package.json", repoRoot);

const gatedCiJobs = new Map([
  ["format", { name: "format", contract: "format" }],
  ["lint", { name: "lint", contract: "quality" }],
  ["typecheck", { name: "typecheck", contract: "quality" }],
  ["server-tests-ubuntu", { name: "server-tests (ubuntu-latest)", contracts: ["server", "hub"] }],
  ["server-tests-windows", { name: "server-tests (windows-latest)", contracts: ["server", "hub"] }],
  ["server-tests-macos", { name: "server-tests (macos-14, file observation)", contract: "server" }],
  ["desktop-tests-ubuntu", { name: "desktop-tests (ubuntu-latest)", contract: "desktop" }],
  ["desktop-tests-windows", { name: "desktop-tests (windows-latest)", contract: "desktop" }],
  ["app-tests", { name: "app-tests", contract: "app" }],
  ["sdk-tests", { name: "sdk-tests", contract: "sdk" }],
  ["playwright-1", { name: "playwright (shard 1/4)", contract: "browser" }],
  ["playwright-2", { name: "playwright (shard 2/4)", contract: "browser" }],
  ["playwright-3", { name: "playwright (shard 3/4)", contract: "browser" }],
  ["playwright-4", { name: "playwright (shard 4/4)", contract: "browser" }],
  ["relay-tests", { name: "relay-tests", contract: "relay" }],
  ["cli-tests-1", { name: "cli-tests (shard 1/3)", contract: "cli" }],
  ["cli-tests-2", { name: "cli-tests (shard 2/3)", contract: "cli" }],
  ["cli-tests-3", { name: "cli-tests (shard 3/3)", contract: "cli" }],
]);

function jobBlocks(source) {
  const jobs = new Map();
  let currentJob;

  for (const line of source.split("\n")) {
    const jobMatch = /^  ([a-z0-9-]+):\s*$/.exec(line);
    if (jobMatch) {
      currentJob = jobMatch[1];
      jobs.set(currentJob, []);
      continue;
    }
    if (currentJob) jobs.get(currentJob).push(line);
  }
  return jobs;
}

function loadFilters(path) {
  const filters = {};
  let currentFilter;

  for (const line of readFileSync(path, "utf8").split("\n")) {
    const filterMatch = /^([a-z_]+):\s*$/.exec(line);
    if (filterMatch) {
      currentFilter = filterMatch[1];
      filters[currentFilter] = [];
      continue;
    }
    const patternMatch = /^  - "([^"]+)"\s*$/.exec(line);
    if (currentFilter && patternMatch) filters[currentFilter].push(patternMatch[1]);
  }
  return filters;
}

function filesUnder(relativeDirectory, predicate) {
  const directory = new URL(`${relativeDirectory}/`, repoRoot);
  return readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) =>
      [relativeDirectory, relativePath(directory.pathname, entry.parentPath), entry.name]
        .filter(Boolean)
        .join("/")
        .replaceAll("\\", "/"),
    )
    .filter(predicate)
    .sort();
}

test("gated checks are statically named jobs with real job-level gating", () => {
  const workflowSource = readFileSync(ciWorkflowPath, "utf8");
  const jobs = jobBlocks(workflowSource);
  const trigger = workflowSource.split("jobs:", 1)[0];

  assert.match(trigger, /^\s+merge_group:\s*$/m);
  assert.doesNotMatch(workflowSource, /strategy:\s*\n\s+matrix:/);
  assert.doesNotMatch(workflowSource, /RUN_TESTS|Skip unaffected|No .* changes detected/);

  for (const [jobId, expected] of gatedCiJobs) {
    const job = jobs.get(jobId)?.join("\n");
    assert.ok(job, `missing static job ${jobId}`);
    assert.match(job, new RegExp(`^    name: ${expected.name.replace(/[()]/g, "\\$&")}$`, "m"));
    assert.match(job, /needs\.changes\.outputs\.full != 'false'/);
    for (const contract of expected.contracts ?? [expected.contract]) {
      assert.match(job, new RegExp(`needs\\.changes\\.outputs\\.${contract} != 'false'`));
    }
  }
});

test("change gating allows superseded workflow runs to cancel", () => {
  for (const workflowPath of [ciWorkflowPath, dockerWorkflowPath, nixWorkflowPath]) {
    const source = readFileSync(workflowPath, "utf8");
    assert.doesNotMatch(
      source,
      /\$\{\{\s*always\(\)/,
      "always() keeps jobs alive after concurrency cancellation; use !cancelled() for fail-open gating",
    );
  }
});

test("focused contracts stay inside existing required checks", () => {
  const jobs = jobBlocks(readFileSync(ciWorkflowPath, "utf8"));
  const changes = jobs.get("changes")?.join("\n") ?? "";
  const server = jobs.get("server-tests-ubuntu")?.join("\n") ?? "";
  const desktop = jobs.get("desktop-tests-ubuntu")?.join("\n") ?? "";

  assert.match(changes, /scripts\/daemon-launch-contract\.test\.mjs/);
  assert.doesNotMatch(changes, /Install dependencies|npm run build/);

  assert.match(server, /test:hub-cli-contract/);
  assert.match(server, /npm run test --workspace=@getpaseo\/server/);
  assert.ok(!jobs.has("hub-cli-contract"));

  assert.match(desktop, /test:e2e:renderer/);
  assert.match(desktop, /test:e2e:browser-tabs/);
  assert.match(desktop, /npm run test --workspace=@getpaseo\/desktop/);
  assert.ok(!jobs.has("desktop-browser-bridge"));
  assert.ok(!jobs.has("playwright-desktop"));
});

test("server builds exclude test utilities at every domain depth", () => {
  const tsconfig = JSON.parse(readFileSync(serverTsconfigPath, "utf8"));
  assert.ok(tsconfig.exclude.includes("src/server/**/test-utils/**"));
  assert.ok(!tsconfig.exclude.includes("src/server/test-utils/**"));
});

test("PR routing declares stable behavior ownership", () => {
  const filters = loadFilters(filtersPath);
  assert.deepEqual(filters, {
    routing: [".github/ci-paths.yml"],
    workspace: [
      ".mise.toml",
      ".tool-versions",
      "package.json",
      "package-lock.json",
      "patches/**",
      "scripts/**",
      "tsconfig.json",
      "tsconfig.base.json",
      "vitest.config.ts",
    ],
    ci: [".github/actions/**", ".github/workflows/ci.yml"],
    format: [
      ".agents/**/*.{cjs,css,html,js,json,jsonc,jsx,md,mjs,ts,tsx,yaml,yml}",
      ".github/**/*.{cjs,css,html,js,json,jsonc,jsx,md,mjs,ts,tsx,yaml,yml}",
      "**/*.{cjs,css,html,js,json,jsonc,jsx,md,mjs,ts,tsx,yaml,yml}",
      "packages/expo-two-way-audio/**",
    ],
    quality: ["**/*.{cjs,js,json,jsx,mjs,ts,tsx}", "packages/expo-two-way-audio/**"],
    hub: ["packages/cli/src/commands/hub/**", "packages/server/src/server/hub/**"],
    server: ["plugins/**", "packages/server/**", "packages/app/e2e/support/fixtures/recording.*"],
    desktop: [
      "packages/desktop/**",
      "packages/app/src/desktop/**",
      "packages/server/src/server/browser-tools/**",
      "packages/app/e2e/support/**",
      "packages/app/*config.{cjs,js,ts}",
      "packages/app/package.json",
    ],
    app: ["packages/app/**", "packages/expo-two-way-audio/**"],
    sdk: [
      "packages/plugin/**",
      "plugin-examples/**",
      "public-docs/plugins/**",
      "packages/client/**",
      "packages/highlight/**",
      "packages/protocol/**",
    ],
    browser: [
      "packages/server/src/server/agent/provider-snapshot-manager.ts",
      "packages/server/src/server/session/provider/provider-catalog-session.ts",
      "packages/client/src/compat/normalize-provider-models.ts",
      "packages/protocol/src/client-capabilities.ts",
      "packages/server/src/server/agent/provider-registry.ts",
      "packages/server/src/server/agent/agent-sdk-types.ts",
      "packages/server/src/server/agent/providers/codex-app-server-agent.ts",
      "packages/server/src/server/agent/providers/claude/agent.ts",
      "packages/server/src/server/agent/plugin-provider.ts",
      "packages/server/src/server/plugins/{index,plugin-process,plugin-process-protocol,runtime}.ts",
      "packages/server/src/executable-resolution/**",
      "packages/plugin/src/server/provider.ts",
      "packages/app/src/!(desktop)/**",
      "packages/app/e2e/browser/**",
      "packages/app/e2e/support/**",
      "packages/app/assets/**",
      "packages/app/public/**",
      "packages/app/index.ts",
      "packages/app/*config.{cjs,js,ts}",
      "packages/app/package.json",
    ],
    relay: ["packages/relay/**"],
    cli: ["packages/cli/**"],
  });
});

test("cross-package invariants live in the suite that owns them", () => {
  const cliTests = filesUnder("packages/cli", (path) => path.endsWith(".test.ts"));
  assert.ok(cliTests.length > 0);
  for (const path of cliTests) {
    assert.doesNotMatch(
      readFileSync(new URL(path, repoRoot), "utf8"),
      /server\/src\/server\/test-utils/,
      path,
    );
  }

  const protocolWireCompatibility = new URL(
    "packages/protocol/src/messages.wire-compat.test.ts",
    repoRoot,
  );
  assert.match(readFileSync(protocolWireCompatibility, "utf8"), /wire schema compatibility/);
});

test("browser and desktop tests have exclusive, directory-owned suites", () => {
  const filters = loadFilters(filtersPath);
  const browserSpecs = filesUnder("packages/app/e2e", (path) => path.endsWith(".spec.ts"));
  const desktopSpecs = filesUnder("packages/desktop/e2e", (path) => path.endsWith(".spec.ts"));
  const electronModules = filesUnder("packages/app/src", (path) => /\.electron\.tsx?$/.test(path));

  assert.ok(browserSpecs.length > 0);
  assert.ok(desktopSpecs.length > 0);
  assert.ok(browserSpecs.every((path) => path.startsWith("packages/app/e2e/browser/")));
  assert.ok(desktopSpecs.every((path) => path.startsWith("packages/desktop/e2e/")));
  assert.ok(electronModules.every((path) => path.startsWith("packages/app/src/desktop/")));

  const desktopPackage = JSON.parse(readFileSync(desktopPackagePath, "utf8"));
  assert.match(desktopPackage.scripts.test, /--exclude ["']e2e\/\*\*["']/);

  for (const path of browserSpecs) {
    assert.doesNotMatch(
      readFileSync(new URL(path, repoRoot), "utf8"),
      /paseoDesktop|injectDesktopBridge/,
    );
  }
  for (const path of desktopSpecs) {
    assert.ok(path.startsWith("packages/desktop/e2e/"));
  }

  const routingSource = readFileSync(filtersPath, "utf8");
  assert.doesNotMatch(routingSource, /desktop_bridge|playwright_desktop|browser-\*|browser-\*\//);
  assert.deepEqual(filters.desktop, [
    "packages/desktop/**",
    "packages/app/src/desktop/**",
    "packages/server/src/server/browser-tools/**",
    "packages/app/e2e/support/**",
    "packages/app/*config.{cjs,js,ts}",
    "packages/app/package.json",
  ]);
  assert.deepEqual(filters.browser, [
    "packages/server/src/server/agent/provider-snapshot-manager.ts",
    "packages/server/src/server/session/provider/provider-catalog-session.ts",
    "packages/client/src/compat/normalize-provider-models.ts",
    "packages/protocol/src/client-capabilities.ts",
    "packages/server/src/server/agent/provider-registry.ts",
    "packages/server/src/server/agent/agent-sdk-types.ts",
    "packages/server/src/server/agent/providers/codex-app-server-agent.ts",
    "packages/server/src/server/agent/providers/claude/agent.ts",
    "packages/server/src/server/agent/plugin-provider.ts",
    "packages/server/src/server/plugins/{index,plugin-process,plugin-process-protocol,runtime}.ts",
    "packages/server/src/executable-resolution/**",
    "packages/plugin/src/server/provider.ts",
    "packages/app/src/!(desktop)/**",
    "packages/app/e2e/browser/**",
    "packages/app/e2e/support/**",
    "packages/app/assets/**",
    "packages/app/public/**",
    "packages/app/index.ts",
    "packages/app/*config.{cjs,js,ts}",
    "packages/app/package.json",
  ]);
});

test("packaging runs on main without allocating pull-request runners", () => {
  for (const workflowPath of [dockerWorkflowPath, nixWorkflowPath]) {
    const source = readFileSync(workflowPath, "utf8");
    const trigger = source.split("jobs:", 1)[0];
    assert.match(trigger, /push:\s*\n\s+branches: \[main\]/);
    assert.doesNotMatch(trigger, /pull_request/);
    assert.doesNotMatch(source, /dorny\/paths-filter/);
  }
});

test("desktop packaging smokes main pushes and only the pull requests that touch packaging", () => {
  const source = readFileSync(new URL(".github/workflows/desktop-packages.yml", repoRoot), "utf8");
  const trigger = source.split("jobs:", 1)[0];
  assert.match(trigger, /push:\s*\n\s+branches: \[main\]/);
  assert.match(trigger, /pull_request:\s*\n\s+branches: \[main\]\s*\n\s+paths:/);
  assert.match(trigger, /- "packages\/desktop\/\*\*"/);
  assert.doesNotMatch(source, /dorny\/paths-filter/);
  for (const action of ["actions/checkout", "actions/setup-node", "actions/upload-artifact"]) {
    assert.match(source, new RegExp(`${action}@[0-9a-f]{40} # v\\d+\\.\\d+\\.\\d+`));
  }
});

function fixtureGit(cwd, ...args) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function commitFixture(cwd, filename, contents) {
  const file = join(cwd, filename);
  mkdirSync(join(file, ".."), { recursive: true });
  writeFileSync(file, contents);
  fixtureGit(cwd, "add", "--", filename);
  fixtureGit(cwd, "commit", "-m", `Change ${filename}`);
}

function harmonySyncFixture(t) {
  const directory = mkdtempSync(join(tmpdir(), "paseo-harmony-sync-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const upstream = join(directory, "upstream");
  const downstream = join(directory, "downstream");
  const outputDir = join(directory, "candidate");
  mkdirSync(upstream);
  fixtureGit(upstream, "init", "--initial-branch=main");
  fixtureGit(upstream, "config", "user.name", "Fixture");
  fixtureGit(upstream, "config", "user.email", "fixture@example.invalid");
  commitFixture(upstream, "shared.txt", "original\n");
  commitFixture(
    upstream,
    "packages/app/src/terminal/webview/terminal-emulator-webview-html.ts",
    "original terminal\n",
  );
  fixtureGit(directory, "clone", upstream, downstream);
  fixtureGit(downstream, "config", "user.name", "Fixture");
  fixtureGit(downstream, "config", "user.email", "fixture@example.invalid");
  commitFixture(downstream, "harmony.txt", "native port\n");
  return { directory, upstream, downstream, outputDir };
}

function mergeFixture(fixture) {
  return prepareCandidate({
    cwd: fixture.downstream,
    upstreamUrl: fixture.upstream,
    upstreamRef: "main",
    outputDir: fixture.outputDir,
  });
}

test("Harmony sync retains the native port and transports the exact merged code between jobs", (t) => {
  const fixture = harmonySyncFixture(t);
  commitFixture(fixture.upstream, "new-feature.txt", "upstream feature\n");
  const prepared = mergeFixture(fixture);
  assert.equal(prepared.status, "merged");
  assert.equal(readFileSync(join(fixture.downstream, "harmony.txt"), "utf8"), "native port\n");
  const sealed = sealCandidate({ cwd: fixture.downstream, outputDir: fixture.outputDir });
  const receiver = join(fixture.directory, "receiver");
  fixtureGit(fixture.directory, "clone", fixture.downstream, receiver);
  fixtureGit(receiver, "checkout", "--detach", prepared.baseSha);
  fixtureGit(receiver, "fetch", join(fixture.outputDir, "candidate.bundle"), "HEAD");
  assert.equal(fixtureGit(receiver, "rev-parse", "FETCH_HEAD"), sealed.candidateSha);
  fixtureGit(receiver, "checkout", "--detach", "FETCH_HEAD");
  assert.equal(readFileSync(join(receiver, "new-feature.txt"), "utf8"), "upstream feature\n");
  assert.equal(readFileSync(join(receiver, "harmony.txt"), "utf8"), "native port\n");
});

test("Harmony sync does not produce updates when upstream is already included", (t) => {
  const fixture = harmonySyncFixture(t);
  const before = fixtureGit(fixture.downstream, "rev-parse", "HEAD");
  assert.equal(mergeFixture(fixture).status, "unchanged");
  assert.equal(fixtureGit(fixture.downstream, "rev-parse", "HEAD"), before);
  assert.equal(existsSync(join(fixture.outputDir, "candidate.bundle")), false);
});

test("Harmony sync aborts a conflict, retains downstream content and records diagnostics", (t) => {
  const fixture = harmonySyncFixture(t);
  commitFixture(fixture.downstream, "shared.txt", "Harmony version\n");
  commitFixture(fixture.upstream, "shared.txt", "upstream version\n");
  const before = fixtureGit(fixture.downstream, "rev-parse", "HEAD");
  assert.throws(
    () => mergeFixture(fixture),
    (error) => {
      assert.ok(error instanceof SyncConflictError);
      assert.deepEqual(error.files, ["shared.txt"]);
      return true;
    },
  );
  assert.equal(fixtureGit(fixture.downstream, "rev-parse", "HEAD"), before);
  assert.equal(fixtureGit(fixture.downstream, "status", "--porcelain"), "");
  assert.equal(readFileSync(join(fixture.downstream, "shared.txt"), "utf8"), "Harmony version\n");
  const report = JSON.parse(readFileSync(join(fixture.outputDir, "metadata.json"), "utf8"));
  assert.deepEqual(
    { status: report.status, conflicts: report.conflicts },
    { status: "conflict", conflicts: ["shared.txt"] },
  );
  assert.throws(
    () => sealCandidate({ cwd: fixture.downstream, outputDir: fixture.outputDir }),
    /clean upstream merge/,
  );
});

test("Harmony sync refuses dirty checkouts and preserves the uncommitted file", (t) => {
  const fixture = harmonySyncFixture(t);
  writeFileSync(join(fixture.downstream, "user-draft.txt"), "unsaved work\n");
  assert.throws(() => mergeFixture(fixture), /clean checkout/);
  assert.equal(readFileSync(join(fixture.downstream, "user-draft.txt"), "utf8"), "unsaved work\n");
});

test("Harmony sync includes regenerated native terminal HTML in the checked candidate", (t) => {
  const fixture = harmonySyncFixture(t);
  commitFixture(fixture.upstream, "new-feature.txt", "upstream feature\n");
  mergeFixture(fixture);
  const terminal = "packages/app/src/terminal/webview/terminal-emulator-webview-html.ts";
  writeFileSync(join(fixture.downstream, terminal), "regenerated native terminal\n");
  const sealed = sealCandidate({ cwd: fixture.downstream, outputDir: fixture.outputDir });
  assert.equal(
    fixtureGit(fixture.downstream, "show", `${sealed.candidateSha}:${terminal}`),
    "regenerated native terminal",
  );
  assert.equal(fixtureGit(fixture.downstream, "status", "--porcelain"), "");
});

test("Harmony sync refuses to commit unrelated changes from validation", (t) => {
  const fixture = harmonySyncFixture(t);
  commitFixture(fixture.upstream, "new-feature.txt", "upstream feature\n");
  mergeFixture(fixture);
  writeFileSync(join(fixture.downstream, "shared.txt"), "unexpected mutation\n");
  assert.throws(
    () => sealCandidate({ cwd: fixture.downstream, outputDir: fixture.outputDir }),
    /unexpected tracked files: shared.txt/,
  );
  assert.equal(existsSync(join(fixture.outputDir, "candidate.bundle")), false);
});

test("Harmony publishing stops if the downstream branch moves while validation runs", (t) => {
  const fixture = harmonySyncFixture(t);
  const origin = join(fixture.directory, "origin.git");
  fixtureGit(fixture.directory, "clone", "--bare", fixture.downstream, origin);
  fixtureGit(fixture.downstream, "remote", "set-url", "origin", origin);
  commitFixture(fixture.upstream, "new-feature.txt", "upstream feature\n");
  mergeFixture(fixture);
  sealCandidate({ cwd: fixture.downstream, outputDir: fixture.outputDir });
  fixtureGit(fixture.downstream, "push", "origin", "HEAD:main");
  assert.throws(
    () =>
      publishCandidate({
        cwd: fixture.downstream,
        outputDir: fixture.outputDir,
        repository: "fixture/paseo",
        baseBranch: "main",
        javascript: "success",
        native: "success",
        autoMerge: false,
        runUrl: "https://example.invalid/run",
      }),
    /changed during validation/,
  );
});

test("Harmony updates stay draft and never auto-merge without both successful checks", () => {
  for (const native of ["skipped", "failure", "cancelled"]) {
    assert.deepEqual(publicationPolicy({ javascript: "success", native, autoMerge: true }), {
      draft: true,
      autoMerge: false,
    });
  }
  assert.deepEqual(
    publicationPolicy({ javascript: "failure", native: "success", autoMerge: true }),
    { draft: true, autoMerge: false },
  );
  assert.deepEqual(
    publicationPolicy({ javascript: "success", native: "success", autoMerge: false }),
    { draft: false, autoMerge: false },
  );
  assert.deepEqual(
    publicationPolicy({ javascript: "success", native: "success", autoMerge: true }),
    { draft: false, autoMerge: true },
  );
});

test("Harmony hosted runners verify the community SDK against pinned digests", () => {
  const source = readFileSync(
    new URL(".github/workflows/harmony-upstream-sync.yml", repoRoot),
    "utf8",
  );
  const native = jobBlocks(source).get("native").join("\n");
  for (const name of [
    "HARMONY_SDK_PART_AA_SHA256",
    "HARMONY_SDK_PART_AB_SHA256",
    "HARMONY_SDK_SHA256",
  ]) {
    assert.match(native, new RegExp(`${name}: [0-9a-f]{64}\\n`));
  }
  assert.match(
    native,
    /HARMONY_SDK_URL: https:\/\/github\.com\/ErBWs\/ohos-sdk\/releases\/download\/26\.0\.0\.821\//,
  );
  assert.match(native, /sha256sum -c -/);
  assert.match(native, /= "\$HARMONY_SDK_SHA256"/);
  // Every action stays pinned to a commit, including the ones added for hosted runners.
  for (const [, ref] of native.matchAll(/uses: [\w.-]+\/[\w.-]+@(\S+)/g)) {
    assert.match(ref, /^[0-9a-f]{40}$/);
  }
  // SDK libraries must not shadow Node's libraries for the whole job.
  assert.doesNotMatch(native, /\n\s+echo "LD_LIBRARY_PATH=/);
});

test("Harmony sync validates with read-only credentials and publishes from the trusted base", () => {
  const source = readFileSync(
    new URL(".github/workflows/harmony-upstream-sync.yml", repoRoot),
    "utf8",
  );
  const jobs = jobBlocks(source);
  const prepare = jobs.get("prepare").join("\n");
  const native = jobs.get("native").join("\n");
  const publish = jobs.get("publish").join("\n");
  assert.match(source.split("jobs:", 1)[0], /permissions:\s*\n\s+contents: read/);
  assert.doesNotMatch(prepare, /contents: write|GH_TOKEN:/);
  assert.doesNotMatch(native, /contents: write|GH_TOKEN:/);
  assert.match(native, /HARMONY_NATIVE_CI_ENABLED == 'true'/);
  assert.match(native, /npm run harmony:build/);
  assert.match(native, /\|\| 'ubuntu-latest'/);
  assert.match(native, /vars\.HARMONY_RUNNER_LABEL/);
  assert.match(native, /npm run build:app-deps/);
  assert.match(
    native,
    /rm -rf packages\/app\/harmony\n\s+npm exec --workspace=@getpaseo\/app -- expo-harmony prebuild/,
  );
  assert.match(publish, /contents: write\s*\n\s+pull-requests: write/);
  assert.match(publish, /ref: \$\{\{ needs\.prepare\.outputs\.base_sha \}\}/);
  assert.doesNotMatch(publish, /npm ci|npm run/);
  assert.match(publish, /HARMONY_AUTO_MERGE:.*\|\| 'false'/);
});
