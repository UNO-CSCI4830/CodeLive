import type { BackendTestRequest } from "./types";

/** Build the Python harness for backend request replay. */
export function buildBackendHarness(tests: BackendTestRequest[]): string {
  const testsJson = JSON.stringify(tests).replace(/\\/g, "\\\\").replace(/'/g, "\\'");

  return `
import json
import traceback
from typing import Any, Dict

try:
    from fastapi.testclient import TestClient
except Exception as _import_err:
    print(json.dumps({
        "fatal_error": f"Missing FastAPI test dependencies: {_import_err}",
        "results": []
    }))
    raise SystemExit(0)

def _safe_json(resp):
    try:
        return resp.json()
    except Exception:
        return {"_raw": resp.text}

tests = json.loads('''${testsJson}''')
results = []

try:
    from app.main import app
except Exception:
    print(json.dumps({
        "fatal_error": "Failed to import app.main:app",
        "trace": traceback.format_exc(),
        "results": []
    }))
    raise SystemExit(0)

client = TestClient(app)

for i, tc in enumerate(tests):
    method = str(tc.get("method", "GET")).upper()
    req_path = str(tc.get("path", "/"))
    expected_status = tc.get("expected_status")
    has_expected_body = "expected_body" in tc
    expected_body = tc.get("expected_body")
    body = tc.get("body")

    try:
        kwargs: Dict[str, Any] = {}
        if method in {"POST", "PUT", "PATCH", "DELETE"} and body is not None:
            kwargs["json"] = body
        resp = client.request(method, req_path, **kwargs)
        actual_body = _safe_json(resp)
        passed = (resp.status_code == expected_status)
        if has_expected_body:
            passed = passed and (actual_body == expected_body)
        results.append({
            "index": i,
            "method": method,
            "path": req_path,
            "passed": passed,
            "expectedStatus": expected_status,
            "actualStatus": resp.status_code,
            "expectedBody": expected_body,
            "actualBody": actual_body,
            "error": None,
        })
    except Exception as run_err:
        results.append({
            "index": i,
            "method": method,
            "path": req_path,
            "passed": False,
            "expectedStatus": expected_status,
            "actualStatus": None,
            "expectedBody": expected_body,
            "actualBody": None,
            "error": str(run_err),
        })

passed_count = len([r for r in results if r["passed"]])
print(json.dumps({
    "results": results,
    "summary": {"passed": passed_count, "total": len(results)}
}))
`.trimStart();
}
