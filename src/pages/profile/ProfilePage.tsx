import { useAuth } from "@/lib/AuthContext";
import "./styles/ProfilePage.css";

export default function ProfilePage() {
  const { profile } = useAuth();

  return (
    <div className="profile-wrapper">
      <h1 className="profile-heading">Profile</h1>
      <div className="profile-card">
        <p className="profile-field">
          <span className="profile-label">Name</span>
          <span className="profile-value">{profile?.name ?? "—"}</span>
        </p>
        <p className="profile-field">
          <span className="profile-label">Role</span>
          <span className="profile-value">{profile?.role ?? "—"}</span>
        </p>
      </div>
    </div>
  );
}
