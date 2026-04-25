import { useEffect } from "react";
import { useNavigate, Outlet } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import Sidebar from "@/components/Sidebar/Sidebar";
import "./DashboardLayout.css";

/**
 * Shared layout for all authenticated pages.
 * Renders the sidebar + an <Outlet /> for nested route content.
 */
export default function DashboardLayout() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();

  /* Guard: redirect unauthenticated users to the landing page. */
  useEffect(() => {
    if (!loading && !user) {
      navigate("/", { replace: true });
    }
  }, [loading, user, navigate]);

  /* If we have the profile loaded and there's no role, go to /role. */
  useEffect(() => {
    if (!loading && user && profile && !profile.role) {
      navigate("/role", { replace: true });
    }
  }, [loading, user, profile, navigate]);

  /* Still resolving auth, or user is set but profile hasn't loaded yet.
     Show a loading state — never render the dashboard without a profile. */
  if (loading || (user && !profile)) {
    return (
      <div className="layout-loading">
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div className="layout-shell">
      <Sidebar />
      <main className="layout-content">
        <Outlet />
      </main>
    </div>
  );
}
