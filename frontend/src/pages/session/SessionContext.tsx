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
import {
  fetchSession,
  advanceQuestion,
  endSession,
  selectQuestion,
  pauseTimer,
  resumeTimer,
} from "./api";
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

  /** Jump to a specific question index */
  setCurrentIndex: (index: number) => Promise<void>;

  /** Pause or resume the shared interview timer */
  pauseSharedTimer: () => Promise<void>;
  resumeSharedTimer: () => Promise<void>;

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

  const setCurrentIndex = useCallback(
    async (index: number) => {
      const result = await selectQuestion(sessionId, index);
      setSession((prev) => (prev ? { ...prev, current_index: result.currentIndex } : prev));
    },
    [sessionId],
  );

  const pauseSharedTimer = useCallback(async () => {
    const result = await pauseTimer(sessionId);
    setSession((prev) =>
      prev
        ? {
            ...prev,
            timer_paused: result.timerPaused,
            timer_paused_at: result.timerPausedAt,
            timer_paused_seconds: result.timerPausedSeconds,
          }
        : prev,
    );
  }, [sessionId]);

  const resumeSharedTimer = useCallback(async () => {
    const result = await resumeTimer(sessionId);
    setSession((prev) =>
      prev
        ? {
            ...prev,
            timer_paused: result.timerPaused,
            timer_paused_at: result.timerPausedAt,
            timer_paused_seconds: result.timerPausedSeconds,
          }
        : prev,
    );
  }, [sessionId]);

  const endSess = useCallback(async () => {
    await endSession(sessionId);
    setSession((prev) => (prev ? { ...prev, status: "completed" } : prev));
  }, [sessionId]);

  // Silent background fetch — used by polling so it doesn't flash the loading state
  const silentLoad = useCallback(async () => {
    try {
      const data = await fetchSession(sessionId);
      setSession(data);
      setError(null);
    } catch {
      // swallow — Realtime will catch a genuine failure eventually
    }
  }, [sessionId]);

  // Polling fallback for waiting/null sessions so interviewer-driven state
  // changes always propagate even if a realtime event is missed.
  // Active sessions rely on Supabase Realtime to reduce DB load.
  // Completed/cancelled sessions don't need polling.
  useEffect(() => {
    const status = session?.status;
    // Only poll while waiting for a candidate or when session hasn't loaded yet
    if (status === "completed" || status === "cancelled" || status === "active") {
      return;
    }
    const pollMs = session ? 2000 : 1500;
    const id = setInterval(silentLoad, pollMs);
    return () => clearInterval(id);
  }, [session, silentLoad]);

  return (
    <SessionContext.Provider
      value={{
        session,
        loading,
        error,
        currentProblem,
        isInterviewer,
        advance,
        setCurrentIndex,
        pauseSharedTimer,
        resumeSharedTimer,
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
