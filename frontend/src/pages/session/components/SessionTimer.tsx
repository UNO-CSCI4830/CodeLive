/**
 * SessionTimer — a countdown timer that locks the current problem
 * when it reaches zero. Displays time remaining in MM:SS format.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Clock, Pause, Play, Lock } from "lucide-react";
import "./SessionTimer.css";

interface Props {
  /** Time limit in minutes */
  timeLimitMinutes: number;
  /** Called when the timer reaches zero */
  onExpired: () => void;
  /** Whether the problem is already locked */
  locked: boolean;
  /** Whether the timer should start immediately */
  autoStart?: boolean;
  /** Optional: provide a startedAt ISO timestamp for sync */
  startedAt?: string | null;
}

export default function SessionTimer({
  timeLimitMinutes,
  onExpired,
  locked,
  autoStart = true,
  startedAt,
}: Props) {
  const totalSeconds = timeLimitMinutes * 60;

  // Calculate remaining seconds from server start time if available
  const calcRemaining = useCallback(() => {
    if (startedAt) {
      const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
      return Math.max(totalSeconds - elapsed, 0);
    }
    return totalSeconds;
  }, [startedAt, totalSeconds]);

  const [remaining, setRemaining] = useState(calcRemaining);
  const [running, setRunning] = useState(autoStart && !locked);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const expiredRef = useRef(false);

  // Resync when startedAt changes
  useEffect(() => {
    setRemaining(calcRemaining());
  }, [calcRemaining]);

  // Main countdown loop
  useEffect(() => {
    if (locked || !running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          clearInterval(intervalRef.current!);
          if (!expiredRef.current) {
            expiredRef.current = true;
            onExpired();
          }
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, locked, onExpired]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const pct = totalSeconds > 0 ? (remaining / totalSeconds) * 100 : 0;

  // Color based on remaining time
  const urgency =
    remaining <= 60
      ? "timer--critical"
      : remaining <= totalSeconds * 0.25
        ? "timer--warning"
        : "timer--normal";

  return (
    <div className={`timer ${urgency} ${locked ? "timer--locked" : ""}`}>
      {/* Circular progress ring */}
      <svg className="timer-ring" viewBox="0 0 36 36">
        <circle className="timer-ring-bg" cx="18" cy="18" r="15.5" />
        <circle
          className="timer-ring-fg"
          cx="18"
          cy="18"
          r="15.5"
          strokeDasharray={`${pct} ${100 - pct}`}
          strokeDashoffset="25"
        />
      </svg>

      <div className="timer-display">
        {locked ? (
          <Lock className="timer-lock-icon" />
        ) : (
          <Clock className="timer-clock-icon" />
        )}
        <span className="timer-digits">
          {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </span>
      </div>

      {/* Pause/resume only for interviewers (caller controls visibility) */}
      {!locked && (
        <button
          type="button"
          className="timer-toggle"
          onClick={() => setRunning((r) => !r)}
          title={running ? "Pause timer" : "Resume timer"}
        >
          {running ? (
            <Pause className="timer-toggle-icon" />
          ) : (
            <Play className="timer-toggle-icon" />
          )}
        </button>
      )}
    </div>
  );
}
