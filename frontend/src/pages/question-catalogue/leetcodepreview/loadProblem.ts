/**
 * Load a LeetCode problem JSON from the backend API.
 *
 * The backend resolves the problemId across sub-category directories
 * within content/leetcode/Python/.
 */

import type { LeetcodeProblem } from "./types";

export async function loadLeetcodeProblem(
  problemId: string,
): Promise<LeetcodeProblem> {
  const url = `/api/content/leetcode/${encodeURIComponent(problemId)}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Failed to load problem "${problemId}" (${res.status})`);
  }

  const data = await res.json();

  // Normalise difficulty to lowercase for consistency with our UI types.
  if (data.difficulty) {
    data.difficulty = data.difficulty.toLowerCase();
  }

  return data as LeetcodeProblem;
}
