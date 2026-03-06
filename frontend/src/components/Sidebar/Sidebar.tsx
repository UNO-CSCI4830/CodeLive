import { useMemo } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  User,
  BookOpen,
  PlayCircle,
  FileText,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import type { Role } from "@/lib/AuthContext";
import "./Sidebar.css";

import type { LucideIcon } from "lucide-react";

interface SidebarLink {
  to: string;
  icon: LucideIcon;
  label: string;
  /** If set, the link is only visible for the given role(s). */
  roles?: Role[];
}

const topLinks: SidebarLink[] = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/session/create", icon: PlayCircle, label: "Sessions" },
  {
    to: "/reports",
    icon: FileText,
    label: "Reports",
    roles: ["interviewer"],
  },
  {
    to: "/questions",
    icon: BookOpen,
    label: "Question Catalogue",
    roles: ["interviewer"],
  },
];

const bottomLinks: SidebarLink[] = [
  { to: "/account", icon: User, label: "Account" },
];

export default function Sidebar() {
  const { profile } = useAuth();
  const role = profile?.role ?? null;

  /** Filter links based on the user's role. */
  const visibleTop = useMemo(
    () => topLinks.filter((l) => !l.roles || (role && l.roles.includes(role))),
    [role],
  );

  const visibleBottom = useMemo(
    () =>
      bottomLinks.filter((l) => !l.roles || (role && l.roles.includes(role))),
    [role],
  );

  return (
    <aside className="sidebar">
      {/* -------- top section -------- */}
      <nav className="sidebar-nav sidebar-nav--top">
        {visibleTop.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? "sidebar-link--active" : ""}`
            }
          >
            <Icon className="sidebar-icon" />
            <span className="sidebar-label">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* -------- bottom section -------- */}
      <nav className="sidebar-nav sidebar-nav--bottom">
        {visibleBottom.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? "sidebar-link--active" : ""}`
            }
          >
            <Icon className="sidebar-icon" />
            <span className="sidebar-label">{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
