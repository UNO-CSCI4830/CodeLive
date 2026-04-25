import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import "./styles/AccountPage.css";

export default function AccountPage() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="account-wrapper">
      <div className="account-header">
        <h1 className="account-heading">Account</h1>
        <button type="button" className="account-signout-btn" onClick={handleSignOut}>
          <LogOut className="account-signout-icon" />
          Sign out
        </button>
      </div>

      {/* Profile */}
      <section className="account-section">
        <p className="account-section-label">Profile</p>
        <div className="account-card">
          <div className="account-field">
            <span className="account-label">Name</span>
            <span className="account-value">{profile?.name ?? "—"}</span>
          </div>
          <div className="account-field">
            <span className="account-label">Role</span>
            <span className="account-value">{profile?.role ?? "—"}</span>
          </div>
        </div>
      </section>

      {/* Settings */}
      <section className="account-section">
        <p className="account-section-label">Settings</p>
        <div className="account-card">
          <div className="account-field account-field--placeholder">
            <span className="account-placeholder">More settings coming soon.</span>
          </div>
        </div>
      </section>
    </div>
  );
}
