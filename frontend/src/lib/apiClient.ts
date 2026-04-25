/**
 * apiClient — thin wrapper around fetch that automatically attaches
 * the current Supabase access_token to every request.
 *
 * Usage:
 *   import { apiFetch } from "@/lib/apiClient";
 *   const data = await apiFetch("/api/profile");
 *   const res  = await apiFetch("/api/sessions", { method: "POST", body: JSON.stringify(payload) });
 */

import { supabase } from "@/lib/supabase";

/**
 * Fetch wrapper that:
 * 1. Reads the current session token from Supabase
 * 2. Injects `Authorization: Bearer <token>` into every request
 * 3. Sets `Content-Type: application/json` by default for non-GET requests
 */
export async function apiFetch(
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers(init.headers);

  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  // Default to JSON content-type for requests with a body
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(input, { ...init, headers });
}
