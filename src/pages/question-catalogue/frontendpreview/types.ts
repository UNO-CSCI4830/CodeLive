/* Shared types for the frontend problem sandbox. */

export type Difficulty = "easy" | "medium" | "hard";

export interface StarterFile {
  path: string;
  content: string;
  language: string;
  readonly?: boolean;
}

export interface FrontendProblem {
  id: string;
  title: string;
  category: string;
  difficulty: Difficulty;
  description: string;
  constraints?: string;
  hints?: string[];
  tags?: string[];
  starter_files: StarterFile[];
}
