import {
  ChevronRight,
  ChevronLeft,
  FileCode2,
  FileText,
  FolderClosed,
} from "lucide-react";
import type { StarterFile } from "../types";
import "../styles/FileTree.css";

interface Props {
  files: StarterFile[];
  activeFile: string;
  onSelect: (path: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

/** Map file extensions to an icon. */
function fileIcon(path: string) {
  if (path.endsWith(".css")) return <FileText className="ft-icon ft-icon--css" />;
  return <FileCode2 className="ft-icon ft-icon--code" />;
}

export default function FileTree({
  files,
  activeFile,
  onSelect,
  collapsed,
  onToggleCollapse,
}: Props) {
  return (
    <aside className={`ft-sidebar ${collapsed ? "ft-sidebar--collapsed" : ""}`}>
      {/* Toggle handle */}
      <button
        type="button"
        className="ft-toggle"
        onClick={onToggleCollapse}
        aria-label={collapsed ? "Expand file tree" : "Collapse file tree"}
      >
        <FolderClosed className="ft-toggle-icon" />
        {!collapsed && <span className="ft-toggle-label">Files</span>}
        {collapsed ? (
          <ChevronRight className="ft-toggle-chevron" />
        ) : (
          <ChevronLeft className="ft-toggle-chevron" />
        )}
      </button>

      {/* File list */}
      {!collapsed && (
        <ul className="ft-list">
          {files.map((f) => (
            <li key={f.path}>
              <button
                type="button"
                className={`ft-file ${activeFile === f.path ? "ft-file--active" : ""} ${f.readonly ? "ft-file--readonly" : ""}`}
                onClick={() => onSelect(f.path)}
                title={f.readonly ? `${f.path} (read-only)` : f.path}
              >
                {fileIcon(f.path)}
                <span className="ft-file-name">{f.path}</span>
                {f.readonly && <span className="ft-readonly-badge">RO</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
