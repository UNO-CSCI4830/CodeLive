function sanitizeBaseUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    parsed.pathname = "";
    parsed.search = "";
    parsed.hash = "";
    parsed.protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function isLocalBrowserHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function isDockerInternalHost(hostname: string): boolean {
  // Docker Compose service names like "backend" are resolvable from other
  // containers, but not from the user's browser. In that case, connect through
  // the Vite dev server origin so /ws is proxied to the backend container.
  return !hostname.includes(".") && !isLocalBrowserHost(hostname);
}

/**
 * Resolve websocket base URL for collaborative editor/chat.
 *
 * Priority:
 * 1) VITE_BACKEND_URL (remote Fly backend in dev.sh)
 * 2) Current origin (fully local dev)
 */
export function resolveWsBaseUrl(): string {
  const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const currentOrigin = `${wsProtocol}//${window.location.host}`;
  const envBase = sanitizeBaseUrl(
    (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? "",
  );

  if (!envBase) return currentOrigin;

  try {
    const envUrl = new URL(envBase);
    if (isDockerInternalHost(envUrl.hostname)) {
      return currentOrigin;
    }
  } catch {
    return currentOrigin;
  }

  return envBase;
}
