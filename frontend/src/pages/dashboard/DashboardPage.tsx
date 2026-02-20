import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import "./styles/DashboardPage.css";

export default function DashboardPage() {
  const { user, profile, loading, signOut } = useAuth();
  const navigate = useNavigate();

  /* Guard: redirect unauthenticated users to /auth. */
  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [loading, user, navigate]);

  /* If the user hasn't chosen a role yet, send them to /role. */
  useEffect(() => {
    if (!loading && user && profile && !profile.role) {
      navigate("/role", { replace: true });
    }
  }, [loading, user, profile, navigate]);

  if (loading) {
    return (
      <main className="dashboard-wrapper">
        <p className="dashboard-loading">Loading…</p>
      </main>
    );
  }

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <main className="dashboard-wrapper">
      <div className="dashboard-container">
        <div className="dashboard-header">
          <h1 className="dashboard-heading">Dashboard</h1>
          <button
            type="button"
            onClick={handleSignOut}
            className="dashboard-sign-out"
          >
            Sign out
          </button>
        </div>

        <p className="dashboard-welcome">
          Welcome{profile?.name ? `, ${profile.name}` : ""}! You are signed in
          as <strong>{profile?.role}</strong>.
        </p>
      </div>
    </main>
  );
}
