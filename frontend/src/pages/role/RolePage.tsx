import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import RoleCard from "./components/RoleCard";
import { useAuth, type Role } from "@/lib/AuthContext";
import { apiFetch } from "@/lib/apiClient";
import "./styles/RolePage.css";

const roles: { value: Role; label: string; description: string }[] = [
  {
    value: "candidate",
    label: "Candidate",
    description:
      "Join an interview session to demonstrate your skills in a realistic coding environment.",
  },
  {
    value: "interviewer",
    label: "Interviewer",
    description:
      "Create and observe interview sessions, evaluate candidate workflow and thinking in real time.",
  },
];

export default function RolePage() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { document.title = "Choose your role — Code Live"; }, []);

  const [selected, setSelected] = useState<Role | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Guard: redirect unauthenticated users to /auth. */
  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [loading, user, navigate]);

  /* If the user already has a role, skip straight to dashboard. */
  useEffect(() => {
    if (!loading && profile?.role) {
      navigate("/dashboard", { replace: true });
    }
  }, [loading, profile, navigate]);

  const handleSelect = async (role: Role) => {
    if (!user) return;

    setError(null);
    setSaving(true);

    try {
      const res = await apiFetch("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update role");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update role";
      setError(message);
      setSaving(false);
      return;
    }

    setSelected(role);
    await refreshProfile();
    setSaving(false);

    /* Role saved — continue to the dashboard. */
    navigate("/dashboard");
  };

  /* Don't render until session check completes. */
  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <p className="role-loading">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="role-container">
      <h1 className="role-heading">Choose your role</h1>

      {error && <p className="role-error">{error}</p>}

      <div className="role-list">
        {roles.map((r) => (
          <RoleCard
            key={r.value}
            role={r.label}
            description={r.description}
            selected={selected === r.value}
            disabled={saving}
            onSelect={() => handleSelect(r.value)}
          />
        ))}
      </div>

      {selected && (
        <p className="role-confirmation">
          Role saved:{" "}
          <strong>
            {roles.find((r) => r.value === selected)?.label}
          </strong>
        </p>
      )}
      </div>
    </main>
  );
}
