import { spawn } from "child_process";
import { existsSync } from "fs";
import os from "os";
import {
  DEFAULT_VENV_PYTHON,
  MAX_STDIO_BYTES,
  TIMEOUT_MS,
} from "./constants";
import type { RunPythonOptions, RunPythonResult } from "./types";

function toPythonStringLiteral(value: string): string {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

/** Spawn a Python process for sandboxed execution and collect capped output. */
export function runPython(
  filePath: string,
  options?: RunPythonOptions,
): Promise<RunPythonResult> {
  return new Promise((resolve) => {
    const pythonBin = process.env.PYTHON_BIN
      ?? (existsSync(DEFAULT_VENV_PYTHON) ? DEFAULT_VENV_PYTHON : "python3");

    const useIsolatedMode = options?.isolated ?? true;
    const pythonArgs = [useIsolatedMode ? "-I" : "", "-B"].filter(Boolean);
    const prependPaths = options?.prependSysPath?.filter(Boolean) ?? [];

    if (prependPaths.length > 0) {
      const listLiteral = `[${prependPaths.map((p) => toPythonStringLiteral(p)).join(", ")}]`;
      const bootstrapScript = [
        "import runpy",
        "import sys",
        `for _path in ${listLiteral}:`,
        "    if _path and _path not in sys.path:",
        "        sys.path.insert(0, _path)",
        `runpy.run_path(${toPythonStringLiteral(filePath)}, run_name='__main__')`,
      ].join("\n");
      pythonArgs.push("-c", bootstrapScript);
    } else {
      pythonArgs.push(filePath);
    }

    const maxOutputBytes = options?.maxOutputBytes ?? MAX_STDIO_BYTES;

    const proc = spawn(pythonBin, pythonArgs, {
      timeout: options?.timeoutMs ?? TIMEOUT_MS,
      ...(options?.cwd ? { cwd: options.cwd } : {}),
      env: {
        PATH: process.env.PATH ?? "",
        LANG: "C.UTF-8",
        LC_ALL: "C.UTF-8",
        HOME: options?.cwd ?? os.tmpdir(),
        TMPDIR: os.tmpdir(),
        PYTHONDONTWRITEBYTECODE: "1",
        PYTHONNOUSERSITE: "1",
        PYTHONUNBUFFERED: "1",
      },
    });

    let stdout = "";
    let stderr = "";
    let totalBytes = 0;
    let exceededOutputLimit = false;

    const appendOrTerminate = (chunk: Buffer, target: "stdout" | "stderr") => {
      if (exceededOutputLimit) return;

      const chunkBytes = chunk.length;

      if (totalBytes + chunkBytes <= maxOutputBytes) {
        totalBytes += chunkBytes;
        const chunkStr = chunk.toString("utf-8");
        if (target === "stdout") stdout += chunkStr;
        else stderr += chunkStr;
        return;
      }

      const remaining = Math.max(maxOutputBytes - totalBytes, 0);
      if (remaining > 0) {
        const partial = chunk.subarray(0, remaining).toString("utf-8");
        if (target === "stdout") stdout += partial;
        else stderr += partial;
      }

      totalBytes = maxOutputBytes;
      exceededOutputLimit = true;
      proc.kill("SIGKILL");
    };

    proc.stdout.on("data", (chunk: Buffer) => {
      appendOrTerminate(chunk, "stdout");
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      appendOrTerminate(chunk, "stderr");
    });

    proc.on("close", (exitCode, signal) => {
      let finalStderr = stderr;

      if (exceededOutputLimit) {
        const msg = `Output limit exceeded (${maxOutputBytes} bytes).`;
        finalStderr = finalStderr ? `${finalStderr}\n${msg}` : msg;
      } else if (!finalStderr && signal === "SIGTERM") {
        finalStderr = "Execution timed out.";
      } else if (!finalStderr && signal) {
        finalStderr = `Execution terminated by signal ${signal}.`;
      }

      resolve({ stdout, stderr: finalStderr, exitCode: exitCode ?? 1 });
    });

    proc.on("error", (err) => {
      resolve({ stdout, stderr: err.message, exitCode: 1 });
    });
  });
}
