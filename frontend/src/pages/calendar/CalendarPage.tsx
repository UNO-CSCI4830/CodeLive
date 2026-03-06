import { useState } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Send } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import "./styles/CalendarPage.css";

/* ── Helpers ──────────────────────────────────────────── */

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function firstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/* ── Dummy events (placeholder until backend integration) ── */

interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  time: string;
  type: "interview" | "review" | "meeting";
}

const SAMPLE_EVENTS: CalendarEvent[] = [
  {
    id: "1",
    title: "Frontend Interview – React",
    date: new Date(),
    time: "10:00 AM",
    type: "interview",
  },
  {
    id: "2",
    title: "Code Review Session",
    date: new Date(),
    time: "2:00 PM",
    type: "review",
  },
  {
    id: "3",
    title: "Team Sync",
    date: new Date(new Date().setDate(new Date().getDate() + 2)),
    time: "11:00 AM",
    type: "meeting",
  },
];

/* ── Component ────────────────────────────────────────── */

export default function CalendarPage() {
  const { profile } = useAuth();
  const isInterviewer = profile?.role === "interviewer";

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [showInviteModal, setShowInviteModal] = useState(false);

  /* Navigation */
  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  };
  const goToday = () => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setSelectedDate(today);
  };

  /* Build calendar grid */
  const totalDays = daysInMonth(viewYear, viewMonth);
  const startDay = firstDayOfMonth(viewYear, viewMonth);
  const cells: (number | null)[] = Array.from({ length: startDay }, () => null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);

  /* Events for selected date */
  const eventsForDate = SAMPLE_EVENTS.filter((e) => isSameDay(e.date, selectedDate));

  /* Events indicator for a given day number */
  const hasEvents = (day: number) =>
    SAMPLE_EVENTS.some((e) =>
      isSameDay(e.date, new Date(viewYear, viewMonth, day)),
    );

  return (
    <div className="cal-wrapper">
      <div className="cal-container">
        {/* ── Header ── */}
        <div className="cal-header">
          <div className="cal-header-left">
            <CalendarIcon className="cal-header-icon" />
            <h1 className="cal-heading">Calendar</h1>
          </div>

          {isInterviewer && (
            <button
              type="button"
              className="cal-invite-btn"
              onClick={() => setShowInviteModal(true)}
            >
              <Send className="cal-invite-icon" />
              Send Calendar Invite
            </button>
          )}
        </div>

        <div className="cal-body">
          {/* ── Calendar grid ── */}
          <div className="cal-grid-section">
            {/* Month nav */}
            <div className="cal-month-nav">
              <button type="button" className="cal-nav-btn" onClick={prevMonth}>
                <ChevronLeft className="cal-nav-icon" />
              </button>
              <span className="cal-month-label">
                {MONTH_NAMES[viewMonth]} {viewYear}
              </span>
              <button type="button" className="cal-nav-btn" onClick={nextMonth}>
                <ChevronRight className="cal-nav-icon" />
              </button>
              <button type="button" className="cal-today-btn" onClick={goToday}>
                Today
              </button>
            </div>

            {/* Day headers */}
            <div className="cal-day-headers">
              {DAY_LABELS.map((d) => (
                <span key={d} className="cal-day-header">{d}</span>
              ))}
            </div>

            {/* Day cells */}
            <div className="cal-days">
              {cells.map((day, i) => {
                if (day === null) return <span key={`empty-${i}`} className="cal-cell cal-cell--empty" />;

                const cellDate = new Date(viewYear, viewMonth, day);
                const isToday = isSameDay(cellDate, today);
                const isSelected = isSameDay(cellDate, selectedDate);
                const hasEvt = hasEvents(day);

                return (
                  <button
                    key={day}
                    type="button"
                    className={[
                      "cal-cell",
                      isToday && "cal-cell--today",
                      isSelected && "cal-cell--selected",
                    ].filter(Boolean).join(" ")}
                    onClick={() => setSelectedDate(cellDate)}
                  >
                    {day}
                    {hasEvt && <span className="cal-cell-dot" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Events sidebar ── */}
          <div className="cal-events-section">
            <h2 className="cal-events-heading">
              {selectedDate.toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </h2>

            {eventsForDate.length === 0 ? (
              <p className="cal-events-empty">No events scheduled.</p>
            ) : (
              <ul className="cal-events-list">
                {eventsForDate.map((evt) => (
                  <li key={evt.id} className={`cal-event cal-event--${evt.type}`}>
                    <span className="cal-event-dot" />
                    <div className="cal-event-info">
                      <span className="cal-event-title">{evt.title}</span>
                      <span className="cal-event-time">{evt.time}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* ── Invite Modal ── */}
      {showInviteModal && (
        <InviteModal onClose={() => setShowInviteModal(false)} />
      )}
    </div>
  );
}

/* ── Invite Modal (interviewer-only) ──────────────────── */

function InviteModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [title, setTitle] = useState("");
  const [sent, setSent] = useState(false);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: integrate with backend API to send invite
    setSent(true);
    setTimeout(onClose, 1500);
  };

  return (
    <div className="cal-modal-overlay" onClick={onClose}>
      <div className="cal-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="cal-modal-title">Send Calendar Invite</h2>

        {sent ? (
          <p className="cal-modal-success">✓ Invite sent successfully!</p>
        ) : (
          <form className="cal-modal-form" onSubmit={handleSend}>
            <label className="cal-modal-label">
              Candidate Email
              <input
                type="email"
                className="cal-modal-input"
                placeholder="candidate@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>

            <label className="cal-modal-label">
              Interview Title
              <input
                type="text"
                className="cal-modal-input"
                placeholder="Frontend Interview – React"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </label>

            <div className="cal-modal-row">
              <label className="cal-modal-label cal-modal-label--half">
                Date
                <input
                  type="date"
                  className="cal-modal-input"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </label>
              <label className="cal-modal-label cal-modal-label--half">
                Time
                <input
                  type="time"
                  className="cal-modal-input"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                />
              </label>
            </div>

            <div className="cal-modal-actions">
              <button type="button" className="cal-modal-cancel" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="cal-modal-send">
                <Send className="cal-modal-send-icon" />
                Send Invite
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
