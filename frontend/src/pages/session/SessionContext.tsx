/**
 * SessionContext — provides real-time session state to all session pages.
 *
 * Subscribes to Supabase Realtime for session row updates so both
 * interviewer and candidate see status/question changes instantly.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabase";
import { fetchSession, advanceQuestion, lockProblem, endSession } from "./api";
import type { Session, SessionProblem } from "./types";

interface SessionContextValue {
  session: Session | null;
  loading: boolean;
  error: string | null;

  /** The current problem based on session.current_index */
  currentProblem: SessionProblem | null;

  /** Is the current user the interviewer? */
  isInterviewer: boolean;

  /** Advance to the next question (both users see the change) */
  advance: () => Promise<void>;

  /** Lock current problem (timer expired) */
  lockCurrent: () => Promise<void>;

  /** End the session entirely */
  end: () => Promise<void>;

  /** Re-fetch session from the server (shows loading state) */
  refresh: () => Promise<void>;

  /** Re-fetch silently in the background — does not toggle loading state */
  silentRefresh: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

interface Props {
  sessionId: string;
  userId: string;
  children: ReactNode;
}

export function SessionProvider({ sessionId, userId, children }: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initial fetch
  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchSession(sessionId);
      setSession(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    load();
  }, [load]);

  // Subscribe to Supabase Realtime for session changes
  useEffect(() => {
    const channel = supabase
      .channel(`session:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          // Merge scalar fields from the updated row into local state.
          // payload.new is the raw sessions row — it has no "problems" array
          // (that's a virtual field from fetchSession), so spreading it over
          // prev preserves the already-loaded problems list.
          setSession((prev) => {
            if (!prev) {
              // Race condition: Realtime fired before the initial load finished.
              // Schedule a fresh fetch to pick up the new status.
              setTimeout(load, 0);
              return prev;
            }
            return { ...prev, ...payload.new } as Session;
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "session_problems",
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          // Re-fetch to get updated problems list
          load();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, load]);

  const currentProblem =
    session?.problems?.find((p) => p.order_index === session.current_index) ?? null;

  const isInterviewer = session?.interviewer_id === userId;

  const advance = useCallback(async () => {
    const result = await advanceQuestion(sessionId);
    setSession((prev) =>
      prev
        ? { ...prev, current_index: result.currentIndex, status: result.status as Session["status"] }
        : prev,
    );
  }, [sessionId]);

  const lockCurrent = useCallback(async () => {
    if (!session) return;
    await lockProblem(sessionId, session.current_index);
    // Update local state
    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        problems: prev.problems.map((p) =>
          p.order_index === prev.current_index ? { ...p, locked: true } : p,
        ),
      };
    });
  }, [sessionId, session]);

  const endSess = useCallback(async () => {
    await endSession(sessionId);
    setSession((prev) => (prev ? { ...prev, status: "completed" } : prev));
  }, [sessionId]);

  // Silent background fetch — used by polling so it doesn't flash the loading state
  const silentLoad = useCallback(async () => {
    try {
      const data = await fetchSession(sessionId);
      setSession(data);
    } catch {
      // swallow — Realtime will catch a genuine failure eventually
    }
  }, [sessionId]);

  return (
    <SessionContext.Provider
      value={{
        session,
        loading,
        error,
        currentProblem,
        isInterviewer,
        advance,
        lockCurrent,
        end: endSess,
        refresh: load,
        silentRefresh: silentLoad,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}
