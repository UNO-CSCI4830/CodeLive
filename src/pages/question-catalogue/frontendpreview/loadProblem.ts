/**
 * Load a frontend problem JSON from the backend API.
 *
 * In development, Vite proxies /api/* to the Express backend.
 * In production, the same path is served by the backend directly.
 */

import type { FrontendProblem } from "./types";

export async function loadFrontendProblem(
  problemId: string,
): Promise<FrontendProblem> {
  const url = `/api/content/frontend/${encodeURIComponent(problemId)}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Failed to load problem "${problemId}" (${res.status})`);
  }

  return res.json() as Promise<FrontendProblem>;
}
