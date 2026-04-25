/**
 * WebSocket server for Yjs collaborative editing.
 *
 * Each interview session + question combination gets its own Yjs "room":
 *   room name = `session:<sessionId>:q:<orderIndex>`
 *
 * Implements the Yjs sync + awareness protocol directly using y-protocols
 * and lib0 (compatible with y-websocket v3 which removed setupWSConnection).
 *
 * Both interviewer and candidate connect to the same room and see each
 * other's edits in real time.
 */

import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import type { Server } from "http";
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import { supabaseAdmin } from "./supabase";

// ── Message types (matches y-websocket protocol) ────────────────────
const MSG_SYNC = 0;
const MSG_AWARENESS = 1;

// ── Room management ─────────────────────────────────────────────────
interface Room {
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  conns: Map<WebSocket, Set<number>>; // ws → set of awareness client IDs
}

const rooms = new Map<string, Room>();

function getOrCreateRoom(name: string): Room {
  let room = rooms.get(name);
  if (room) return room;

  const doc = new Y.Doc();
  const awareness = new awarenessProtocol.Awareness(doc);

  // Clean up awareness state when a client disconnects
  awareness.setLocalState(null);

  room = { doc, awareness, conns: new Map() };
  rooms.set(name, room);

  // Broadcast doc updates to all connected clients
  doc.on("update", (update: Uint8Array, origin: unknown) => {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    const msg = encoding.toUint8Array(encoder);
    broadcastToRoom(room!, msg, origin as WebSocket | null);
  });

  // Broadcast awareness changes to all connected clients and track ownership.
  // When a client sends an awareness update, `origin` is the WebSocket that
  // triggered it (passed through from applyAwarenessUpdate). We use that to
  // track which client IDs belong to which connection — needed for cleanup on
  // disconnect.
  awareness.on(
    "update",
    (
      { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
      origin: unknown
    ) => {
      // Track which connection owns which awareness client IDs
      if (origin instanceof WebSocket) {
        const controlledIds = room!.conns.get(origin);
        if (controlledIds) {
          for (const id of added) controlledIds.add(id);
          for (const id of updated) controlledIds.add(id);
        }
      }

      const changedClients = [...added, ...updated, ...removed];
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MSG_AWARENESS);
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients)
      );
      const msg = encoding.toUint8Array(encoder);
      broadcastToRoom(room!, msg, origin as WebSocket | null);
    }
  );

  return room;
}

function broadcastToRoom(room: Room, msg: Uint8Array, exclude: WebSocket | null) {
  room.conns.forEach((_ids, ws) => {
    if (ws !== exclude && ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  });
}

function removeConnection(room: Room, roomName: string, ws: WebSocket) {
  const controlledIds = room.conns.get(ws);
  room.conns.delete(ws);

  if (controlledIds) {
    // Remove awareness states controlled by this client
    awarenessProtocol.removeAwarenessStates(room.awareness, Array.from(controlledIds), null);
  }

  // Clean up empty rooms to prevent memory leaks
  if (room.conns.size === 0) {
    room.awareness.destroy();
    room.doc.destroy();
    rooms.delete(roomName);
  }
}

// ── Per-connection message handler ──────────────────────────────────
function handleMessage(room: Room, ws: WebSocket, data: Uint8Array) {
  const decoder = decoding.createDecoder(data);
  const msgType = decoding.readVarUint(decoder);

  switch (msgType) {
    case MSG_SYNC: {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MSG_SYNC);
      syncProtocol.readSyncMessage(decoder, encoder, room.doc, ws);

      // If the encoder has content beyond the message type, send it back
      if (encoding.length(encoder) > 1) {
        ws.send(encoding.toUint8Array(encoder));
      }
      break;
    }
    case MSG_AWARENESS: {
      const update = decoding.readVarUint8Array(decoder);
      // applyAwarenessUpdate passes `ws` as origin → the awareness "update"
      // listener above will track client IDs for this connection.
      awarenessProtocol.applyAwarenessUpdate(room.awareness, update, ws);
      break;
    }
  }
}

// ── Send initial sync to a new connection ───────────────────────────
function sendInitialSync(room: Room, ws: WebSocket) {
  // Send sync step 1
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MSG_SYNC);
  syncProtocol.writeSyncStep1(encoder, room.doc);
  ws.send(encoding.toUint8Array(encoder));

  // Send current awareness states
  const awarenessStates = room.awareness.getStates();
  if (awarenessStates.size > 0) {
    const encoder2 = encoding.createEncoder();
    encoding.writeVarUint(encoder2, MSG_AWARENESS);
    encoding.writeVarUint8Array(
      encoder2,
      awarenessProtocol.encodeAwarenessUpdate(
        room.awareness,
        Array.from(awarenessStates.keys())
      )
    );
    ws.send(encoding.toUint8Array(encoder2));
  }
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Authenticate a WebSocket upgrade request.
 * Accepts the JWT as either:
 *  - A query parameter: /ws/<room>?token=<jwt>
 *  - The Sec-WebSocket-Protocol header value
 * Returns the authenticated user ID, or null if auth fails.
 */
async function authenticateWsRequest(
  url: URL,
  request: IncomingMessage,
): Promise<string | null> {
  // Try query param first, then Sec-WebSocket-Protocol header
  const token =
    url.searchParams.get("token") ??
    request.headers["sec-websocket-protocol"] ??
    null;

  if (!token || typeof token !== "string") return null;

  try {
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) return null;
    return user.id;
  } catch {
    return null;
  }
}

/**
 * Verify the user is a participant in the session referenced by the room name.
 * Room names follow the pattern: session:<sessionId>:q:<index>[:file:<path>]
 */
async function verifySessionParticipant(
  roomName: string,
  userId: string,
): Promise<boolean> {
  // Extract sessionId from room name
  const match = roomName.match(/^session:([^:]+):/);
  if (!match) return false;

  const sessionId = match[1];
  const { data: session } = await supabaseAdmin
    .from("sessions")
    .select("interviewer_id, candidate_id")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) return false;
  return session.interviewer_id === userId || session.candidate_id === userId;
}

/**
 * Attach the Yjs WebSocket server to an existing HTTP server.
 * Listens on the /ws path for upgrade requests.
 */
export function attachYjsWebSocket(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", async (request: IncomingMessage, socket, head) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host}`);

    // Only handle /ws path prefix
    // y-websocket WebsocketProvider connects to: /ws/<roomName>
    if (!url.pathname.startsWith("/ws")) {
      socket.destroy();
      return;
    }

    // Authenticate the user via JWT
    const userId = await authenticateWsRequest(url, request);
    if (!userId) {
      console.warn("[yjs] WebSocket auth failed — rejecting upgrade");
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    // Verify the user is a participant in the target session
    const roomName = decodeURIComponent(url.pathname.replace(/^\/ws\//, "")) || "default";
    const isParticipant = await verifySessionParticipant(roomName, userId);
    if (!isParticipant) {
      console.warn("[yjs] WebSocket participant check failed — rejecting upgrade");
      socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
      wss.emit("connection", ws, request);
    });
  });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    // y-websocket puts the room name in the path: /ws/<roomName>
    const roomName = decodeURIComponent(url.pathname.replace(/^\/ws\//, "")) || "default";
    const room = getOrCreateRoom(roomName);

    // Register this connection
    room.conns.set(ws, new Set());

    // Send initial document state + awareness
    sendInitialSync(room, ws);

    ws.on("message", (rawData: Buffer | ArrayBuffer | Buffer[]) => {
      try {
        const data =
          rawData instanceof Buffer
            ? new Uint8Array(rawData)
            : rawData instanceof ArrayBuffer
              ? new Uint8Array(rawData)
              : new Uint8Array(Buffer.concat(rawData as Buffer[]));

        handleMessage(room, ws, data);
      } catch (err) {
        console.error("[yjs] Error handling WebSocket message:", err);
      }
    });

    ws.on("close", () => {
      removeConnection(room, roomName, ws);
    });

    ws.on("error", () => {
      removeConnection(room, roomName, ws);
    });
  });

  console.log("[yjs] WebSocket server attached on /ws");
  return wss;
}
