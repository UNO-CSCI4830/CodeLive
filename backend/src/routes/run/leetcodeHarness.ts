import type { LeetcodeTestCase } from "./types";

/**
 * Extract the name of the first top-level `def` in submitted Python code.
 */
export function extractTopLevelFunctionName(code: string): string | null {
  for (const line of code.split("\n")) {
    const match = line.match(/^def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/);
    if (match) return match[1];
  }
  return null;
}

/**
 * Build a Python script that evaluates LeetCode-style test cases.
 */
export function buildLeetcodeHarness(
  code: string,
  testCases: LeetcodeTestCase[],
  functionName: string,
): string {
  const testCasesJson = JSON.stringify(testCases);

  return `
import sys
import json
import io
from typing import List, Optional, Tuple, Dict, Set

# ── User code ──────────────────────────────────────
${code}

# ── Test harness ───────────────────────────────────
_test_cases = json.loads('''${testCasesJson.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}''')
_results = []
_captured_stdout = io.StringIO()
_old_stdout = sys.stdout

for _i, _tc in enumerate(_test_cases):
    _input = _tc["input"]
    _expected = _tc["expected"]["result"]
    sys.stdout = _captured_stdout
    try:
        _actual = ${functionName}(**_input)
        sys.stdout = _old_stdout
        _passed = _actual == _expected
        _results.append({
            "index": _i,
            "passed": _passed,
            "input": _input,
            "expected": _expected,
            "actual": _actual,
            "error": None
        })
    except Exception as _e:
        sys.stdout = _old_stdout
        _results.append({
            "index": _i,
            "passed": False,
            "input": _input,
            "expected": _expected,
            "actual": None,
            "error": str(_e)
        })

sys.stdout = _old_stdout
_user_stdout = _captured_stdout.getvalue()
print(json.dumps({"results": _results, "stdout": _user_stdout}))
`.trimStart();
}
