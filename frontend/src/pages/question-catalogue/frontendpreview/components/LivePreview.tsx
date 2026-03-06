import { useCallback, useEffect, useRef, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { transform } from "sucrase";
import "../styles/LivePreview.css";

interface FileMap {
  [path: string]: string;
}

interface Props {
  files: FileMap;
  backTo?: string;
}

/**
 * Build a self-contained HTML document that:
 *  1. Embeds all CSS files into a <style> block.
 *  2. Bundles every .tsx / .jsx / .ts / .js file via Sucrase.
 *  3. Provides a tiny in-browser `require()` so files can import each other
 *     and import React / ReactDOM.
 *  4. Renders the default export of `App.tsx` (or the first .tsx file) into
 *     a root div.
 *
 * The result is loaded into a sandboxed <iframe> via srcdoc.
 */
function buildSrcdoc(files: FileMap): string {
  /* ── Collect CSS ──────────────────────────────────── */
  const css = Object.entries(files)
    .filter(([p]) => p.endsWith(".css"))
    .map(([, c]) => c)
    .join("\n");

  /* ── Transpile JS/TS/JSX/TSX files ────────────────── */
  const modules: { path: string; code: string }[] = [];

  for (const [path, content] of Object.entries(files)) {
    if (!/\.(tsx?|jsx?)$/.test(path)) continue;
    try {
      const { code } = transform(content, {
        transforms: ["typescript", "jsx", "imports"],
        jsxRuntime: "classic",
        production: true,
      });
      modules.push({ path, code });
    } catch (err) {
      modules.push({
        path,
        code: `throw new Error(${JSON.stringify(String(err))});`,
      });
    }
  }

  /* ── Determine entry point ────────────────────────── */
  const entry =
    modules.find((m) => m.path === "App.tsx") ??
    modules.find((m) => m.path.endsWith(".tsx")) ??
    modules[0];

  const entryPath = entry?.path ?? "App.tsx";

  /* ── Register CSS files as no-op modules so require('./styles.css') resolves ── */
  const cssModuleScripts = Object.keys(files)
    .filter((p) => p.endsWith(".css"))
    .map(
      (p) =>
        `__modules[${JSON.stringify(p)}] = function(exports, module, require) {};`,
    )
    .join("\n");

  /* ── Serialise modules into the HTML ──────────────── */
  const moduleScripts = modules
    .map(
      (m) =>
        `__modules[${JSON.stringify(m.path)}] = function(exports, module, require) {\n${m.code}\n};`,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, -apple-system, sans-serif; }
    ${css}
  </style>
</head>
<body>
  <div id="root"></div>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"><\/script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"><\/script>
  <script>
  (function() {
    // ── tiny module system ──
    var __modules = {};
    var __cache = {};

    ${cssModuleScripts}
    ${moduleScripts}

    function __require(id) {
      // built-ins
      if (id === 'react' || id === 'React') return React;
      if (id === 'react-dom' || id === 'react-dom/client') return ReactDOM;

      // resolve relative ./name to name or name.tsx etc.
      var resolved = id.replace(/^\\.\\/?/, '');
      var candidates = [
        resolved,
        resolved + '.tsx',
        resolved + '.ts',
        resolved + '.jsx',
        resolved + '.js',
        resolved + '.css',
      ];
      var found = null;
      for (var i = 0; i < candidates.length; i++) {
        if (__modules[candidates[i]]) { found = candidates[i]; break; }
      }

      // CSS imports are no-ops (already in <style>)
      if (found && found.endsWith('.css')) return {};
      if (!found) {
        console.warn('[sandbox] Module not found: ' + id);
        return {};
      }
      if (__cache[found]) return __cache[found].exports;

      var mod = { exports: {} };
      __cache[found] = mod;
      try {
        __modules[found](mod.exports, mod, __require);
      } catch(e) {
        document.getElementById('root').innerHTML =
          '<pre style="color:#ef4444;padding:1rem;font-size:13px;white-space:pre-wrap;">' +
          e.toString() + '<\/pre>';
      }
      return mod.exports;
    }

    // ── render entry ──
    try {
      var App = __require(${JSON.stringify(entryPath)});
      var Component = (App && App.__esModule) ? (App.default || App) : (App.default || App);
      if (typeof Component !== 'function' && typeof Component === 'object' && Component.default) {
        Component = Component.default;
      }
      var root = ReactDOM.createRoot(document.getElementById('root'));
      root.render(React.createElement(Component));
    } catch(e) {
      document.getElementById('root').innerHTML =
        '<pre style="color:#ef4444;padding:1rem;font-size:13px;white-space:pre-wrap;">' +
        e.toString() + '<\/pre>';
    }
  })();
  <\/script>
</body>
</html>`;
}

export default function LivePreview({ files, backTo }: Props) {
  /**
   * Double-buffered preview: two iframes swap roles so the user always
   * sees the last fully-loaded render — no white flash between updates.
   *
   * We also debounce the srcdoc build by 350 ms so rapid typing doesn't
   * trigger a flood of iframe reloads.
   */
  const frameARef = useRef<HTMLIFrameElement>(null);
  const frameBRef = useRef<HTMLIFrameElement>(null);
  /** Which iframe is currently visible: "A" or "B" */
  const activeFrame = useRef<"A" | "B">("A");

  /* ── Debounced srcdoc ────────────────────────────── */
  const [debouncedFiles, setDebouncedFiles] = useState<FileMap>(files);
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    debounceTimer.current = setTimeout(() => setDebouncedFiles(files), 350);
    return () => clearTimeout(debounceTimer.current);
  }, [files]);

  const srcdoc = useMemo(() => buildSrcdoc(debouncedFiles), [debouncedFiles]);

  /* ── Load into the *hidden* iframe, swap on load ── */
  useEffect(() => {
    const hiddenFrame =
      activeFrame.current === "A" ? frameBRef.current : frameARef.current;
    if (!hiddenFrame) return;
    hiddenFrame.srcdoc = srcdoc;
  }, [srcdoc]);

  const handleLoad = useCallback(
    (which: "A" | "B") => () => {
      // Only swap if this is the hidden (back-buffer) frame that just finished.
      if (which === activeFrame.current) return;
      activeFrame.current = which;

      const nowVisible = which === "A" ? frameARef.current : frameBRef.current;
      const nowHidden = which === "A" ? frameBRef.current : frameARef.current;
      if (nowVisible) nowVisible.style.visibility = "visible";
      if (nowHidden) nowHidden.style.visibility = "hidden";
    },
    [],
  );

  return (
    <div className="live-preview">
      <div className="live-preview-header">
        <span className="live-preview-title">Preview</span>
        {backTo && (
          <Link to={backTo} className="live-preview-back">
            <ChevronLeft className="live-preview-back-icon" />
            <span>Back</span>
          </Link>
        )}
      </div>
      <div className="live-preview-frames">
        <iframe
          ref={frameARef}
          className="live-preview-frame"
          title="Live preview A"
          sandbox="allow-scripts"
          onLoad={handleLoad("A")}
          style={{ visibility: "visible" }}
        />
        <iframe
          ref={frameBRef}
          className="live-preview-frame"
          title="Live preview B"
          sandbox="allow-scripts"
          onLoad={handleLoad("B")}
          style={{ visibility: "hidden" }}
        />
      </div>
    </div>
  );
}
