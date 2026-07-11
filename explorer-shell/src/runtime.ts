import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { listen as tauriListen } from "@tauri-apps/api/event";
import { open as tauriOpen } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";

export type WorkspaceRuntime = "desktop" | "local-web";
export type LocalWebConnectionState = "connected" | "disconnected";

const CLIENT_NAME_PREFIX = "workspace-tabs:";

export function detectRuntime(runtimeMarker: string | null): WorkspaceRuntime {
  return runtimeMarker === "local-web" ? "local-web" : "desktop";
}

export function currentRuntime(): WorkspaceRuntime {
  const runtimeMarker = document
    .querySelector<HTMLMetaElement>('meta[name="workspace-tabs-runtime"]')
    ?.content.trim();
  return detectRuntime(runtimeMarker ?? null);
}

export function runtimeDisplayName(runtime: WorkspaceRuntime): string {
  return runtime === "desktop" ? "Desktop" : "Local Web";
}

export function runtimeCloseCopy(runtime: WorkspaceRuntime): {
  buttonLabel: string;
  title: string;
  detail: string;
} {
  return runtime === "desktop"
    ? {
        buttonLabel: "Close Desktop",
        title: "Close WorkspaceTabs Desktop?",
        detail: "The WorkspaceTabs Desktop window will close.",
      }
    : {
        buttonLabel: "Close Local Web",
        title: "Close WorkspaceTabs Local Web?",
        detail: "Local Web will stop and all open WorkspaceTabs browser tabs will disconnect.",
      };
}

export function localApiRequest(
  command: string,
  args: Record<string, unknown>,
  token: string,
): { url: string; init: RequestInit } {
  return {
    url: `/api/invoke/${encodeURIComponent(command)}`,
    init: {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-workspace-tabs-token": token,
      },
      body: JSON.stringify(args),
    },
  };
}

export function localEventUrl(token: string, clientId: string): string {
  return `/api/events?token=${encodeURIComponent(token)}&clientId=${encodeURIComponent(clientId)}`;
}

export function localCloseUrl(token: string, clientId: string): string {
  return `/api/client-close?token=${encodeURIComponent(token)}&clientId=${encodeURIComponent(clientId)}`;
}

export function localShutdownRequest(token: string): { url: string; init: RequestInit } {
  return {
    url: "/api/shutdown",
    init: {
      method: "POST",
      headers: { "x-workspace-tabs-token": token },
    },
  };
}

export function resolveClientIdentity(
  windowName: string,
  generatedId: string,
): { clientId: string; windowName: string } {
  if (windowName.startsWith(CLIENT_NAME_PREFIX)) {
    const clientId = windowName.slice(CLIENT_NAME_PREFIX.length);
    if (clientId) return { clientId, windowName };
  }
  return {
    clientId: generatedId,
    windowName: `${CLIENT_NAME_PREFIX}${generatedId}`,
  };
}

export async function invoke<T>(
  command: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  if (currentRuntime() === "desktop") {
    return tauriInvoke<T>(command, args);
  }

  const request = localApiRequest(command, args, localWebToken());
  const response = await fetch(request.url, request.init);
  const payload = (await response.json()) as T | { error?: string };
  if (!response.ok) {
    const message =
      typeof payload === "object" && payload !== null && "error" in payload
        ? String(payload.error)
        : `Local Web request failed (${response.status})`;
    throw new Error(message);
  }
  return payload as T;
}

export async function chooseDirectory(defaultPath?: string): Promise<string | null> {
  if (currentRuntime() === "desktop") {
    const selected = await tauriOpen({
      directory: true,
      multiple: false,
      defaultPath,
    });
    return typeof selected === "string" ? selected : null;
  }
  return invoke<string | null>("choose_folder", { defaultPath });
}

export async function listenFolderChanged<T>(
  listener: (payload: T) => void,
  connectionListener?: (state: LocalWebConnectionState) => void,
): Promise<() => void> {
  if (currentRuntime() === "desktop") {
    connectionListener?.("connected");
    return tauriListen<T>("folder-changed", (event) => listener(event.payload));
  }

  const source = new EventSource(localEventUrl(localWebToken(), localWebClientId()));
  source.onopen = () => connectionListener?.("connected");
  source.onerror = () => connectionListener?.("disconnected");
  source.onmessage = (event) => {
    listener(JSON.parse(event.data) as T);
  };
  return () => source.close();
}

export function notifyLocalWebPageClosing(): void {
  if (currentRuntime() !== "local-web") return;
  navigator.sendBeacon(localCloseUrl(localWebToken(), localWebClientId()));
}

export async function localWebHealthAvailable(): Promise<boolean> {
  if (currentRuntime() !== "local-web") return true;
  try {
    const response = await fetch("/api/health", { cache: "no-store" });
    return response.ok;
  } catch {
    return false;
  }
}

export async function closeWorkspaceRuntime(): Promise<void> {
  if (currentRuntime() === "desktop") {
    await getCurrentWindow().close();
    return;
  }
  const request = localShutdownRequest(localWebToken());
  const response = await fetch(request.url, request.init);
  if (!response.ok) {
    throw new Error(`Local Web shutdown failed (${response.status}).`);
  }
}

function localWebClientId(): string {
  const identity = resolveClientIdentity(window.name, crypto.randomUUID());
  window.name = identity.windowName;
  return identity.clientId;
}

function localWebToken(): string {
  const token = document
    .querySelector<HTMLMetaElement>('meta[name="workspace-tabs-token"]')
    ?.content.trim();
  if (!token) {
    throw new Error("Local Web security token is missing.");
  }
  return token;
}
