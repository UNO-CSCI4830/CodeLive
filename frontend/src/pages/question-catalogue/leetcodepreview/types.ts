/* Shared types for the LeetCode problem preview. */

export type Difficulty = "easy" | "medium" | "hard";

export interface TestCase {
  input: Record<string, unknown>;
  expected: { result: unknown };
  explanation?: string;
}

export interface LeetcodeProblem {
  id: string;
  title: string;
  difficulty: Difficulty;
  language: string;
  description: string;
  leetcodeUrl?: string;
  complexity: { time: string; space: string };
  explanation: string;
  solutionCode: string;
  testCases: TestCase[];
  tags: string[];
  hints: string[];
  relatedProblems?: string[];
  starterCode: string;
  starterCodePython: string;
}

export interface TestResult {
  index: number;
  passed: boolean;
  input: Record<string, unknown>;
  expected: unknown;
  actual: unknown;
  error?: string;
}

export interface RunOutput {
  results: TestResult[];
  stdout: string;
}
