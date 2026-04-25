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
  const { user, loading } = useAuth();

  /* If already logged in, redirect straight to dashboard. */
  useEffect(() => {
    if (!loading && user) {
      navigate("/dashboard", { replace: true });
    }
  }, [loading, user, navigate]);

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

      /* onAuthStateChange in AuthContext will update user state,
         which triggers the useEffect redirect above. */
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
      <div className="auth-tabs">
        {(["login", "signup"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
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

      {/* Form */}
      <AuthForm
        mode={activeTab}
        onSubmit={handleSubmit}
        error={error}
        busy={busy}
      />
      </div>
    </main>
  );
}
