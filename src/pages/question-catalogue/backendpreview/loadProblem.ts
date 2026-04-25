import type { BackendProblem } from "./types";

export async function loadBackendProblem(problemId: string): Promise<BackendProblem> {
  const url = `/api/content/backend/${encodeURIComponent(problemId)}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Failed to load backend problem "${problemId}" (${res.status})`);
  }

  const data = await res.json();
  if (data.difficulty) data.difficulty = String(data.difficulty).toLowerCase();
  return data as BackendProblem;
}
