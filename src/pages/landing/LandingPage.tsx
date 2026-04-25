import { Link } from "react-router-dom";
import Navbar from "./components/Navbar";
import { useState } from "react";
import FeatureCard from "./components/FeatureCard";
import "./styles/LandingPage.css";

const features = [
  {
    title: "Realistic workflows",
    description:
      "Candidates work in an environment that mirrors real engineering — browsing docs, using tools, and writing production-style code.",
  },
  {
    title: "Live interviewer visibility",
    description:
      "Interviewers observe a candidate's thought process, navigation patterns, and problem-solving approach in real time.",
  },
  {
    title: "AI-friendly evaluation (coming soon)",
    description:
      "AI assistants will be integrated so interviews can measure how effectively candidates leverage modern tools.",
  },
] as const;

export default function LandingPage() {
  // “future hooks” 
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const scrollToId = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const submitWaitlist = async () => {
    setStatus("loading");
    setErrorMsg("");

    const trimmed = email.trim();
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);

    if (!ok) {
      setStatus("error");
      setErrorMsg("Enter a valid email.");
      return;
    }

    try {
      // TODO later: replace with real API call
      // await fetch("/api/waitlist", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ email: trimmed }) })
      await new Promise((r) => setTimeout(r, 500));
      setStatus("success");
      setEmail("");
    } catch {
      setStatus("error");
      setErrorMsg("Something went wrong. Try again.");
    }
  };

  return (
    <>
      <Navbar />

      <main className="landing">
        {/* HERO */}
        <section className="hero">
          <div className="hero-inner">
            <div className="hero-left">
              <p className="hero-kicker">Interviews that look like real work.</p>

              <h1 className="hero-title">Code Live</h1>

              <p className="hero-subtitle">
                Live technical interviews that reflect real engineering work.
              </p>

              <p className="hero-description">
                Traditional technical interviews overemphasise algorithm puzzles and promote memorization. Code Live creates a live interview
                environment centered on collaboration, documentation, and increasingly AI-assisted reasoning - reflecting how engineers
                actually work every day.
              </p>

              <div className="hero-actions">
                <Link to="/auth" className="btn btn-primary">
                  Login / Sign up
                </Link>

                <button className="btn btn-ghost" onClick={() => scrollToId("features")}>
                  See features
                </button>
              </div>

              <div className="hero-meta">
                <span className="pill">React + TS</span>
                <span className="pill">Vite</span>
                <span className="pill">Router</span>
              </div>
            </div>

            <div className="hero-right">
              <div className="mock">
                <div className="mock-top">
                  <div className="dot red" />
                  <div className="dot yellow" />
                  <div className="dot green" />
                  <span className="mock-title">Session Preview</span>
                </div>
                <div className="mock-body">
                  <div className="line w80" />
                  <div className="line w60" />
                  <div className="line w90" />
                  <div className="tags">
                    <span className="tag">Docs</span>
                    <span className="tag">Editor</span>
                    <span className="tag">Notes</span>
                    <span className="tag">Rubric</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="hero-strip">
            <button className="strip-link" onClick={() => scrollToId("features")}>Features</button>
            <span className="strip-sep">•</span>
            <button className="strip-link" onClick={() => scrollToId("waitlist")}>Waitlist</button>
            <span className="strip-sep">•</span>
            <Link className="strip-link as-link" to="/auth">Sign in</Link>
          </div>
        </section>

        {/* FEATURES */}
        <section id="features" className="section">
          <div className="section-head">
            <h2>Features</h2>
            <p>.</p>
          </div>

          <div className="feature-grid">
            {features.map((f) => (
              <FeatureCard key={f.title} title={f.title} description={f.description} />
            ))}
          </div>
        </section>

        {/* WAITLIST (future-ready) */}
        <section id="waitlist" className="section">
          <div className="cta">
            <div className="cta-left">
              <h2>Get updates</h2>
              <p>Join the waitlist. (This is wired to a placeholder function you’ll connect later.)</p>

              <div className="waitlist">
                <input
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  autoComplete="email"
                />
                <button className="btn btn-primary" onClick={submitWaitlist} disabled={status === "loading"}>
                  {status === "loading" ? "Submitting..." : "Notify me"}
                </button>
              </div>

              {status === "success" && <p className="msg success">✅ You’re on the list.</p>}
              {status === "error" && <p className="msg error">⚠️ {errorMsg}</p>}
              {status === "idle" && <p className="msg muted">No spam. Just updates.</p>}
            </div>

            <div className="cta-right">
              <div className="cta-card">
                <div className="cta-card-title">What you’ll add later</div>
                <ul className="cta-list">
                  <li>API integration</li>
                  <li>Protected routes</li>
                  <li>Role-based dashboards</li>
                  <li>Session invites</li>
                  <li>Scoring + rubric</li>
                </ul>

                <Link to="/dashboard" className="btn btn-ghost">
                  Go to dashboard
                </Link>
              </div>
            </div>
          </div>
        </section>

        <footer className="footer">
          <div className="footer-inner">
            <div className="footer-brand">Code Live</div>
            <div className="footer-links">
              <button className="footer-link" onClick={() => scrollToId("features")}>Features</button>
              <button className="footer-link" onClick={() => scrollToId("waitlist")}>Waitlist</button>
              <Link className="footer-link" to="/auth">Sign in</Link>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}