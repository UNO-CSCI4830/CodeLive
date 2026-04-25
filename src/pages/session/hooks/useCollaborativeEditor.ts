/**
 * useCollaborativeEditor — connects a Monaco editor to a shared Yjs document
 * via WebSocket. Both interviewer and candidate edit the same document in
 * real time with cursor awareness.
 *
 * Lifecycle contract (React guarantees parent effects before child effects):
 *  1. Yjs effect cleanup: clears editorRef so the new effect never touches
 *     the old, disposed Monaco model.
 *  2. Yjs new effect: sets up doc/provider/ytext. editorRef is null here.
 *  3. Monaco onMount: calls bindEditor → provider is ready → binding created.
 *
 * This means MonacoBinding is ONLY ever created inside bindEditor, never
 * inside the Yjs effect, which avoids the null-model crash entirely.
 *
 * NOTE: We intentionally do NOT call binding.destroy() in cleanup.
 * lib0 (Yjs's utility layer) captures console.warn at module initialisation
 * time, so runtime patching of console.warn cannot suppress its
 * "[yjs] Tried to remove event handler" diagnostic. Instead we rely on
 * ydoc.destroy() — which zeroes every YType's _eH observer list — and
 * provider.destroy() — which calls awareness.destroy() — to release all
 * subscriptions. The MonacoBinding is then GC'd once we null the ref.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { MonacoBinding } from "y-monaco";
import type { editor as MonacoEditor } from "monaco-editor";
import { resolveWsBaseUrl } from "./wsBaseUrl";

interface Options {
  /** Room name: session:<id>:q:<index>:file:<path> — pass "" to skip connecting */
  roomName: string;
  /** Initial code to seed the document when it first syncs empty */
  initialCode?: string;
  /** Whether the editor is read-only (locked problem) */
  readOnly?: boolean;
  /** Display name for cursor awareness */
  userName?: string;
  /** Color for cursor awareness */
  userColor?: string;
}

interface CollaborativeEditorState {
  connected: boolean;
  /** Call once from Monaco's onMount. Re-call is safe (file switching). */
  bindEditor: (editor: MonacoEditor.IStandaloneCodeEditor) => void;
  /** Get the current Yjs document text */
  getText: () => string;
}


export function useCollaborativeEditor(options: Options): CollaborativeEditorState {
  const { roomName, initialCode, userName, userColor } = options;

  const [connected, setConnected] = useState(false);

  const editorRef  = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const ydocRef    = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const bindingRef  = useRef<MonacoBinding | null>(null);
  const ytextRef   = useRef<Y.Text | null>(null);

  useEffect(() => {
    if (!roomName) return;

    const ydoc = new Y.Doc();
    const wsUrl = `${resolveWsBaseUrl()}/ws`;
    const provider = new WebsocketProvider(wsUrl, roomName, ydoc);

    ydocRef.current    = ydoc;
    providerRef.current = provider;

    provider.awareness.setLocalStateField("user", {
      name:  userName  ?? "User",
      color: userColor ?? "#2563eb",
    });

    provider.on("status", ({ status }: { status: string }) => {
      setConnected(status === "connected");
    });

    const ytext = ydoc.getText("monaco");
    ytextRef.current = ytext;

    // Seed with starter code on first sync if the doc is empty
    provider.on("sync", (isSynced: boolean) => {
      if (isSynced && ytext.length === 0 && initialCode) {
        ytext.insert(0, initialCode);
      }
    });

    // Cleanup: MUST clear editorRef first.
    // When key={activeFilePath} changes, React disposes the old Monaco editor
    // (model becomes null) before running cleanup. If we don't clear editorRef
    // here, the next effect invocation would see a stale editor with null model
    // and MonacoBinding construction would crash.
    //
    // We do NOT call binding.destroy() here. ydoc.destroy() zeroes every YType's
    // _eH observer list (including the one MonacoBinding registered on ytext),
    // and provider.destroy() handles awareness — so the binding is safely
    // released without triggering the lib0 "[yjs] Tried to remove event handler"
    // warning that fires when the observer was already cleared.
    return () => {
      editorRef.current = null;          // ← prevents null-model crash on next setup
      bindingRef.current = null;         // drop ref; GC'd after ydoc.destroy() clears observers
      provider.destroy();
      ydoc.destroy();
      ydocRef.current    = null;
      providerRef.current = null;
      ytextRef.current   = null;
      setConnected(false);
    };
  }, [roomName]); // Recreate on room change (file switch or question advance)

  // Called from Monaco's onMount. This is the ONLY place we create a binding.
  // React guarantees this fires AFTER the parent's Yjs effect, so
  // providerRef and ytextRef are always set by the time this runs.
  // bindingRef.current is always null here because effect cleanup nulls it
  // before a new Monaco instance can mount and call onMount.
  const bindEditor = useCallback(
    (editor: MonacoEditor.IStandaloneCodeEditor) => {
      editorRef.current = editor;

      const model    = editor.getModel();
      const ytext    = ytextRef.current;
      const provider = providerRef.current;

      // Guard: model can be null if Monaco is still initialising
      if (!model || !ytext || !provider) return;

      bindingRef.current = new MonacoBinding(
        ytext,
        model,
        new Set([editor]),
        provider.awareness,
      );
    },
    [], // Stable — only touches refs
  );

  const getText = useCallback(
    (): string => ytextRef.current?.toString() ?? "",
    [],
  );

  return { connected, bindEditor, getText };
}
