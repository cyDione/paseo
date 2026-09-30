import { describe, expect, it, vi } from "vitest";
import { runDesktopStartup } from "./desktop-startup";
import { EventEmitter } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadReactDevTools } from "./features/react-devtools";

const devTools = vi.hoisted(() => ({
  userData: "",
  request: vi.fn(),
  loadExtension: vi.fn(),
}));

vi.mock("electron", () => ({
  app: { getPath: () => devTools.userData },
  net: { request: devTools.request },
  session: { defaultSession: { extensions: { loadExtension: devTools.loadExtension } } },
}));

describe("desktop startup", () => {
  it("continues GUI startup when the optional React DevTools download fails", async () => {
    devTools.userData = await mkdtemp(path.join(tmpdir(), "paseo-devtools-startup-"));
    const failure = new Error("Development extension download failed");
    const request = new EventEmitter();
    devTools.request.mockReturnValue(
      Object.assign(request, { end: () => request.emit("error", failure) }),
    );
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const mountWindow = vi.fn();
    try {
      await runDesktopStartup({
        hasPendingGuiLaunchRequest: true,
        runCliPassthroughIfRequested: vi.fn(),
        inheritLoginShellEnv: vi.fn(),
        bootstrapGui: async () => {
          await loadReactDevTools();
          mountWindow();
        },
      });
      expect(mountWindow).toHaveBeenCalledTimes(1);
      expect(warning).toHaveBeenCalledWith("[DevTools] Failed to load React DevTools:", failure);
      expect(devTools.loadExtension).not.toHaveBeenCalled();
    } finally {
      warning.mockRestore();
      await rm(devTools.userData, { recursive: true, force: true });
    }
  });

  it("runs CLI passthrough before GUI login-shell env inheritance", async () => {
    const calls: string[] = [];
    await runDesktopStartup({
      hasPendingGuiLaunchRequest: false,
      runCliPassthroughIfRequested: vi.fn(async () => {
        calls.push("cli");
        return true;
      }),
      inheritLoginShellEnv: vi.fn(() => calls.push("env")),
      bootstrapGui: vi.fn(async () => {
        calls.push("gui");
      }),
    });

    expect(calls).toEqual(["cli"]);
  });

  it("keeps login-shell env inheritance on normal GUI startup", async () => {
    const calls: string[] = [];
    await runDesktopStartup({
      hasPendingGuiLaunchRequest: false,
      runCliPassthroughIfRequested: vi.fn(async () => {
        calls.push("cli");
        return false;
      }),
      inheritLoginShellEnv: vi.fn(() => calls.push("env")),
      bootstrapGui: vi.fn(async () => {
        calls.push("gui");
      }),
    });

    expect(calls).toEqual(["cli", "env", "gui"]);
  });

  it("does not route open-project launches through CLI passthrough", async () => {
    const runCliPassthroughIfRequested = vi.fn(async () => true);
    const calls: string[] = [];

    await runDesktopStartup({
      hasPendingGuiLaunchRequest: true,
      runCliPassthroughIfRequested,
      inheritLoginShellEnv: vi.fn(() => calls.push("env")),
      bootstrapGui: vi.fn(async () => {
        calls.push("gui");
      }),
    });

    expect(runCliPassthroughIfRequested).not.toHaveBeenCalled();
    expect(calls).toEqual(["env", "gui"]);
  });
});
