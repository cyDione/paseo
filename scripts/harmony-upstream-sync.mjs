import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { isMainModule } from "./is-main-module.mjs";

export const syncBranch = "automation/harmony-upstream";
const marker = "<!-- paseo-harmony-upstream-sync -->";
const generatedTerminal = "packages/app/src/terminal/webview/terminal-emulator-webview-html.ts";
const botIdentity = [
  "-c",
  "user.name=github-actions[bot]",
  "-c",
  "user.email=41898282+github-actions[bot]@users.noreply.github.com",
];

class CommandError extends Error {
  constructor(executable, result) {
    super(`${executable} failed: ${result.stderr || result.stdout}`);
    this.name = "CommandError";
    this.status = result.status;
  }
}

export class SyncConflictError extends Error {
  constructor(files) {
    super(`Upstream merge conflicts require manual resolution: ${files.join(", ")}`);
    this.name = "SyncConflictError";
    this.files = files;
  }
}

function command(cwd, executable, args, accepted = [0]) {
  const result = spawnSync(executable, args, { cwd, encoding: "utf8" });
  if (result.error) throw result.error;
  if (!accepted.includes(result.status)) throw new CommandError(executable, result);
  return result;
}

function git(cwd, args, accepted) {
  return command(cwd, "git", args, accepted);
}

function outputs(values) {
  if (!process.env.GITHUB_OUTPUT) return;
  for (const [key, value] of Object.entries(values)) {
    if (String(value).includes("\n"))
      throw new Error("Workflow outputs must be single-line values.");
    appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  }
}

export function prepareCandidate({ cwd, upstreamUrl, upstreamRef, outputDir }) {
  if (git(cwd, ["status", "--porcelain"]).stdout.trim()) {
    throw new Error("Upstream sync requires a clean checkout.");
  }
  mkdirSync(outputDir, { recursive: true });
  const baseSha = git(cwd, ["rev-parse", "HEAD"]).stdout.trim();
  git(cwd, ["fetch", "--no-tags", "--", upstreamUrl, upstreamRef]);
  const upstreamSha = git(cwd, ["rev-parse", "FETCH_HEAD"]).stdout.trim();
  const ancestor = git(cwd, ["merge-base", "--is-ancestor", upstreamSha, baseSha], [0, 1]);
  const metadata = { baseSha, upstreamSha, status: "unchanged", conflicts: [] };
  if (ancestor.status === 0) {
    writeFileSync(path.join(outputDir, "metadata.json"), JSON.stringify(metadata, null, 2) + "\n");
    return metadata;
  }
  const merged = git(cwd, [...botIdentity, "merge", "--no-ff", "--no-edit", upstreamSha], [0, 1]);
  if (merged.status !== 0) {
    const files = git(cwd, ["diff", "--name-only", "--diff-filter=U", "-z"])
      .stdout.split("\0")
      .filter(Boolean);
    if (
      existsSync(
        path.join(git(cwd, ["rev-parse", "--absolute-git-dir"]).stdout.trim(), "MERGE_HEAD"),
      )
    ) {
      git(cwd, ["merge", "--abort"]);
    }
    if (files.length === 0) throw new CommandError("git merge", merged);
    metadata.status = "conflict";
    metadata.conflicts = files;
    writeFileSync(path.join(outputDir, "metadata.json"), JSON.stringify(metadata, null, 2) + "\n");
    throw new SyncConflictError(files);
  }
  metadata.status = "merged";
  writeFileSync(path.join(outputDir, "metadata.json"), JSON.stringify(metadata, null, 2) + "\n");
  return metadata;
}

export function sealCandidate({ cwd, outputDir }) {
  const metadata = JSON.parse(readFileSync(path.join(outputDir, "metadata.json"), "utf8"));
  if (metadata.status !== "merged") throw new Error("Only a clean upstream merge can be bundled.");
  const changed = git(cwd, ["diff", "HEAD", "--name-only", "-z"])
    .stdout.split("\0")
    .filter(Boolean);
  const unexpected = changed.filter((file) => file !== generatedTerminal);
  if (unexpected.length)
    throw new Error(`Validation changed unexpected tracked files: ${unexpected.join(", ")}`);
  if (changed.includes(generatedTerminal)) {
    git(cwd, ["add", "--", generatedTerminal]);
    git(cwd, [...botIdentity, "commit", "-m", "chore(harmony): regenerate native terminal HTML"]);
  }
  metadata.candidateSha = git(cwd, ["rev-parse", "HEAD"]).stdout.trim();
  const bundle = path.join(outputDir, "candidate.bundle");
  git(cwd, ["bundle", "create", bundle, "HEAD", `^${metadata.baseSha}`]);
  writeFileSync(path.join(outputDir, "metadata.json"), JSON.stringify(metadata, null, 2) + "\n");
  return metadata;
}

export function publicationPolicy({ javascript, native, autoMerge }) {
  const ready = javascript === "success" && native === "success";
  return { draft: !ready, autoMerge: ready && autoMerge === true };
}

function gh(cwd, args) {
  return command(cwd, "gh", args).stdout.trim();
}

function api(cwd, endpoint, payload, outputDir) {
  const input = path.join(outputDir, "request.json");
  writeFileSync(input, JSON.stringify(payload));
  const method = endpoint.endsWith("/pulls") ? "POST" : "PATCH";
  return JSON.parse(gh(cwd, ["api", endpoint, "--method", method, "--input", input]));
}

function syncPullRequestBody({ metadata, candidate, javascript, native, runUrl }) {
  const jsCheck = javascript === "success" ? "x" : " ";
  const nativeCheck = native === "success" ? "x" : " ";
  return `${marker}
### Linked issue

None. Automated upstream synchronization.

### Type of change

- [x] Enhancement

### Reasoning

Keep the Harmony port current with getpaseo/paseo while retaining downstream native adapters.

### Goals

- Merge upstream commit \`${metadata.upstreamSha}\` into downstream commit \`${metadata.baseSha}\`
- Validate candidate \`${candidate}\` before merging

### Non-goals

- Resolve native API or SDK changes without review
- Sign or publish a production app

### QA

- JavaScript checks: **${javascript}**
- Native Harmony build: **${native}**
- [Validation logs and HAP artifacts](${runUrl})
- Device behavior and signing require hardware validation

### Checklist

- [ ] Plugin changes follow the SDK import boundaries (if applicable)
- [x] One focused upstream synchronization
- [${jsCheck}] \`npm run typecheck\` passes
- [${jsCheck}] \`npm run lint\` passes
- [${jsCheck}] Formatting checks pass
- [x] QA logs linked
- [ ] Tests added or updated where it made sense
- [${nativeCheck}] Unsigned native Harmony Release HAP passes compilation
- [ ] Device validation and review
`;
}

export function publishCandidate({
  cwd,
  outputDir,
  repository,
  baseBranch,
  javascript,
  native,
  autoMerge,
  runUrl,
}) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error("Invalid repository name.");
  git(cwd, ["check-ref-format", "--branch", baseBranch]);
  if (baseBranch === syncBranch)
    throw new Error("The downstream branch cannot be the automation branch.");
  const metadata = JSON.parse(readFileSync(path.join(outputDir, "metadata.json"), "utf8"));
  for (const sha of [metadata.baseSha, metadata.upstreamSha, metadata.candidateSha]) {
    if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error("Invalid candidate commit.");
  }
  const currentBase = git(cwd, ["ls-remote", "origin", `refs/heads/${baseBranch}`]).stdout.split(
    /\s/,
  )[0];
  if (currentBase !== metadata.baseSha)
    throw new Error("The downstream branch changed during validation; rerun sync.");
  git(cwd, ["fetch", path.join(outputDir, "candidate.bundle"), "HEAD"]);
  const candidate = git(cwd, ["rev-parse", "FETCH_HEAD"]).stdout.trim();
  if (candidate !== metadata.candidateSha)
    throw new Error("Candidate bundle does not match its validated commit.");
  git(cwd, ["merge-base", "--is-ancestor", metadata.baseSha, candidate]);
  git(cwd, ["merge-base", "--is-ancestor", metadata.upstreamSha, candidate]);
  const previous = JSON.parse(
    gh(cwd, [
      "pr",
      "list",
      "--repo",
      repository,
      "--base",
      baseBranch,
      "--head",
      syncBranch,
      "--state",
      "all",
      "--limit",
      "50",
      "--json",
      "number,body,state,isDraft,url,autoMergeRequest",
    ]),
  );
  const managed = previous.filter((pr) => pr.body.includes(marker));
  if (previous.some((pr) => pr.state === "OPEN" && !pr.body.includes(marker))) {
    throw new Error("Automation branch has an unmanaged open PR; refusing to replace it.");
  }
  const existing = managed.find((pr) => pr.state === "OPEN");
  const oldSha = git(cwd, ["ls-remote", "origin", `refs/heads/${syncBranch}`]).stdout.split(
    /\s/,
  )[0];
  if (oldSha && managed.length === 0)
    throw new Error(
      "Automation branch already exists without a managed PR; refusing to replace it.",
    );
  if (existing?.autoMergeRequest)
    gh(cwd, ["pr", "merge", String(existing.number), "--repo", repository, "--disable-auto"]);
  const policy = publicationPolicy({ javascript, native, autoMerge });
  if (existing && policy.draft && !existing.isDraft) {
    gh(cwd, ["pr", "ready", String(existing.number), "--repo", repository, "--undo"]);
  }
  git(cwd, [
    "push",
    `--force-with-lease=refs/heads/${syncBranch}:${oldSha}`,
    "origin",
    `${candidate}:refs/heads/${syncBranch}`,
  ]);
  const title = `chore(harmony): sync upstream ${metadata.upstreamSha.slice(0, 12)}`;
  const body = syncPullRequestBody({ metadata, candidate, javascript, native, runUrl });
  let pr;
  if (existing) {
    pr = api(cwd, `repos/${repository}/pulls/${existing.number}`, { title, body }, outputDir);
    if (!policy.draft && existing.isDraft)
      gh(cwd, ["pr", "ready", String(existing.number), "--repo", repository]);
  } else {
    pr = api(
      cwd,
      `repos/${repository}/pulls`,
      { title, body, head: syncBranch, base: baseBranch, draft: policy.draft },
      outputDir,
    );
  }
  if (policy.autoMerge)
    gh(cwd, [
      "pr",
      "merge",
      String(pr.number),
      "--repo",
      repository,
      "--auto",
      "--merge",
      "--match-head-commit",
      candidate,
    ]);
  return pr.html_url;
}

if (isMainModule(import.meta.url)) {
  const cwd = process.cwd();
  const outputDir = path.resolve(process.env.HARMONY_SYNC_DIR ?? ".dev/harmony-sync");
  try {
    switch (process.argv[2]) {
      case "prepare": {
        const metadata = prepareCandidate({
          cwd,
          upstreamUrl: "https://github.com/getpaseo/paseo.git",
          upstreamRef: "main",
          outputDir,
        });
        outputs({
          changed: metadata.status === "merged",
          base_sha: metadata.baseSha,
          upstream_sha: metadata.upstreamSha,
        });
        console.log(`Upstream sync: ${metadata.status} (${metadata.upstreamSha}).`);
        break;
      }
      case "seal": {
        const metadata = sealCandidate({ cwd, outputDir });
        outputs({ candidate_sha: metadata.candidateSha });
        break;
      }
      case "publish": {
        const url = publishCandidate({
          cwd,
          outputDir,
          repository: process.env.GITHUB_REPOSITORY,
          baseBranch: process.env.HARMONY_BASE_BRANCH,
          javascript: process.env.HARMONY_JS_RESULT,
          native: process.env.HARMONY_NATIVE_RESULT,
          autoMerge: process.env.HARMONY_AUTO_MERGE === "true",
          runUrl: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
        });
        console.log(url);
        break;
      }
      default:
        throw new Error("Usage: node scripts/harmony-upstream-sync.mjs prepare|seal|publish");
    }
  } catch (error) {
    console.error(error.message);
    if (process.env.GITHUB_STEP_SUMMARY)
      appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        `### Harmony upstream sync failed\n\n${error.message}\n`,
      );
    process.exitCode = 1;
  }
}
