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

/**
 * Resolve websocket base URL for collaborative editor/chat.
 *
 * Priority:
 * 1) VITE_BACKEND_URL (remote Fly backend in dev.sh)
 * 2) Current origin (fully local dev)
 */
export function resolveWsBaseUrl(): string {
  const envBase = sanitizeBaseUrl(
    (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? "",
  );
  if (envBase) return envBase;

  const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${wsProtocol}//${window.location.host}`;
}

