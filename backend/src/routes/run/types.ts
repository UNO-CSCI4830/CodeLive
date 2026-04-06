export interface LeetcodeTestCase {
  input: Record<string, unknown>;
  expected: { result: unknown };
}

export interface BackendRunFile {
  path: string;
  content: string;
}

export interface DatabaseRunFile {
  path: string;
  content: string;
}

export interface BackendRunRequestBody {
  problemId?: string;
  files?: BackendRunFile[];
  fileContents?: Record<string, string>;
}

export interface DatabaseRunRequestBody {
  problemId?: string;
  sql?: string;
  files?: DatabaseRunFile[];
  fileContents?: Record<string, string>;
}

export interface BackendStarterFile {
  path: string;
  content: string;
  language: string;
  readonly?: boolean;
}

export interface BackendProblem {
  id: string;
  category: string;
  starter_files: BackendStarterFile[];
  test_config: {
    language: "python" | "go";
    test_requests: BackendTestRequest[];
  };
}

export interface BackendTestRequest {
  method: string;
  path: string;
  body?: Record<string, unknown>;
  expected_status: number;
  expected_body?: Record<string, unknown>;
}

export interface DatabaseStarterFile {
  path: string;
  content: string;
  language: string;
  readonly?: boolean;
}

export interface DatabaseHiddenTestConfig {
  expected_output: Array<Record<string, unknown>>;
  column_names?: string[];
  order_matters?: boolean;
}

export interface DatabaseProblem {
  id: string;
  category: string;
  starter_files: DatabaseStarterFile[];
  test_config: {
    schema_sql: string;
    seed_sql: string;
    expected_output: Array<Record<string, unknown>>;
    column_names?: string[];
    order_matters?: boolean;
    hidden_tests?: DatabaseHiddenTestConfig[];
  };
}

export interface RunPythonOptions {
  timeoutMs?: number;
  cwd?: string;
  maxOutputBytes?: number;
  isolated?: boolean;
  prependSysPath?: string[];
}

export interface RunPythonResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}
