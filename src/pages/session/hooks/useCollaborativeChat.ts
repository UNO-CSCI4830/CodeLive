import { useCallback, useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { resolveWsBaseUrl } from "./wsBaseUrl";

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

    const ydoc = new Y.Doc();
    const wsUrl = `${resolveWsBaseUrl()}/ws`;
    const provider = new WebsocketProvider(wsUrl, roomName, ydoc);
    provider.awareness.setLocalStateField("user", {
      name: userName ?? "User",
      color: userColor ?? "#2563eb",
    });

    provider.on("status", ({ status }: { status: string }) => {
      setConnected(status === "connected");
    });

    const yMessages = ydoc.getArray<CollaborativeChatMessage>("messages");
    yArrayRef.current = yMessages;

    const syncMessages = () => {
      setMessages(yMessages.toArray());
    };

    syncMessages();
    yMessages.observe(syncMessages);

    return () => {
      yMessages.unobserve(syncMessages);
      yArrayRef.current = null;
      provider.destroy();
      ydoc.destroy();
      setConnected(false);
      setMessages([]);
    };
  }, [roomName, userName, userColor]);

  const appendMessage = useCallback((message: CollaborativeChatMessage) => {
    const yMessages = yArrayRef.current;
    if (!yMessages) return;
    yMessages.push([message]);
  }, []);

  return { connected, messages, appendMessage };
}
