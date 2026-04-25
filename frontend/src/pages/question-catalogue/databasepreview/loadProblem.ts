import type { DatabaseProblem } from "./types";
import { apiFetch } from "@/lib/apiClient";

export async function loadDatabaseProblem(problemId: string): Promise<DatabaseProblem> {
  const url = `/api/content/database/${encodeURIComponent(problemId)}`;
  const res = await apiFetch(url);

  if (!res.ok) {
    throw new Error(`Failed to load database problem "${problemId}" (${res.status})`);
  }

  const data = await res.json();
  if (data.difficulty) data.difficulty = String(data.difficulty).toLowerCase();
  return data as DatabaseProblem;
}
