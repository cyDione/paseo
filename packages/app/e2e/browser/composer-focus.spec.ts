import { expect, test } from "../support/fixtures";
import {
  expectComposerDraft,
  expectComposerFocused,
  expectComposerVisible,
  fillComposerDraft,
  submitMessage,
  typeIntoFocusedComposer,
} from "../support/helpers/composer";
import { openAgentRoute, seedMockAgentWorkspace } from "../support/helpers/mock-agent";

test("submitting a message leaves the composer ready for the next message", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  const agent = await seedMockAgentWorkspace({
    repoPrefix: "composer-focus-",
    title: "Composer focus",
  });

  try {
    await openAgentRoute(page, agent);
    await expectComposerVisible(page);

    await submitMessage(page, "First message");
    await expectComposerFocused(page);

    await typeIntoFocusedComposer(page, "Second message");
    await expectComposerDraft(page, "Second message");
    expect(browserErrors).toEqual([]);
  } finally {
    await agent.cleanup();
  }
});

test("resizing across compact layouts retains the workspace and its draft", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  const agent = await seedMockAgentWorkspace({
    repoPrefix: "composer-window-",
    title: "Window resize draft",
  });
  try {
    await page.setViewportSize({ width: 640, height: 900 });
    await openAgentRoute(page, agent);
    await expectComposerVisible(page);
    await fillComposerDraft(page, "Keep this unsent draft");
    const workspaceUrl = page.url();
    for (const width of [1024, 719, 720, 420]) {
      await page.setViewportSize({ width, height: 900 });
      await expectComposerDraft(page, "Keep this unsent draft");
      if (page.url() !== workspaceUrl) {
        throw new Error(`Window width ${width} changed the active workspace`);
      }
    }
    expect(browserErrors).toEqual([]);
  } finally {
    await agent.cleanup();
  }
});
