/**
 * SessionTimer — shared interview countdown timer.
 * Uses session-level start + paused state so both participants stay synced.
 */

import { useCallback, useEffect, useState } from "react";
import { Clock, Pause, Play } from "lucide-react";
import "./SessionTimer.css";

interface Props {
  /** Total interview duration in minutes. */
  totalMinutes: number;
  /** Server session started_at timestamp. */
  startedAt?: string | null;
  /** Shared pause state from the server session row. */
  paused: boolean;
  pausedAt?: string | null;
  pausedSeconds: number;
  /** Interviewer-only controls. */
  canToggle?: boolean;
  onPause?: () => Promise<void> | void;
  onResume?: () => Promise<void> | void;
}

export default function SessionTimer({
  totalMinutes,
  startedAt,
  paused,
  pausedAt,
  pausedSeconds,
  canToggle = false,
  onPause,
  onResume,
}: Props) {
  const totalSeconds = Math.max(Math.floor(totalMinutes * 60), 0);
  const [pendingToggle, setPendingToggle] = useState(false);

  const calcRemaining = useCallback(() => {
    if (!startedAt || totalSeconds <= 0) return totalSeconds;

    const startedMs = new Date(startedAt).getTime();
    if (Number.isNaN(startedMs)) return totalSeconds;

    const nowMs = Date.now();
    const elapsedSeconds = Math.max(Math.floor((nowMs - startedMs) / 1000), 0);

    let activePausedSeconds = 0;
    if (paused && pausedAt) {
      const pausedAtMs = new Date(pausedAt).getTime();
      if (!Number.isNaN(pausedAtMs)) {
        activePausedSeconds = Math.max(Math.floor((nowMs - pausedAtMs) / 1000), 0);
      }
    }

    const effectiveElapsed = Math.max(
      elapsedSeconds - Math.max(pausedSeconds, 0) - activePausedSeconds,
      0,
    );
    return Math.max(totalSeconds - effectiveElapsed, 0);
  }, [startedAt, paused, pausedAt, pausedSeconds, totalSeconds]);

  const [remaining, setRemaining] = useState(calcRemaining);

  // Resync from server state
  useEffect(() => {
    setRemaining(calcRemaining());
  }, [calcRemaining]);

  // Tick once per second; values remain stable while paused because calcRemaining
  // subtracts active paused duration.
  useEffect(() => {
    if (!startedAt || totalSeconds <= 0) {
      return;
    }

    const intervalId = setInterval(() => {
      setRemaining(calcRemaining());
    }, 1000);

    return () => clearInterval(intervalId);
  }, [startedAt, totalSeconds, calcRemaining]);

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

  const handleToggle = async () => {
    if (!canToggle || pendingToggle) return;
    const action = paused ? onResume : onPause;
    if (!action) return;
    setPendingToggle(true);
    try {
      await action();
    } finally {
      setPendingToggle(false);
    }
  };

  return (
    <div className={`timer ${urgency} ${paused ? "timer--paused" : ""}`}>
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
        <Clock className="timer-clock-icon" />
        <span className="timer-digits">
          {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </span>
        {paused && <span className="timer-paused-label">Paused</span>}
      </div>

      {canToggle && (
        <button
          type="button"
          className="timer-toggle"
          onClick={handleToggle}
          disabled={pendingToggle || !startedAt}
          title={paused ? "Resume timer" : "Pause timer"}
        >
          {paused ? (
            <Play className="timer-toggle-icon" />
          ) : (
            <Pause className="timer-toggle-icon" />
          )}
        </button>
      )}
    </div>
  );
}
