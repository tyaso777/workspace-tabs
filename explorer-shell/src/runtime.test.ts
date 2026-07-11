import { describe, expect, it } from "vitest";
import {
  detectRuntime,
  localApiRequest,
  localCloseUrl,
  localEventUrl,
  localShutdownRequest,
  resolveClientIdentity,
  runtimeCloseCopy,
  runtimeDisplayName,
} from "./runtime";

describe("runtime adapter", () => {
  it("uses Local Web only when the server adds an explicit runtime marker", () => {
    expect(detectRuntime(null)).toBe("desktop");
    expect(detectRuntime("")).toBe("desktop");
    expect(detectRuntime("local-web")).toBe("local-web");
    expect(runtimeDisplayName("desktop")).toBe("Desktop");
    expect(runtimeDisplayName("local-web")).toBe("Local Web");
  });

  it("builds a token-protected Local Web invoke request", () => {
    expect(localApiRequest("create_project", { name: "A" }, "secret")).toEqual({
      url: "/api/invoke/create_project",
      init: {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-workspace-tabs-token": "secret",
        },
        body: JSON.stringify({ name: "A" }),
      },
    });
  });

  it("adds the token to the Local Web event stream URL", () => {
    expect(localEventUrl("a b", "tab/1")).toBe(
      "/api/events?token=a%20b&clientId=tab%2F1",
    );
  });

  it("builds the page-close notification URL for the same client", () => {
    expect(localCloseUrl("a b", "tab/1")).toBe(
      "/api/client-close?token=a%20b&clientId=tab%2F1",
    );
  });

  it("keeps a tab identity across reloads without relying on copied session storage", () => {
    expect(resolveClientIdentity("workspace-tabs:existing", "new-id")).toEqual({
      clientId: "existing",
      windowName: "workspace-tabs:existing",
    });
    expect(resolveClientIdentity("", "new-id")).toEqual({
      clientId: "new-id",
      windowName: "workspace-tabs:new-id",
    });
  });

  it("uses runtime-specific close labels and confirmation copy", () => {
    expect(runtimeCloseCopy("desktop")).toEqual({
      buttonLabel: "Close Desktop",
      title: "Close WorkspaceTabs Desktop?",
      detail: "The WorkspaceTabs Desktop window will close.",
    });
    expect(runtimeCloseCopy("local-web")).toEqual({
      buttonLabel: "Close Local Web",
      title: "Close WorkspaceTabs Local Web?",
      detail: "Local Web will stop and all open WorkspaceTabs browser tabs will disconnect.",
    });
  });

  it("builds an authenticated immediate shutdown request", () => {
    expect(localShutdownRequest("secret")).toEqual({
      url: "/api/shutdown",
      init: {
        method: "POST",
        headers: { "x-workspace-tabs-token": "secret" },
      },
    });
  });
});
