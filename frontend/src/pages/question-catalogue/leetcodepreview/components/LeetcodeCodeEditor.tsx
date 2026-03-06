import Editor from "@monaco-editor/react";
import { useRef } from "react";
import "../styles/LeetcodeCodeEditor.css";

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export default function LeetcodeCodeEditor({ value, onChange }: Props) {
  const monacoConfigured = useRef(false);

  return (
    <div className="lce-wrapper">
      <Editor
        height="100%"
        language="python"
        value={value}
        onChange={(v) => onChange(v ?? "")}
        theme="vs-dark"
        beforeMount={(monaco) => {
          if (!monacoConfigured.current) {
            monacoConfigured.current = true;

            /* Disable semantic validation for Python — Monaco
               doesn't ship a Python language service anyway. */
            monaco.languages.typescript?.typescriptDefaults?.setDiagnosticsOptions?.({
              noSemanticValidation: true,
              noSyntaxValidation: true,
            });
          }
        }}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          wordWrap: "on",
          tabSize: 4,
          automaticLayout: true,
          padding: { top: 12 },
          renderLineHighlight: "line",
          cursorBlinking: "smooth",
          smoothScrolling: true,
          contextmenu: true,
          folding: true,
          bracketPairColorization: { enabled: true },
        }}
      />
    </div>
  );
}
