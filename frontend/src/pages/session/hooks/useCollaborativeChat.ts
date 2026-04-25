import { useCallback, useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { resolveWsBaseUrl } from "./wsBaseUrl";
import { supabase } from "@/lib/supabase";

export interface CollaborativeChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface Options {
  roomName: string;
  userName?: string;
  userColor?: string;
}

interface CollaborativeChatState {
  connected: boolean;
  messages: CollaborativeChatMessage[];
  appendMessage: (message: CollaborativeChatMessage) => void;
  updateLastMessage: (updater: (prev: CollaborativeChatMessage) => CollaborativeChatMessage) => void;
}

export function useCollaborativeChat(options: Options): CollaborativeChatState {
  const { roomName, userName, userColor } = options;
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<CollaborativeChatMessage[]>([]);
  const yArrayRef = useRef<Y.Array<CollaborativeChatMessage> | null>(null);

  useEffect(() => {
    if (!roomName) {
      setConnected(false);
      setMessages([]);
      yArrayRef.current = null;
      return;
    }

    let cancelled = false;
    let ydoc: Y.Doc | null = null;
    let provider: WebsocketProvider | null = null;
    let yMessages: Y.Array<CollaborativeChatMessage> | null = null;

    const syncMessages = () => {
      if (yMessages) setMessages(yMessages.toArray());
    };

    async function connect() {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const token = authSession?.access_token ?? "";

      if (cancelled) return;

      ydoc = new Y.Doc();
      const wsUrl = `${resolveWsBaseUrl()}/ws`;
      provider = new WebsocketProvider(wsUrl, roomName, ydoc, {
        params: { token },
      });
      provider.awareness.setLocalStateField("user", {
        name: userName ?? "User",
        color: userColor ?? "#2563eb",
      });

      provider.on("status", ({ status }: { status: string }) => {
        setConnected(status === "connected");
      });

      yMessages = ydoc.getArray<CollaborativeChatMessage>("messages");
      yArrayRef.current = yMessages;

      syncMessages();
      yMessages.observe(syncMessages);
    }

    connect();

    return () => {
      cancelled = true;
      if (yMessages) yMessages.unobserve(syncMessages);
      yArrayRef.current = null;
      if (provider) provider.destroy();
      if (ydoc) ydoc.destroy();
      setConnected(false);
      setMessages([]);
    };
  }, [roomName, userName, userColor]);

  const appendMessage = useCallback((message: CollaborativeChatMessage) => {
    const yMessages = yArrayRef.current;
    if (!yMessages) return;
    yMessages.push([message]);
  }, []);

  const updateLastMessage = useCallback(
    (updater: (prev: CollaborativeChatMessage) => CollaborativeChatMessage) => {
      const yMessages = yArrayRef.current;
      if (!yMessages || yMessages.length === 0) return;
      const lastIndex = yMessages.length - 1;
      const current = yMessages.get(lastIndex);
      const updated = updater(current);
      yMessages.delete(lastIndex, 1);
      yMessages.push([updated]);
    },
    [],
  );

  return { connected, messages, appendMessage, updateLastMessage };
}
