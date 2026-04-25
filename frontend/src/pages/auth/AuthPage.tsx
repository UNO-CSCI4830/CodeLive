import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import AuthForm, { type AuthCredentials } from "./components/AuthForm";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import "./styles/AuthPage.css";

type Tab = "login" | "signup";

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState<Tab>("login");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();

  /* Set page title */
  useEffect(() => {
    document.title = activeTab === "login" ? "Log in — Code Live" : "Sign up — Code Live";
  }, [activeTab]);

  /* Once auth + profile are resolved, route to the right place:
     - Has a role  → dashboard
     - No role yet → role selection */
  useEffect(() => {
    if (!loading && user && profile !== undefined) {
      if (profile?.role) {
        navigate("/dashboard", { replace: true });
      } else {
        navigate("/role", { replace: true });
      }
    }
  }, [loading, user, profile, navigate]);

  /* Show a lightweight spinner while the initial session is resolving. */
  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="auth-container" style={{ textAlign: "center", padding: "4rem 0" }}>
          <p style={{ opacity: 0.6 }}>Checking session…</p>
        </div>
      </main>
    );
  }

  const handleSubmit = async ({ email, password, name }: AuthCredentials) => {
    setError(null);
    setBusy(true);

    try {
      if (activeTab === "signup") {
        const { error: signUpErr } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name } },
        });
        if (signUpErr) throw signUpErr;
      } else {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInErr) throw signInErr;
      }

      /* onAuthStateChange in AuthContext will set loading → fetch profile
         → setLoading(false), which triggers the useEffect redirect above.
         No manual navigate needed here. */
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="auth-container">
        <Link to="/" className="auth-back-link">
          ← Back to Landing
        </Link>

        <h1 className="auth-heading">
        {activeTab === "login" ? "Welcome back" : "Create an account"}
      </h1>

      {/* Tabs */}
      <div className="auth-tabs" role="tablist" aria-label="Authentication method">
        {(["login", "signup"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => {
              setActiveTab(tab);
              setError(null);
            }}
            className={`auth-tab ${
              activeTab === tab ? "auth-tab-active" : "auth-tab-inactive"
            }`}
          >
            {tab === "login" ? "Login" : "Sign up"}
          </button>
        ))}
      </div>

      {/* Form — key forces remount so fields reset on tab switch */}
      <AuthForm
        key={activeTab}
        mode={activeTab}
        onSubmit={handleSubmit}
        error={error}
        busy={busy}
      />
      </div>
    </main>
  );
}
