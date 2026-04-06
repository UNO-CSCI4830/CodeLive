import Editor, { type Monaco } from "@monaco-editor/react";
import { useRef } from "react";
import "../styles/CodeEditor.css";

interface Props {
  value: string;
  language: string;
  path?: string;
  readOnly?: boolean;
  onChange: (value: string) => void;
}

/** Map our problem-JSON language ids to Monaco language ids. */
function toMonacoLang(lang: string): string {
  switch (lang) {
    case "tsx":
    case "jsx":
      return "typescript";
    case "ts":
      return "typescript";
    case "js":
      return "javascript";
    case "css":
      return "css";
    case "html":
      return "html";
    default:
      return lang;
  }
}

/**
 * Configure TypeScript/JavaScript defaults once when Monaco loads so that:
 *  - JSX is understood (no red squiggles on JSX syntax)
 *  - React types are shimmed (no "Cannot find module 'react'" errors)
 *  - Strict checks that don't make sense in a sandbox are relaxed
 */
function handleBeforeMount(monaco: Monaco) {
  const tsDefaults = monaco.languages.typescript.typescriptDefaults;

  tsDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ESNext,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
    jsxImportSource: "react",
    allowJs: true,
    allowNonTsExtensions: true,
    esModuleInterop: true,
    forceConsistentCasingInFileNames: false,
    strict: false,
    noEmit: true,
    skipLibCheck: true,
    // Suppress specific diagnostics that don't apply in a sandbox
  });

  tsDefaults.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: false,
  });

  /* Provide a minimal React type declaration so imports don't error. */
  const reactTypes = `
    declare module 'react' {
      export = React;
      export as namespace React;
    }
    declare namespace React {
      type ReactNode = any;
      type FC<P = {}> = (props: P & { children?: ReactNode }) => ReactNode;
      type CSSProperties = Record<string, any>;
      function useState<T>(init: T | (() => T)): [T, (v: T | ((p: T) => T)) => void];
      function useEffect(fn: () => void | (() => void), deps?: any[]): void;
      function useRef<T>(init?: T): { current: T };
      function useCallback<T>(fn: T, deps: any[]): T;
      function useMemo<T>(fn: () => T, deps: any[]): T;
      function useContext<T>(ctx: any): T;
      function createContext<T>(defaultVal: T): any;
      function createElement(type: any, props?: any, ...children: any[]): any;
      function memo<T>(component: T): T;
      const Fragment: any;
    }
    declare module 'react-dom' { const d: any; export = d; }
    declare module 'react-dom/client' { const d: any; export = d; }
  `;
  tsDefaults.addExtraLib(reactTypes, "file:///node_modules/@types/react/index.d.ts");

  const jsDefaults = monaco.languages.typescript.javascriptDefaults;
  jsDefaults.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: false,
  });
}

export default function CodeEditor({
  value,
  language,
  path,
  readOnly = false,
  onChange,
}: Props) {
  const monacoConfigured = useRef(false);

  return (
    <div className="code-editor-wrapper">
      <Editor
        height="100%"
        language={toMonacoLang(language)}
        path={path}
        value={value}
        onChange={(v) => onChange(v ?? "")}
        theme="vs-dark"
        beforeMount={(monaco) => {
          if (!monacoConfigured.current) {
            handleBeforeMount(monaco);
            monacoConfigured.current = true;
          }
        }}
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 13,
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          wordWrap: "on",
          tabSize: 2,
          automaticLayout: true,
          padding: { top: 12 },
        }}
      />
    </div>
  );
}
