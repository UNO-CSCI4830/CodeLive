export type Difficulty = "easy" | "medium" | "hard";

export interface DatabaseStarterFile {
  path: string;
  content: string;
  language: string;
  readonly?: boolean;
}

export interface DatabaseProblem {
  id: string;
  title: string;
  category: "database";
  difficulty: Difficulty;
  description: string;
  constraints?: string;
  hints?: string[];
  tags?: string[];
  starter_files: DatabaseStarterFile[];
  test_config: {
    schema_sql: string;
    seed_sql: string;
    expected_output: Array<Record<string, unknown>>;
    column_names?: string[];
    order_matters?: boolean;
    check_explain?: boolean;
  };
}

export interface DatabaseRunOutput {
  passed: boolean;
  orderMatters: boolean;
  actualColumns: string[];
  expectedColumns: string[];
  actualOutput: Array<Record<string, unknown>>;
  expectedOutput: Array<Record<string, unknown>>;
  executionError?: string | null;
}
