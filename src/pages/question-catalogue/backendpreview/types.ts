export type Difficulty = "easy" | "medium" | "hard";

export interface BackendStarterFile {
  path: string;
  content: string;
  language: string;
  readonly?: boolean;
}

export interface BackendTestRequest {
  method: string;
  path: string;
  body?: Record<string, unknown>;
  expected_status: number;
  expected_body?: Record<string, unknown>;
}

export interface BackendProblem {
  id: string;
  title: string;
  category: "backend";
  difficulty: Difficulty;
  description: string;
  constraints?: string;
  hints?: string[];
  tags?: string[];
  starter_files: BackendStarterFile[];
  test_config: {
    language: "python" | "go";
    test_requests: BackendTestRequest[];
  };
}

export interface BackendRunResult {
  index: number;
  method: string;
  path: string;
  passed: boolean;
  expectedStatus: number;
  actualStatus: number | null;
  expectedBody: unknown;
  actualBody: unknown;
  error?: string | null;
}

export interface BackendRunOutput {
  results: BackendRunResult[];
  summary: {
    passed: number;
    total: number;
  };
  fatalError?: string;
}
