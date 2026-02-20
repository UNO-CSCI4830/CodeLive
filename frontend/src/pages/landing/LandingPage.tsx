import { Link } from "react-router-dom";
import Navbar from "./components/Navbar";
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
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="landing-container">
          <h1 className="landing-title">Code Live</h1>
          <p className="landing-tagline">
            Live technical interviews that reflect real engineering work.
          </p>

          <p className="landing-description">
            Traditional technical interviews overemphasise algorithm puzzles and rote
            memorisation. Code Live creates a live interview environment centred on
            collaboration, documentation, and increasingly AI-assisted reasoning —
            reflecting how engineers actually work every day.
          </p>

          <div className="landing-cta">
            <Link to="/auth" className="landing-cta-primary">
              Login / Sign up
            </Link>
          </div>

          <section className="landing-features">
            {features.map((f) => (
              <FeatureCard key={f.title} title={f.title} description={f.description} />
            ))}
          </section>
        </div>
      </main>
    </>
  );
}
